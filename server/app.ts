import { Hono } from 'hono'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'
import { registerPlanRoutes } from './plans.js'
import { registerDietRoutes } from './diets.js'
import { registerAuth } from './auth.js'
import { registerSettingsRoutes } from './settings.js'
import { hashPassword } from './auth.js'
import { registerStudentRoutes } from './student.js'
import { registerAnnouncementRoutes } from './announcements.js'

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

app.get('/api/dashboard/student-engagement', async (c) => {
  const summary = await pool.query<{ total_accounts: string; activated_accounts: string; trained_this_week: string; inactive_7: string; inactive_14: string; without_plan: string; without_diet: string; expiring_week: string }>(
    `SELECT
      count(*) FILTER (WHERE u.role='MEMBER') AS total_accounts,
      count(*) FILTER (WHERE u.role='MEMBER' AND NOT u.force_password_change) AS activated_accounts,
      (SELECT count(DISTINCT member_id) FROM member_workout_completions WHERE completed_at >= date_trunc('week', CURRENT_DATE)::date) AS trained_this_week,
      (SELECT count(*) FROM members m LEFT JOIN users u ON u.member_id=m.id AND u.role='MEMBER' WHERE m.gym_id=$1 AND NOT m.inactive AND (u.last_login_at IS NULL OR u.last_login_at < now()-interval '7 days')) AS inactive_7,
      (SELECT count(*) FROM members m LEFT JOIN users u ON u.member_id=m.id AND u.role='MEMBER' WHERE m.gym_id=$1 AND NOT m.inactive AND (u.last_login_at IS NULL OR u.last_login_at < now()-interval '14 days')) AS inactive_14,
      (SELECT count(*) FROM members m WHERE m.gym_id=$1 AND NOT m.inactive AND NOT EXISTS (SELECT 1 FROM training_plans p WHERE p.member_id=m.id)) AS without_plan,
      (SELECT count(*) FROM members m WHERE m.gym_id=$1 AND NOT m.inactive AND NOT EXISTS (SELECT 1 FROM diets d WHERE d.member_id=m.id)) AS without_diet,
      (SELECT count(*) FROM members m WHERE m.gym_id=$1 AND NOT m.inactive AND m.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7) AS expiring_week
     FROM users u WHERE u.gym_id=$1`, [GYM_ID],
  )
  const inactive = await pool.query<{ id: string; firstName: string; lastName: string; phone: string; lastLoginAt: Date | null; daysSinceLogin: number | null }>(
    `SELECT m.id,m.first_name AS "firstName",m.last_name AS "lastName",m.phone,u.last_login_at AS "lastLoginAt",
       CASE WHEN u.last_login_at IS NULL THEN NULL ELSE floor(extract(epoch FROM (now()-u.last_login_at))/86400)::int END AS "daysSinceLogin"
     FROM members m LEFT JOIN users u ON u.member_id=m.id AND u.role='MEMBER'
     WHERE m.gym_id=$1 AND NOT m.inactive AND (u.last_login_at IS NULL OR u.last_login_at < now()-interval '14 days')
     ORDER BY u.last_login_at NULLS FIRST,m.last_name,m.first_name LIMIT 8`, [GYM_ID],
  )
  const row = summary.rows[0]
  return c.json({ totalAccounts: Number(row.total_accounts), activatedAccounts: Number(row.activated_accounts), trainedThisWeek: Number(row.trained_this_week), inactive7: Number(row.inactive_7), inactive14: Number(row.inactive_14), withoutPlan: Number(row.without_plan), withoutDiet: Number(row.without_diet), expiringWeek: Number(row.expiring_week), inactive })
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
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<DbMember>(
    `INSERT INTO members (id, gym_id, first_name, last_name, dni, phone, birth_date, weight_kg,
      objective, start_date, end_date, inactive)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [crypto.randomUUID(), GYM_ID, m.firstName, m.lastName, m.dni, m.phone, m.birthDate,
        m.weightKg, m.objective, m.startDate, m.endDate, m.inactive],
    )
    const member = result.rows[0]
    const initialPassword = process.env.MEMBER_INITIAL_PASSWORD || 'legado2026'
    await client.query(
      'INSERT INTO users (id,gym_id,username,name,role,member_id,password_hash,force_password_change) VALUES ($1,$2,$3,$4,$5,$6,$7,true)',
      [crypto.randomUUID(), GYM_ID, m.dni, `${m.firstName} ${m.lastName}`, 'MEMBER', member.id, await hashPassword(initialPassword)],
    )
    await client.query('COMMIT')
    return c.json({ ...mapMember(member), studentAccount: { username: m.dni, initialPassword } }, 201)
  } catch (error: unknown) {
    await client.query('ROLLBACK')
    const dbError = error as { code?: string; constraint?: string }
    if (dbError.code === '23505') return c.json({ error: 'Ya existe un socio o una cuenta con ese DNI' }, 409)
    throw error
  } finally { client.release() }
})

app.put('/api/members/:id', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'))
  const parsed = memberInput.safeParse(await c.req.json().catch(() => null))
  if (!id.success || !parsed.success) return c.json({ error: 'Datos inválidos' }, 400)
  const m = parsed.data
  const conflictingAccount = await pool.query('SELECT 1 FROM users WHERE gym_id=$1 AND lower(username)=lower($2) AND (member_id IS NULL OR member_id<>$3) LIMIT 1', [GYM_ID, m.dni, id.data])
  if (conflictingAccount.rowCount) return c.json({ error: 'Ese DNI ya está asociado a otra cuenta' }, 409)
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
  await pool.query('UPDATE users SET username=$2,name=$3 WHERE member_id=$1 AND gym_id=$4', [id.data, m.dni, `${m.firstName} ${m.lastName}`, GYM_ID])
  return c.json(mapMember(result.rows[0]))
})

app.post('/api/members/:id/reset-student-access', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'ID inválido' }, 400)
  const member = await pool.query<{ dni: string }>('SELECT dni FROM members WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
  if (!member.rows[0]?.dni) return c.json({ error: 'El socio no tiene DNI cargado' }, 400)
  const initialPassword = process.env.MEMBER_INITIAL_PASSWORD || 'legado2026'
  const result = await pool.query('UPDATE users SET password_hash=$2,force_password_change=true WHERE member_id=$1 AND gym_id=$3 AND role=$4', [id.data, await hashPassword(initialPassword), GYM_ID, 'MEMBER'])
  if (!result.rowCount) return c.json({ error: 'La cuenta del alumno no existe' }, 404)
  await pool.query('DELETE FROM admin_sessions WHERE user_id IN (SELECT id FROM users WHERE member_id=$1 AND gym_id=$2)', [id.data, GYM_ID])
  return c.json({ username: member.rows[0].dni, initialPassword })
})

app.get('/api/members/:id/student-access', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'ID inválido' }, 400)
  const result = await pool.query<{ username: string; force_password_change: boolean }>(
    `SELECT u.username,u.force_password_change FROM users u
     JOIN members m ON m.id=u.member_id
     WHERE m.id=$1 AND m.gym_id=$2 AND u.role='MEMBER'`, [id.data, GYM_ID],
  )
  return c.json(result.rows[0] ? { exists: true, username: result.rows[0].username, forcePasswordChange: result.rows[0].force_password_change } : { exists: false })
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
registerAnnouncementRoutes(app)
registerSettingsRoutes(app)
registerStudentRoutes(app)

export default app
