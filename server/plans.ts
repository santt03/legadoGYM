import type { Hono } from 'hono'
import type { PoolClient } from 'pg'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'

const uuid = z.string().uuid()
const muscleGroupInput = z.object({ name: z.string().trim().min(1).max(80).refine((name) => !name.includes(','), { message: 'El nombre no puede contener comas' }) })
const exerciseInput = z.object({ name: z.string().trim().min(1).max(120), muscleGroup: z.string().trim().min(1).max(80), notes: z.string().trim().max(500) })
const itemInput = z.object({ exerciseId: uuid, sets: z.number().int().min(1).max(30), reps: z.string().trim().min(1).max(60), load: z.string().trim().max(60), restSeconds: z.number().int().min(0).max(3600).nullable(), notes: z.string().trim().max(500) })
const dayInput = z.object({ name: z.string().trim().min(1).max(80), muscleGroup: z.string().trim().max(120), exercises: z.array(itemInput).max(40) })
const weekInput = z.object({ weekNumber: z.number().int().min(1).max(4), days: z.array(dayInput).max(14) })
const planInput = z.object({ memberId: uuid, name: z.string().trim().min(1).max(120), objective: z.string().trim().max(500), startDate: z.iso.date(), weeks: z.array(weekInput).length(4) })
  .refine((p) => new Set(p.weeks.map((w) => w.weekNumber)).size === 4, { message: 'El plan debe tener las semanas 1 a 4' })
type PlanInput = z.infer<typeof planInput>

async function planDetail(id: string) {
  const header = await pool.query(
    `SELECT p.id, p.member_id AS "memberId", p.name, p.objective, p.start_date AS "startDate",
      p.created_at AS "createdAt", m.first_name AS "firstName", m.last_name AS "lastName",
      m.birth_date AS "birthDate", m.weight_kg AS "weightKg",
      m.objective AS "memberObjective", m.start_date AS "membershipStartDate",
      m.end_date AS "membershipEndDate"
     FROM training_plans p JOIN members m ON m.id=p.member_id
     WHERE p.id=$1 AND p.gym_id=$2`, [id, GYM_ID],
  )
  if (!header.rows[0]) return null
  const rows = await pool.query<{
    week_number: number; day_id: string | null; day_name: string | null; muscle_group: string | null;
    item_id: string | null; exercise_id: string | null; exercise_name: string | null;
    sets: number | null; reps: string | null; load: string | null; rest_seconds: number | null; notes: string | null
  }>(
    `SELECT w.week_number, d.id AS day_id, d.name AS day_name, d.muscle_group,
      i.id AS item_id, i.exercise_id, e.name AS exercise_name, i.sets, i.reps, i.load, i.rest_seconds, i.notes
     FROM training_weeks w
     LEFT JOIN training_days d ON d.week_id=w.id
     LEFT JOIN workout_exercises i ON i.day_id=d.id
     LEFT JOIN exercises e ON e.id=i.exercise_id
     WHERE w.plan_id=$1 ORDER BY w.week_number, d.position, i.position`, [id],
  )
  const weeks = [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, days: [] as Array<{
    id: string; name: string; muscleGroup: string; exercises: Array<{ id: string; exerciseId: string; exerciseName: string; sets: number; reps: string; load: string; restSeconds: number | null; notes: string }>
  }> }))
  for (const row of rows.rows) {
    const week = weeks[row.week_number - 1]
    if (!row.day_id || !week) continue
    let day = week.days.find((d) => d.id === row.day_id)
    if (!day) { day = { id: row.day_id, name: row.day_name || '', muscleGroup: row.muscle_group || '', exercises: [] }; week.days.push(day) }
    if (row.item_id && row.exercise_id) day.exercises.push({
      id: row.item_id, exerciseId: row.exercise_id, exerciseName: row.exercise_name || '',
      sets: row.sets || 1, reps: row.reps || '', load: row.load || '', restSeconds: row.rest_seconds, notes: row.notes || '',
    })
  }
  return { ...header.rows[0], weeks }
}

async function validateReferences(data: PlanInput) {
  const member = await pool.query('SELECT 1 FROM members WHERE id=$1 AND gym_id=$2', [data.memberId, GYM_ID])
  if (!member.rowCount) return 'El socio no existe'
  const ids = [...new Set(data.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))))]
  if (ids.length) {
    const found = await pool.query('SELECT id FROM exercises WHERE gym_id=$1 AND id=ANY($2::uuid[])', [GYM_ID, ids])
    if (found.rowCount !== ids.length) return 'Uno o más ejercicios no pertenecen al catálogo del gimnasio'
  }
  return null
}

async function writeWeeks(client: PoolClient, planId: string, weeks: PlanInput['weeks']) {
    await client.query('DELETE FROM training_weeks WHERE plan_id=$1', [planId])
    for (const week of weeks) {
      const weekId = crypto.randomUUID()
      await client.query('INSERT INTO training_weeks (id, plan_id, week_number) VALUES ($1,$2,$3)', [weekId, planId, week.weekNumber])
      for (const [dayPosition, day] of week.days.entries()) {
        const dayId = crypto.randomUUID()
        await client.query('INSERT INTO training_days (id, week_id, name, muscle_group, position) VALUES ($1,$2,$3,$4,$5)', [dayId, weekId, day.name, day.muscleGroup, dayPosition])
        for (const [position, item] of day.exercises.entries()) {
          await client.query(
            `INSERT INTO workout_exercises (id, day_id, exercise_id, position, sets, reps, load, rest_seconds, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [crypto.randomUUID(), dayId, item.exerciseId, position, item.sets, item.reps, item.load, item.restSeconds, item.notes],
          )
        }
      }
    }
}

export function registerPlanRoutes(app: Hono) {
  app.get('/api/muscle-groups', async (c) => {
    const result = await pool.query(
      `SELECT g.id, g.name, count(e.id)::int AS "exerciseCount"
       FROM muscle_groups g
       LEFT JOIN exercises e ON e.gym_id=g.gym_id AND lower(e.muscle_group)=lower(g.name)
       WHERE g.gym_id=$1 GROUP BY g.id, g.name ORDER BY g.name`,
      [GYM_ID],
    )
    return c.json(result.rows)
  })
  app.post('/api/muscle-groups', async (c) => {
    const parsed = muscleGroupInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Datos del grupo muscular inválidos' }, 400)
    const { name } = parsed.data
    const result = await pool.query('INSERT INTO muscle_groups (id,gym_id,name) VALUES ($1,$2,$3) RETURNING id,name', [crypto.randomUUID(), GYM_ID, name])
      .catch((error: { code?: string }) => { if (error.code === '23505') return null; throw error })
    if (!result) return c.json({ error: 'Ya existe un grupo muscular con ese nombre' }, 409)
    return c.json({ ...result.rows[0], exerciseCount: 0 }, 201)
  })
  app.put('/api/muscle-groups/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    const parsed = muscleGroupInput.safeParse(await c.req.json().catch(() => null))
    if (!id.success || !parsed.success) return c.json({ error: 'Datos del grupo muscular inválidos' }, 400)
    const { name } = parsed.data
    const result = await pool.query('UPDATE muscle_groups SET name=$3 WHERE id=$1 AND gym_id=$2 RETURNING id,name', [id.data, GYM_ID, name])
      .catch((error: { code?: string }) => { if (error.code === '23505') return null; throw error })
    if (!result) return c.json({ error: 'Ya existe un grupo muscular con ese nombre' }, 409)
    if (!result.rows[0]) return c.json({ error: 'Grupo muscular no encontrado' }, 404)
    return c.json(result.rows[0])
  })
  app.delete('/api/muscle-groups/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const used = await pool.query(
      'SELECT 1 FROM muscle_groups g JOIN exercises e ON e.gym_id=g.gym_id AND lower(e.muscle_group)=lower(g.name) WHERE g.id=$1 AND g.gym_id=$2 LIMIT 1',
      [id.data, GYM_ID],
    )
    if (used.rowCount) return c.json({ error: 'Este grupo muscular se usa en el catálogo y no puede eliminarse' }, 409)
    const result = await pool.query('DELETE FROM muscle_groups WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Grupo muscular no encontrado' }, 404)
  })
  app.get('/api/exercises', async (c) => {
    const result = await pool.query('SELECT id, name, muscle_group AS "muscleGroup", notes FROM exercises WHERE gym_id=$1 ORDER BY name', [GYM_ID])
    return c.json(result.rows)
  })
  app.post('/api/exercises', async (c) => {
    const parsed = exerciseInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Datos de ejercicio inválidos' }, 400)
    const { name, muscleGroup, notes } = parsed.data
    const duplicate = await pool.query('SELECT 1 FROM exercises WHERE gym_id=$1 AND lower(name)=lower($2)', [GYM_ID, name])
    if (duplicate.rowCount) return c.json({ error: 'Ya existe un ejercicio con ese nombre' }, 409)
    const result = await pool.query('INSERT INTO exercises (id,gym_id,name,muscle_group,notes) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,muscle_group AS "muscleGroup",notes', [crypto.randomUUID(), GYM_ID, name, muscleGroup, notes])
    return c.json(result.rows[0], 201)
  })
  app.put('/api/exercises/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    const parsed = exerciseInput.safeParse(await c.req.json().catch(() => null))
    if (!id.success || !parsed.success) return c.json({ error: 'Datos de ejercicio inválidos' }, 400)
    const { name, muscleGroup, notes } = parsed.data
    const duplicate = await pool.query('SELECT 1 FROM exercises WHERE gym_id=$1 AND lower(name)=lower($2) AND id<>$3', [GYM_ID, name, id.data])
    if (duplicate.rowCount) return c.json({ error: 'Ya existe un ejercicio con ese nombre' }, 409)
    const result = await pool.query('UPDATE exercises SET name=$3,muscle_group=$4,notes=$5 WHERE id=$1 AND gym_id=$2 RETURNING id,name,muscle_group AS "muscleGroup",notes', [id.data, GYM_ID, name, muscleGroup, notes])
    return result.rows[0] ? c.json(result.rows[0]) : c.json({ error: 'Ejercicio no encontrado' }, 404)
  })
  app.delete('/api/exercises/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const used = await pool.query('SELECT 1 FROM workout_exercises WHERE exercise_id=$1 LIMIT 1', [id.data])
    if (used.rowCount) return c.json({ error: 'El ejercicio se usa en un plan y no puede eliminarse' }, 409)
    const result = await pool.query('DELETE FROM exercises WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Ejercicio no encontrado' }, 404)
  })
  app.get('/api/plans', async (c) => {
    const result = await pool.query(
      `SELECT p.id,p.member_id AS "memberId",p.name,p.objective,p.start_date AS "startDate",
        p.created_at AS "createdAt",m.first_name AS "firstName",m.last_name AS "lastName",
        count(DISTINCT d.id)::int AS "dayCount",count(i.id)::int AS "exerciseCount"
       FROM training_plans p JOIN members m ON m.id=p.member_id
       LEFT JOIN training_weeks w ON w.plan_id=p.id
       LEFT JOIN training_days d ON d.week_id=w.id
       LEFT JOIN workout_exercises i ON i.day_id=d.id
       WHERE p.gym_id=$1 GROUP BY p.id,m.id ORDER BY p.created_at DESC`, [GYM_ID],
    )
    return c.json(result.rows)
  })
  app.get('/api/plans/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const plan = await planDetail(id.data)
    return plan ? c.json(plan) : c.json({ error: 'Plan no encontrado' }, 404)
  })
  app.post('/api/plans', async (c) => {
    const parsed = planInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Datos del plan inválidos', details: parsed.error.flatten() }, 400)
    const invalid = await validateReferences(parsed.data)
    if (invalid) return c.json({ error: invalid }, 400)
    const id = crypto.randomUUID()
    const { memberId, name, objective, startDate, weeks } = parsed.data
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('INSERT INTO training_plans (id,gym_id,member_id,name,objective,start_date) VALUES ($1,$2,$3,$4,$5,$6)', [id,GYM_ID,memberId,name,objective,startDate])
      await writeWeeks(client,id,weeks)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    return c.json(await planDetail(id), 201)
  })
  app.put('/api/plans/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    const parsed = planInput.safeParse(await c.req.json().catch(() => null))
    if (!id.success || !parsed.success) return c.json({ error: 'Datos del plan inválidos' }, 400)
    const invalid = await validateReferences(parsed.data)
    if (invalid) return c.json({ error: invalid }, 400)
    const { memberId, name, objective, startDate, weeks } = parsed.data
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query('UPDATE training_plans SET member_id=$3,name=$4,objective=$5,start_date=$6,updated_at=now() WHERE id=$1 AND gym_id=$2', [id.data,GYM_ID,memberId,name,objective,startDate])
      if (!result.rowCount) { await client.query('ROLLBACK'); return c.json({ error: 'Plan no encontrado' }, 404) }
      await writeWeeks(client,id.data,weeks)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    return c.json(await planDetail(id.data))
  })
  app.delete('/api/plans/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const result = await pool.query('DELETE FROM training_plans WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Plan no encontrado' }, 404)
  })
}
