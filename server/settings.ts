import type { Hono } from 'hono'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'
import { hashPassword } from './auth.js'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const uuid = z.string().uuid()
const username = z.string().trim().regex(/^[a-zA-Z0-9._-]{3,80}$/, 'El usuario debe tener entre 3 y 80 caracteres y usar letras, números, punto, guion o guion bajo')
const role = z.enum(['ADMIN', 'TRAINER'])
const password = z.string().min(12).max(200)
const gymInput = z.object({
  name: z.string().trim().min(2).max(100),
  logoDataUrl: z.union([z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).max(1_100_000), z.null()]),
  defaultMembershipMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
})
const run = promisify(execFile)
const localBackupsAvailable = process.env.VERCEL !== '1'
const backupDir = join(process.cwd(), 'backups')
const pgBin = process.env.PG_BIN_DIR || (process.platform === 'win32' && existsSync('C:\\Program Files\\PostgreSQL\\18\\bin') ? 'C:\\Program Files\\PostgreSQL\\18\\bin' : '')
const pgExecutable = (name: string) => pgBin ? join(pgBin, process.platform === 'win32' ? `${name}.exe` : name) : name

function backupEnv() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
  const database = new URL(process.env.DATABASE_URL)
  return { ...process.env, PGHOST: database.hostname, PGPORT: database.port || '5432', PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password), PGDATABASE: decodeURIComponent(database.pathname.slice(1)) }
}

export function registerSettingsRoutes(app: Hono) {
  app.get('/api/public/gym', async (c) => {
    const result = await pool.query('SELECT name,logo_data_url AS "logoDataUrl" FROM gyms WHERE id=$1', [GYM_ID])
    return c.json(result.rows[0] || { name: 'Legado Gym', logoDataUrl: null })
  })
  app.get('/api/settings', async (c) => {
    const result = await pool.query('SELECT name,logo_data_url AS "logoDataUrl",default_membership_months AS "defaultMembershipMonths" FROM gyms WHERE id=$1', [GYM_ID])
    return result.rows[0] ? c.json(result.rows[0]) : c.json({ error: 'Gimnasio no encontrado' }, 404)
  })
  app.put('/api/settings', async (c) => {
    const parsed = gymInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Configuración inválida. Revisá el nombre, logo y duración de membresía.' }, 400)
    const { name, logoDataUrl, defaultMembershipMonths } = parsed.data
    const result = await pool.query('UPDATE gyms SET name=$2,logo_data_url=$3,default_membership_months=$4 WHERE id=$1 RETURNING name,logo_data_url AS "logoDataUrl",default_membership_months AS "defaultMembershipMonths"', [GYM_ID, name, logoDataUrl, defaultMembershipMonths])
    return c.json(result.rows[0])
  })
  app.get('/api/settings/users', async (c) => {
    const result = await pool.query('SELECT id,username,name,role,created_at AS "createdAt" FROM users WHERE gym_id=$1 ORDER BY role,username', [GYM_ID])
    return c.json(result.rows)
  })
  app.post('/api/settings/users', async (c) => {
    const parsed = z.object({ username, name: z.string().trim().min(2).max(100), role, password }).safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Datos de usuario inválidos. La contraseña necesita al menos 12 caracteres.' }, 400)
    const data = parsed.data
    const result = await pool.query('INSERT INTO users (id,gym_id,username,name,role,password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,username,name,role,created_at AS "createdAt"', [crypto.randomUUID(), GYM_ID, data.username, data.name, data.role, await hashPassword(data.password)])
      .catch((error: { code?: string }) => { if (error.code === '23505') return null; throw error })
    return result ? c.json(result.rows[0], 201) : c.json({ error: 'Ese nombre de usuario ya existe' }, 409)
  })
  app.put('/api/settings/users/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    const parsed = z.object({ name: z.string().trim().min(2).max(100), role, password: z.union([password, z.literal('')]) }).safeParse(await c.req.json().catch(() => null))
    if (!id.success || !parsed.success) return c.json({ error: 'Datos de usuario inválidos. La contraseña nueva necesita al menos 12 caracteres.' }, 400)
    const current = await pool.query<{ role: string }>('SELECT role FROM users WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    if (!current.rows[0]) return c.json({ error: 'Usuario no encontrado' }, 404)
    if (current.rows[0].role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
      const admins = await pool.query('SELECT 1 FROM users WHERE gym_id=$1 AND role=$2 AND id<>$3 LIMIT 1', [GYM_ID, 'ADMIN', id.data])
      if (!admins.rowCount) return c.json({ error: 'Debe quedar al menos un administrador' }, 409)
    }
    const hash = parsed.data.password ? await hashPassword(parsed.data.password) : null
    const result = await pool.query('UPDATE users SET name=$3,role=$4,password_hash=COALESCE($5,password_hash) WHERE id=$1 AND gym_id=$2 RETURNING id,username,name,role,created_at AS "createdAt"', [id.data, GYM_ID, parsed.data.name, parsed.data.role, hash])
    if (hash || parsed.data.role !== current.rows[0].role) await pool.query('DELETE FROM admin_sessions WHERE user_id=$1', [id.data])
    return c.json(result.rows[0])
  })
  app.delete('/api/settings/users/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const result = await pool.query('DELETE FROM users WHERE id=$1 AND gym_id=$2 AND role=$3', [id.data, GYM_ID, 'TRAINER'])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Solo se pueden eliminar entrenadores' }, 409)
  })
  app.get('/api/settings/backups', async (c) => {
    if (!localBackupsAvailable) return c.json({ available: false, files: [] })
    await mkdir(backupDir, { recursive: true })
    const names = (await readdir(backupDir)).filter((name) => /^legado-gym-[\w-]+\.dump$/.test(name)).sort().reverse()
    const files = await Promise.all(names.map(async (name) => { const info = await stat(join(backupDir, name)); return { name, size: info.size, createdAt: info.mtime.toISOString() } }))
    return c.json({ available: true, files })
  })
  app.post('/api/settings/backups', async (c) => {
    if (!localBackupsAvailable) return c.json({ error: 'En la versión web, los respaldos se administran desde Supabase.' }, 409)
    await mkdir(backupDir, { recursive: true })
    const name = `legado-gym-${new Date().toISOString().replace(/[.:]/g, '-')}.dump`
    const output = join(backupDir, name)
    try {
      const env = backupEnv()
      await run(pgExecutable('pg_dump'), ['--format=custom', '--no-owner', '--no-privileges', `--file=${output}`], { env })
      await run(pgExecutable('pg_restore'), ['--list', output], { env })
      const info = await stat(output)
      if (info.size < 1024) throw new Error('Respaldo demasiado pequeño')
      return c.json({ name, size: info.size, createdAt: info.mtime.toISOString() }, 201)
    } catch (error) {
      await rm(output, { force: true })
      throw error
    }
  })
  app.get('/api/settings/backups/:name', async (c) => {
    if (!localBackupsAvailable) return c.json({ error: 'Los respaldos se administran desde Supabase.' }, 404)
    const name = c.req.param('name')
    if (!/^legado-gym-[\w-]+\.dump$/.test(name)) return c.json({ error: 'Nombre de respaldo inválido' }, 400)
    const file = await readFile(join(backupDir, name)).catch(() => null)
    return file ? c.body(new Uint8Array(file), 200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' }) : c.json({ error: 'Respaldo no encontrado' }, 404)
  })
}
