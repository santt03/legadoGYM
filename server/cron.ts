import type { Hono } from 'hono'
import { pool } from './db.js'

export function registerCronRoutes(app: Hono) {
  app.get('/api/cron/heartbeat', async (c) => {
    const secret = process.env.CRON_SECRET
    if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) {
      return c.json({ error: 'No autorizado' }, 401)
    }
    await pool.query('SELECT 1')
    return c.json({ ok: true, checkedAt: new Date().toISOString() })
  })
}
