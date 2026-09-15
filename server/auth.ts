import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'

const scrypt = promisify(scryptCallback)
const COOKIE = 'legado_session'
const SESSION_SECONDS = 60 * 60 * 12
const loginInput = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(200) })
const failedLogins = new Map<string, { count: number; until: number }>()

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${key.toString('hex')}`
}

async function verifyPassword(password: string, stored: string) {
  const [method, salt, digest] = stored.split(':')
  if (method !== 'scrypt' || !salt || !digest) return false
  const expected = Buffer.from(digest, 'hex')
  if (expected.length !== 64) return false
  const actual = await scrypt(password, salt, expected.length) as Buffer
  return timingSafeEqual(actual, expected)
}

function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex') }

export function registerAuth(app: Hono) {
  app.use('/api/*', async (c, next) => {
    const path = c.req.path
    if (path === '/api/health' || path === '/api/public/gym') return next()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('X-Legado-Request') !== '1') {
      return c.json({ error: 'Solicitud no permitida' }, 403)
    }
    if (path === '/api/auth/login') return next()
    const token = getCookie(c, COOKIE)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return c.json({ error: 'Sesión requerida' }, 401)
    const result = await pool.query<{ id: string; username: string; role: string }>(
      `SELECT u.id,u.username,u.role FROM admin_sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND u.gym_id=$2`, [tokenHash(token), GYM_ID],
    )
    if (!result.rows[0]) return c.json({ error: 'Sesión vencida' }, 401)
    const role = result.rows[0].role
    if (role !== 'ADMIN' && role !== 'TRAINER') return c.json({ error: 'Rol no permitido' }, 403)
    if (role !== 'ADMIN' && (path.startsWith('/api/settings/users') || path.startsWith('/api/settings/backups'))) return c.json({ error: 'Esta acción requiere permisos de administrador' }, 403)
    if (role !== 'ADMIN' && !['GET', 'HEAD'].includes(c.req.method)) {
      if (path.startsWith('/api/settings') || path.startsWith('/api/members/') || path === '/api/members' || (path.startsWith('/api/exercises/') && c.req.method === 'DELETE') || (path.startsWith('/api/muscle-groups/') && c.req.method === 'DELETE') || (path.startsWith('/api/foods/') && c.req.method === 'DELETE') || (path.startsWith('/api/food-groups/') && c.req.method === 'DELETE') || (path.startsWith('/api/plans/') && c.req.method === 'DELETE') || (path.startsWith('/api/diets/') && c.req.method === 'DELETE')) {
        return c.json({ error: 'Esta acción requiere permisos de administrador' }, 403)
      }
    }
    await next()
  })

  app.post('/api/auth/login', async (c) => {
    const parsed = loginInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Usuario o contraseña inválidos' }, 400)
    const key = parsed.data.username.toLowerCase()
    const failure = failedLogins.get(key)
    if (failure && failure.until > Date.now() && failure.count >= 5) {
      return c.json({ error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' }, 429)
    }
    const user = await pool.query<{ id: string; username: string; name: string; role: string; password_hash: string }>(
      'SELECT id,username,name,role,password_hash FROM users WHERE lower(username)=lower($1) AND gym_id=$2',
      [parsed.data.username, GYM_ID],
    )
    const row = user.rows[0]
    if (!row || !await verifyPassword(parsed.data.password, row.password_hash || '')) {
      failedLogins.set(key, { count: failure && failure.until > Date.now() ? failure.count + 1 : 1, until: Date.now() + 15 * 60 * 1000 })
      return c.json({ error: 'Usuario o contraseña inválidos' }, 401)
    }
    failedLogins.delete(key)
    const token = randomBytes(32).toString('hex')
    await pool.query('INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval \'12 hours\')', [tokenHash(token), row.id])
    setCookie(c, COOKIE, token, { httpOnly: true, sameSite: 'Strict', secure: process.env.COOKIE_SECURE === 'true', path: '/api', maxAge: SESSION_SECONDS })
    return c.json({ id: row.id, username: row.username, name: row.name, role: row.role })
  })

  app.get('/api/auth/me', async (c) => {
    const token = getCookie(c, COOKIE)!
    const result = await pool.query<{ id: string; username: string; name: string; role: string }>(
      `SELECT u.id,u.username,u.name,u.role FROM admin_sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND u.gym_id=$2`, [tokenHash(token), GYM_ID],
    )
    return c.json(result.rows[0])
  })

  app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, COOKIE)
    if (token) await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1', [tokenHash(token)])
    deleteCookie(c, COOKIE, { path: '/api' })
    return c.body(null, 204)
  })
}
