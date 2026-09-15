import { Hono } from 'hono'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'
import { registerPlanRoutes } from './plans.js'
import { registerDietRoutes } from './diets.js'
import { registerAuth } from './auth.js'
import { registerSettingsRoutes } from './settings.js'

const date = z.iso.date()
const memberInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dni: z.string().regex(/^[0-9]{7,8}$/, 'El DNI debe tener 7 u 8 números'),
  phone: z.string().trim().min(1).max(50),
  birthDate: date.nullable(),
  weightKg: z.number().positive().max(999).nullable(),
  objective: z.string().trim().max(500),
  startDate: date,
  endDate: date,
  inactive: z.boolean(),
}).refine((member) => member.endDate >= member.startDate, {
  message: 'La fecha de vencimiento debe ser posterior al inicio',
  path: ['endDate'],
})

const app = new Hono()
registerAuth(app)

type DbMember = {
  id: string; first_name: string; last_name: string; dni: string | null; phone: string
  birth_date: string | null; weight_kg: string | null; objective: string
  start_date: string; end_date: string; inactive: boolean
  created_at: Date; updated_at: Date
}

function mapMember(row: DbMember) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dni: row.dni,
    phone: row.phone,
    birthDate: row.birth_date,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    objective: row.objective,
    startDate: row.start_date,
    endDate: row.end_date,
    inactive: row.inactive,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Error interno del servidor' }, 500)
})

app.get('/api/health', async (c) => {
  await pool.query('SELECT 1')
  return c.json({ ok: true })
})

app.get('/api/members', async (c) => {
  const result = await pool.query<DbMember>(
    'SELECT * FROM members WHERE gym_id = $1 ORDER BY last_name, first_name', [GYM_ID],
  )
  return c.json(result.rows.map(mapMember))
})

// Consulta estable para el futuro lector de huellas: la identidad biométrica
// podrá resolver el DNI y usar esta misma regla de acceso.
app.get('/api/members/eligibility', async (c) => {
  const dni = z.string().regex(/^[0-9]{7,8}$/).safeParse(c.req.query('dni'))
  if (!dni.success) return c.json({ error: 'DNI inválido' }, 400)
  const result = await pool.query<DbMember & { today: string }>(
    'SELECT m.*, CURRENT_DATE::text AS today FROM members m WHERE m.gym_id=$1 AND m.dni=$2',
    [GYM_ID, dni.data],
  )
  const member = result.rows[0]
  if (!member) return c.json({ found: false, eligible: false, reason: 'NOT_FOUND' })
  const reason = member.inactive ? 'INACTIVE' : member.start_date > member.today ? 'NOT_STARTED' : member.end_date < member.today ? 'EXPIRED' : 'ACTIVE'
  return c.json({ found: true, eligible: reason === 'ACTIVE', reason, memberId: member.id,
    memberName: `${member.first_name} ${member.last_name}`, startDate: member.start_date, endDate: member.end_date })
})

app.post('/api/members', async (c) => {
  const parsed = memberInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400)
  const m = parsed.data
  const result = await pool.query<DbMember>(
    `INSERT INTO members (id, gym_id, first_name, last_name, dni, phone, birth_date, weight_kg,
      objective, start_date, end_date, inactive)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [crypto.randomUUID(), GYM_ID, m.firstName, m.lastName, m.dni, m.phone, m.birthDate,
      m.weightKg, m.objective, m.startDate, m.endDate, m.inactive],
  ).catch((error: { code?: string; constraint?: string }) => {
    if (error.code === '23505' && error.constraint === 'members_gym_dni_idx') return null
    throw error
  })
  if (!result) return c.json({ error: 'Ya existe un socio con ese DNI' }, 409)
  return c.json(mapMember(result.rows[0]), 201)
})

app.put('/api/members/:id', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'))
  const parsed = memberInput.safeParse(await c.req.json().catch(() => null))
  if (!id.success || !parsed.success) return c.json({ error: 'Datos inválidos' }, 400)
  const m = parsed.data
  const result = await pool.query<DbMember>(
    `UPDATE members SET first_name=$3, last_name=$4, dni=$5, phone=$6, birth_date=$7,
      weight_kg=$8, objective=$9, start_date=$10, end_date=$11,
      inactive=$12, updated_at=now() WHERE id=$1 AND gym_id=$2 RETURNING *`,
    [id.data, GYM_ID, m.firstName, m.lastName, m.dni, m.phone, m.birthDate, m.weightKg,
      m.objective, m.startDate, m.endDate, m.inactive],
  ).catch((error: { code?: string; constraint?: string }) => {
    if (error.code === '23505' && error.constraint === 'members_gym_dni_idx') return null
    throw error
  })
  if (!result) return c.json({ error: 'Ya existe un socio con ese DNI' }, 409)
  if (!result.rows[0]) return c.json({ error: 'Socio no encontrado' }, 404)
  return c.json(mapMember(result.rows[0]))
})

app.post('/api/members/:id/renew', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'))
  const body = z.object({ months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]) })
    .safeParse(await c.req.json().catch(() => null))
  if (!id.success || !body.success) return c.json({ error: 'Datos inválidos' }, 400)
  const result = await pool.query<DbMember>(
    `UPDATE members SET
      end_date = CASE WHEN end_date >= CURRENT_DATE
        THEN (end_date + make_interval(months => $3))::date
        ELSE (CURRENT_DATE + make_interval(months => $3) - interval '1 day')::date END,
      inactive = false, updated_at = now()
     WHERE id=$1 AND gym_id=$2 RETURNING *`,
    [id.data, GYM_ID, body.data.months],
  )
  if (!result.rows[0]) return c.json({ error: 'Socio no encontrado' }, 404)
  return c.json(mapMember(result.rows[0]))
})

app.delete('/api/members/:id', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'ID inválido' }, 400)
  const linked = await pool.query('SELECT 1 FROM training_plans WHERE member_id=$1 AND gym_id=$2 LIMIT 1', [id.data, GYM_ID])
  if (linked.rowCount) return c.json({ error: 'Este socio tiene planes. Marcá su ficha como inactiva para conservar el historial.' }, 409)
  const result = await pool.query('DELETE FROM members WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
  if (!result.rowCount) return c.json({ error: 'Socio no encontrado' }, 404)
  return c.body(null, 204)
})

registerPlanRoutes(app)
registerDietRoutes(app)
registerSettingsRoutes(app)

export default app
