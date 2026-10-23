import type { Context, Hono } from 'hono'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'
import { sessionUser } from './auth.js'
import { notifyActiveMembers } from './notifications.js'

const input = z.object({ title: z.string().trim().min(3).max(100), body: z.string().trim().min(3).max(500), kind: z.enum(['INFO', 'SCHEDULE', 'HOLIDAY', 'PLAN']).default('INFO'), startsAt: z.iso.date().default(() => new Date().toISOString().slice(0, 10)), endsAt: z.iso.date().nullable().optional() })
const admin = async (c: Context) => (await sessionUser(c))?.role === 'ADMIN'

export function registerAnnouncementRoutes(app: Hono) {
  app.get('/api/announcements', async (c) => c.json((await pool.query('SELECT id,title,body,kind,starts_at AS "startsAt",ends_at AS "endsAt",active,created_at AS "createdAt" FROM gym_announcements WHERE gym_id=$1 ORDER BY active DESC,starts_at DESC,created_at DESC', [GYM_ID])).rows))
  app.post('/api/announcements', async (c) => {
    if (!await admin(c)) return c.json({ error: 'Esta acción requiere permisos de administrador' }, 403)
    const body = input.safeParse(await c.req.json().catch(() => null))
    if (!body.success || (body.data.endsAt && body.data.endsAt < body.data.startsAt)) return c.json({ error: 'Datos de novedad inválidos' }, 400)
    const value = body.data
    const result = await pool.query('INSERT INTO gym_announcements (id,gym_id,title,body,kind,starts_at,ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,body,kind,starts_at AS "startsAt",ends_at AS "endsAt",active,created_at AS "createdAt"', [crypto.randomUUID(), GYM_ID, value.title, value.body, value.kind, value.startsAt, value.endsAt || null])
    await notifyActiveMembers(value.title, value.body, result.rows[0].id)
    return c.json(result.rows[0], 201)
  })
  app.delete('/api/announcements/:id', async (c) => {
    if (!await admin(c)) return c.json({ error: 'Esta acción requiere permisos de administrador' }, 403)
    const id = z.string().uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    await pool.query('DELETE FROM gym_announcements WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    return c.body(null, 204)
  })
}
