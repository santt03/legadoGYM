import type { Context, Hono } from 'hono'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'
import { sessionUser } from './auth.js'

async function memberForRequest(c: Context) {
  const user = await sessionUser(c)
  return user?.role === 'MEMBER' && user.memberId ? { ...user, memberId: user.memberId } : null
}

async function currentPlan(memberId: string) {
  const header = await pool.query(`SELECT id,name,objective,start_date AS "startDate" FROM training_plans WHERE gym_id=$1 AND member_id=$2 ORDER BY start_date DESC,created_at DESC LIMIT 1`, [GYM_ID, memberId])
  if (!header.rows[0]) return null
  const rows = await pool.query(`SELECT w.week_number AS "weekNumber",d.id AS "dayId",d.name AS "dayName",d.muscle_group AS "muscleGroup",e.name AS "exerciseName",i.sets,i.reps,i.load,i.rest_seconds AS "restSeconds",i.notes
    FROM training_weeks w LEFT JOIN training_days d ON d.week_id=w.id LEFT JOIN workout_exercises i ON i.day_id=d.id LEFT JOIN exercises e ON e.id=i.exercise_id
    WHERE w.plan_id=$1 ORDER BY w.week_number,d.position,i.position`, [header.rows[0].id])
  const weeks: Array<{ weekNumber: number; days: Array<{ id: string; name: string; muscleGroup: string; exercises: unknown[] }> }> = []
  for (const row of rows.rows) {
    let week = weeks.find((item) => item.weekNumber === row.weekNumber)
    if (!week) { week = { weekNumber: row.weekNumber, days: [] }; weeks.push(week) }
    if (!row.dayId) continue
    let day = week.days.find((item) => item.id === row.dayId)
    if (!day) { day = { id: row.dayId, name: row.dayName, muscleGroup: row.muscleGroup || '', exercises: [] }; week.days.push(day) }
    if (row.exerciseName) day.exercises.push({ exerciseName: row.exerciseName, sets: row.sets, reps: row.reps, load: row.load, restSeconds: row.restSeconds, notes: row.notes })
  }
  const completions = await pool.query<{ day_id: string; completed_at: string }>(
    'SELECT day_id,completed_at::text FROM member_workout_completions WHERE member_id=$1 AND plan_id=$2 ORDER BY completed_at DESC', [memberId, header.rows[0].id],
  )
  const completionDates = [...new Set(completions.rows.map((completion) => completion.completed_at))]
  let currentStreak = 0
  if (completionDates.length) {
    const cursor = new Date(`${completionDates[0]}T12:00:00`)
    for (const completedAt of completionDates) {
      const date = new Date(`${completedAt}T12:00:00`)
      if (date.getTime() === cursor.getTime()) { currentStreak += 1; cursor.setDate(cursor.getDate() - 1) } else break
    }
  }
  return { ...header.rows[0], weeks, completedDayIds: completions.rows.map((completion) => completion.day_id), completedCount: completions.rowCount || 0, currentStreak }
}

async function currentDiet(memberId: string) {
  const header = await pool.query(`SELECT id,name,objective,start_date AS "startDate" FROM diets WHERE gym_id=$1 AND member_id=$2 ORDER BY start_date DESC,created_at DESC LIMIT 1`, [GYM_ID, memberId])
  if (!header.rows[0]) return null
  const rows = await pool.query(`SELECT w.week_number AS "weekNumber",d.id AS "dayId",d.name AS "dayName",m.id AS "mealId",m.name AS "mealName",f.name AS "foodName",i.quantity,i.grams,i.notes
    FROM diet_weeks w LEFT JOIN diet_days d ON d.week_id=w.id LEFT JOIN diet_meals m ON m.day_id=d.id LEFT JOIN diet_items i ON i.meal_id=m.id LEFT JOIN foods f ON f.id=i.food_id
    WHERE w.diet_id=$1 ORDER BY w.week_number,d.position,m.position,i.position`, [header.rows[0].id])
  const weeks: Array<{ weekNumber: number; days: Array<{ id: string; name: string; meals: Array<{ id: string; name: string; items: unknown[] }> }> }> = []
  for (const row of rows.rows) {
    let week = weeks.find((item) => item.weekNumber === row.weekNumber)
    if (!week) { week = { weekNumber: row.weekNumber, days: [] }; weeks.push(week) }
    if (!row.dayId) continue
    let day = week.days.find((item) => item.id === row.dayId)
    if (!day) { day = { id: row.dayId, name: row.dayName, meals: [] }; week.days.push(day) }
    if (!row.mealId) continue
    let meal = day.meals.find((item) => item.id === row.mealId)
    if (!meal) { meal = { id: row.mealId, name: row.mealName, items: [] }; day.meals.push(meal) }
    if (row.foodName) meal.items.push({ foodName: row.foodName, quantity: row.quantity, grams: row.grams === null ? null : Number(row.grams), notes: row.notes })
  }
  return { ...header.rows[0], weeks }
}

export function registerStudentRoutes(app: Hono) {
  app.get('/api/student/overview', async (c) => {
    const user = await memberForRequest(c)
    if (!user) return c.json({ error: 'Acceso de alumno requerido' }, 403)
    const result = await pool.query(`SELECT first_name AS "firstName",last_name AS "lastName",phone,objective,start_date AS "startDate",end_date AS "endDate",inactive FROM members WHERE id=$1 AND gym_id=$2`, [user.memberId, GYM_ID])
    const member = result.rows[0]
    if (!member) return c.json({ error: 'Socio no encontrado' }, 404)
    const gym = await pool.query('SELECT name,logo_data_url AS "logoDataUrl",address,whatsapp,instagram,opening_hours AS "openingHours",maps_url AS "mapsUrl" FROM gyms WHERE id=$1', [GYM_ID])
    const [plan, diet] = await Promise.all([currentPlan(user.memberId), currentDiet(user.memberId)])
    return c.json({ member, gym: gym.rows[0], plan, diet, forcePasswordChange: user.forcePasswordChange })
  })
  app.get('/api/student/routine', async (c) => {
    const user = await memberForRequest(c)
    if (!user) return c.json({ error: 'Acceso de alumno requerido' }, 403)
    return c.json(await currentPlan(user.memberId))
  })
  app.get('/api/student/diet', async (c) => {
    const user = await memberForRequest(c)
    if (!user) return c.json({ error: 'Acceso de alumno requerido' }, 403)
    return c.json(await currentDiet(user.memberId))
  })
  app.get('/api/student/gym', async (c) => {
    const user = await memberForRequest(c)
    if (!user) return c.json({ error: 'Acceso de alumno requerido' }, 403)
    const result = await pool.query('SELECT name,logo_data_url AS "logoDataUrl",address,whatsapp,instagram,opening_hours AS "openingHours",maps_url AS "mapsUrl" FROM gyms WHERE id=$1', [GYM_ID])
    return c.json(result.rows[0])
  })
  app.post('/api/student/routine/days/:dayId/complete', async (c) => {
    const user = await memberForRequest(c)
    const dayId = z.string().uuid().safeParse(c.req.param('dayId'))
    if (!user || !dayId.success) return c.json({ error: 'Datos inválidos' }, 400)
    const day = await pool.query<{ plan_id: string }>(
      `SELECT p.id AS plan_id FROM training_days d
       JOIN training_weeks w ON w.id=d.week_id JOIN training_plans p ON p.id=w.plan_id
       WHERE d.id=$1 AND p.member_id=$2 AND p.gym_id=$3`, [dayId.data, user.memberId, GYM_ID],
    )
    if (!day.rows[0]) return c.json({ error: 'Día de entrenamiento no encontrado' }, 404)
    await pool.query(
      'INSERT INTO member_workout_completions (id,member_id,plan_id,day_id) VALUES ($1,$2,$3,$4) ON CONFLICT (member_id,day_id) DO NOTHING',
      [crypto.randomUUID(), user.memberId, day.rows[0].plan_id, dayId.data],
    )
    return c.body(null, 204)
  })
  app.delete('/api/student/routine/days/:dayId/complete', async (c) => {
    const user = await memberForRequest(c)
    const dayId = z.string().uuid().safeParse(c.req.param('dayId'))
    if (!user || !dayId.success) return c.json({ error: 'Datos inválidos' }, 400)
    const result = await pool.query('DELETE FROM member_workout_completions WHERE member_id=$1 AND day_id=$2', [user.memberId, dayId.data])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Entrenamiento no marcado' }, 404)
  })
  app.put('/api/student/profile', async (c) => {
    const user = await memberForRequest(c)
    const body = z.object({ phone: z.string().trim().min(1).max(50) }).safeParse(await c.req.json().catch(() => null))
    if (!user || !body.success) return c.json({ error: 'Datos inválidos' }, 400)
    await pool.query('UPDATE members SET phone=$2,updated_at=now() WHERE id=$1 AND gym_id=$3', [user.memberId, body.data.phone, GYM_ID])
    return c.body(null, 204)
  })
  app.post('/api/student/notifications/subscribe', async (c) => {
    const user = await memberForRequest(c)
    const body = z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().min(1).max(1000), auth: z.string().min(1).max(1000) }) }).safeParse(await c.req.json().catch(() => null))
    if (!user || !body.success) return c.json({ error: 'Suscripción inválida' }, 400)
    await pool.query(
      `INSERT INTO member_push_subscriptions (id,member_id,endpoint,p256dh,auth)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET member_id=excluded.member_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now()`,
      [crypto.randomUUID(), user.memberId, body.data.endpoint, body.data.keys.p256dh, body.data.keys.auth],
    )
    return c.body(null, 204)
  })
}
