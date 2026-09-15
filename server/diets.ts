import type { Hono } from 'hono'
import type { PoolClient } from 'pg'
import { z } from 'zod'
import { pool, GYM_ID } from './db.js'

const uuid = z.string().uuid()
const foodInput = z.object({
  name: z.string().trim().min(1).max(120),
  groupId: uuid.nullable(),
  calories: z.number().min(0).max(10000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(1000),
  fat: z.number().min(0).max(1000),
  notes: z.string().trim().max(500),
})
const itemInput = z.object({ foodId: uuid, quantity: z.string().trim().max(80), grams: z.number().positive().max(5000).nullable(), notes: z.string().trim().max(500) })
const mealInput = z.object({ name: z.string().trim().min(1).max(80), items: z.array(itemInput).max(40) })
const dayInput = z.object({ name: z.string().trim().min(1).max(80), meals: z.array(mealInput).max(14) })
const weekInput = z.object({ weekNumber: z.number().int().min(1).max(12), days: z.array(dayInput).max(14) })
const dietInput = z.object({ memberId: uuid, name: z.string().trim().min(1).max(120), objective: z.string().trim().max(500), startDate: z.iso.date(), weeks: z.array(weekInput).min(1).max(12) })
  .refine((d) => d.weeks.every((week, index) => week.weekNumber === index + 1), { message: 'Los meses deben ser consecutivos desde el mes 1' })
type DietInput = z.infer<typeof dietInput>
type FoodRow = { id: string; name: string; groupId: string | null; groupName: string | null; calories: string; protein: string; carbs: string; fat: string; notes: string }

function mapFood(row: FoodRow) {
  return { id: row.id, name: row.name, groupId: row.groupId, groupName: row.groupName, calories: Number(row.calories), protein: Number(row.protein), carbs: Number(row.carbs), fat: Number(row.fat), notes: row.notes }
}

async function validFoodGroup(groupId: string | null) {
  if (!groupId) return true
  const result = await pool.query('SELECT 1 FROM food_groups WHERE id=$1 AND gym_id=$2', [groupId, GYM_ID])
  return !!result.rowCount
}

async function dietDetail(id: string) {
  const header = await pool.query(
    `SELECT d.id, d.member_id AS "memberId", d.name, d.objective, d.start_date AS "startDate",
      d.created_at AS "createdAt", m.first_name AS "firstName", m.last_name AS "lastName",
      m.birth_date AS "birthDate", m.weight_kg AS "weightKg",
      m.objective AS "memberObjective", m.start_date AS "membershipStartDate",
      m.end_date AS "membershipEndDate"
     FROM diets d JOIN members m ON m.id=d.member_id
     WHERE d.id=$1 AND d.gym_id=$2`, [id, GYM_ID],
  )
  if (!header.rows[0]) return null
  const rows = await pool.query<{
    week_number: number; day_id: string | null; day_name: string | null;
    meal_id: string | null; meal_name: string | null;
    item_id: string | null; food_id: string | null; food_name: string | null;
    quantity: string | null; grams: string | null; notes: string | null;
    calories: string | null; protein: string | null; carbs: string | null; fat: string | null
  }>(
    `SELECT w.week_number, d.id AS day_id, d.name AS day_name,
      m.id AS meal_id, m.name AS meal_name,
      i.id AS item_id, i.food_id, f.name AS food_name, i.quantity, i.grams, i.notes,
      f.calories, f.protein, f.carbs, f.fat
     FROM diet_weeks w
     LEFT JOIN diet_days d ON d.week_id=w.id
     LEFT JOIN diet_meals m ON m.day_id=d.id
     LEFT JOIN diet_items i ON i.meal_id=m.id
     LEFT JOIN foods f ON f.id=i.food_id
     WHERE w.diet_id=$1 ORDER BY w.week_number, d.position, m.position, i.position`, [id],
  )
  const monthNumbers = [...new Set(rows.rows.map((row) => row.week_number))].sort((a, b) => a - b)
  const weeks = monthNumbers.map((weekNumber) => ({ weekNumber, days: [] as Array<{
    id: string; name: string; meals: Array<{ id: string; name: string; items: Array<{ id: string; foodId: string; foodName: string; quantity: string; grams: number | null; notes: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null }> }>
  }> }))
  for (const row of rows.rows) {
    const week = weeks.find((item) => item.weekNumber === row.week_number)
    if (!row.day_id || !week) continue
    let day = week.days.find((d) => d.id === row.day_id)
    if (!day) { day = { id: row.day_id, name: row.day_name || '', meals: [] }; week.days.push(day) }
    if (!row.meal_id) continue
    let meal = day.meals.find((m) => m.id === row.meal_id)
    if (!meal) { meal = { id: row.meal_id, name: row.meal_name || '', items: [] }; day.meals.push(meal) }
    if (row.item_id && row.food_id) meal.items.push({
      id: row.item_id, foodId: row.food_id, foodName: row.food_name || '',
      quantity: row.quantity || '', grams: row.grams === null ? null : Number(row.grams), notes: row.notes || '',
      calories: row.calories === null ? null : Number(row.calories),
      protein: row.protein === null ? null : Number(row.protein),
      carbs: row.carbs === null ? null : Number(row.carbs),
      fat: row.fat === null ? null : Number(row.fat),
    })
  }
  return { ...header.rows[0], weeks }
}

async function validateReferences(data: DietInput) {
  const member = await pool.query('SELECT 1 FROM members WHERE id=$1 AND gym_id=$2', [data.memberId, GYM_ID])
  if (!member.rowCount) return 'El socio no existe'
  const ids = [...new Set(data.weeks.flatMap((w) => w.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId)))))]
  if (ids.length) {
    const found = await pool.query('SELECT id FROM foods WHERE gym_id=$1 AND id=ANY($2::uuid[])', [GYM_ID, ids])
    if (found.rowCount !== ids.length) return 'Uno o más alimentos no pertenecen al catálogo del gimnasio'
  }
  return null
}

async function writeWeeks(client: PoolClient, dietId: string, weeks: DietInput['weeks']) {
  await client.query('DELETE FROM diet_weeks WHERE diet_id=$1', [dietId])
  for (const week of weeks) {
    const weekId = crypto.randomUUID()
    await client.query('INSERT INTO diet_weeks (id, diet_id, week_number) VALUES ($1,$2,$3)', [weekId, dietId, week.weekNumber])
    for (const [dayPosition, day] of week.days.entries()) {
      const dayId = crypto.randomUUID()
      await client.query('INSERT INTO diet_days (id, week_id, name, position) VALUES ($1,$2,$3,$4)', [dayId, weekId, day.name, dayPosition])
      for (const [mealPosition, meal] of day.meals.entries()) {
        const mealId = crypto.randomUUID()
        await client.query('INSERT INTO diet_meals (id, day_id, name, position) VALUES ($1,$2,$3,$4)', [mealId, dayId, meal.name, mealPosition])
        for (const [position, item] of meal.items.entries()) {
          await client.query(
            `INSERT INTO diet_items (id, meal_id, food_id, quantity, grams, notes, position)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [crypto.randomUUID(), mealId, item.foodId, item.quantity, item.grams, item.notes, position],
          )
        }
      }
    }
  }
}

export function registerDietRoutes(app: Hono) {
  app.get('/api/food-groups', async (c) => {
    const result = await pool.query('SELECT g.id,g.name,count(f.id)::int AS "foodCount" FROM food_groups g LEFT JOIN foods f ON f.group_id=g.id AND f.gym_id=g.gym_id WHERE g.gym_id=$1 GROUP BY g.id,g.name ORDER BY g.name', [GYM_ID])
    return c.json(result.rows)
  })
  app.post('/api/food-groups', async (c) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Datos del grupo inválidos' }, 400)
    const result = await pool.query('INSERT INTO food_groups (id,gym_id,name) VALUES ($1,$2,$3) RETURNING id,name', [crypto.randomUUID(), GYM_ID, parsed.data.name])
      .catch((error: { code?: string }) => { if (error.code === '23505') return null; throw error })
    return result ? c.json({ ...result.rows[0], foodCount: 0 }, 201) : c.json({ error: 'Ya existe un grupo con ese nombre' }, 409)
  })
  app.put('/api/food-groups/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(await c.req.json().catch(() => null))
    if (!id.success || !parsed.success) return c.json({ error: 'Datos del grupo inválidos' }, 400)
    const result = await pool.query('UPDATE food_groups SET name=$3 WHERE id=$1 AND gym_id=$2 RETURNING id,name', [id.data, GYM_ID, parsed.data.name])
      .catch((error: { code?: string }) => { if (error.code === '23505') return null; throw error })
    if (!result) return c.json({ error: 'Ya existe un grupo con ese nombre' }, 409)
    return result.rows[0] ? c.json(result.rows[0]) : c.json({ error: 'Grupo no encontrado' }, 404)
  })
  app.delete('/api/food-groups/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const used = await pool.query('SELECT 1 FROM foods WHERE group_id=$1 AND gym_id=$2 LIMIT 1', [id.data, GYM_ID])
    if (used.rowCount) return c.json({ error: 'El grupo tiene alimentos asignados y no puede eliminarse' }, 409)
    const result = await pool.query('DELETE FROM food_groups WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Grupo no encontrado' }, 404)
  })
  app.get('/api/foods', async (c) => {
    const result = await pool.query<FoodRow>('SELECT f.id,f.name,f.group_id AS "groupId",g.name AS "groupName",f.calories,f.protein,f.carbs,f.fat,f.notes FROM foods f LEFT JOIN food_groups g ON g.id=f.group_id WHERE f.gym_id=$1 ORDER BY g.name NULLS LAST,f.name', [GYM_ID])
    return c.json(result.rows.map(mapFood))
  })
  app.post('/api/foods', async (c) => {
    const parsed = foodInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Datos del alimento inválidos' }, 400)
    const { name, groupId, calories, protein, carbs, fat, notes } = parsed.data
    if (!await validFoodGroup(groupId)) return c.json({ error: 'Grupo de alimentos inválido' }, 400)
    const duplicate = await pool.query('SELECT 1 FROM foods WHERE gym_id=$1 AND lower(name)=lower($2)', [GYM_ID, name])
    if (duplicate.rowCount) return c.json({ error: 'Ya existe un alimento con ese nombre' }, 409)
    const result = await pool.query<FoodRow>(
      'INSERT INTO foods (id,gym_id,name,group_id,calories,protein,carbs,fat,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,name,group_id AS "groupId",(SELECT name FROM food_groups WHERE id=group_id) AS "groupName",calories,protein,carbs,fat,notes',
      [crypto.randomUUID(), GYM_ID, name, groupId, calories, protein, carbs, fat, notes],
    )
    return c.json(mapFood(result.rows[0]), 201)
  })
  app.put('/api/foods/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    const parsed = foodInput.safeParse(await c.req.json().catch(() => null))
    if (!id.success || !parsed.success) return c.json({ error: 'Datos del alimento inválidos' }, 400)
    const { name, groupId, calories, protein, carbs, fat, notes } = parsed.data
    if (!await validFoodGroup(groupId)) return c.json({ error: 'Grupo de alimentos inválido' }, 400)
    const duplicate = await pool.query('SELECT 1 FROM foods WHERE gym_id=$1 AND lower(name)=lower($2) AND id<>$3', [GYM_ID, name, id.data])
    if (duplicate.rowCount) return c.json({ error: 'Ya existe un alimento con ese nombre' }, 409)
    const result = await pool.query<FoodRow>(
      'UPDATE foods SET name=$3,group_id=$4,calories=$5,protein=$6,carbs=$7,fat=$8,notes=$9 WHERE id=$1 AND gym_id=$2 RETURNING id,name,group_id AS "groupId",(SELECT name FROM food_groups WHERE id=group_id) AS "groupName",calories,protein,carbs,fat,notes',
      [id.data, GYM_ID, name, groupId, calories, protein, carbs, fat, notes],
    )
    return result.rows[0] ? c.json(mapFood(result.rows[0])) : c.json({ error: 'Alimento no encontrado' }, 404)
  })
  app.delete('/api/foods/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const used = await pool.query('SELECT 1 FROM diet_items WHERE food_id=$1 LIMIT 1', [id.data])
    if (used.rowCount) return c.json({ error: 'El alimento se usa en una dieta y no puede eliminarse' }, 409)
    const result = await pool.query('DELETE FROM foods WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Alimento no encontrado' }, 404)
  })
  app.get('/api/diets', async (c) => {
    const result = await pool.query(
      `SELECT d.id,d.member_id AS "memberId",d.name,d.objective,d.start_date AS "startDate",
        d.created_at AS "createdAt",m.first_name AS "firstName",m.last_name AS "lastName",
        count(DISTINCT dd.id)::int AS "dayCount",count(i.id)::int AS "itemCount"
       FROM diets d JOIN members m ON m.id=d.member_id
       LEFT JOIN diet_weeks w ON w.diet_id=d.id
       LEFT JOIN diet_days dd ON dd.week_id=w.id
       LEFT JOIN diet_meals dm ON dm.day_id=dd.id
       LEFT JOIN diet_items i ON i.meal_id=dm.id
       WHERE d.gym_id=$1 GROUP BY d.id,m.id ORDER BY d.created_at DESC`, [GYM_ID],
    )
    return c.json(result.rows)
  })
  app.get('/api/diets/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const diet = await dietDetail(id.data)
    return diet ? c.json(diet) : c.json({ error: 'Dieta no encontrada' }, 404)
  })
  app.post('/api/diets', async (c) => {
    const parsed = dietInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Datos de la dieta inválidos', details: parsed.error.flatten() }, 400)
    const invalid = await validateReferences(parsed.data)
    if (invalid) return c.json({ error: invalid }, 400)
    const id = crypto.randomUUID()
    const { memberId, name, objective, startDate, weeks } = parsed.data
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('INSERT INTO diets (id,gym_id,member_id,name,objective,start_date) VALUES ($1,$2,$3,$4,$5,$6)', [id,GYM_ID,memberId,name,objective,startDate])
      await writeWeeks(client,id,weeks)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    return c.json(await dietDetail(id), 201)
  })
  app.put('/api/diets/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    const parsed = dietInput.safeParse(await c.req.json().catch(() => null))
    if (!id.success || !parsed.success) return c.json({ error: 'Datos de la dieta inválidos' }, 400)
    const invalid = await validateReferences(parsed.data)
    if (invalid) return c.json({ error: invalid }, 400)
    const { memberId, name, objective, startDate, weeks } = parsed.data
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query('UPDATE diets SET member_id=$3,name=$4,objective=$5,start_date=$6,updated_at=now() WHERE id=$1 AND gym_id=$2', [id.data,GYM_ID,memberId,name,objective,startDate])
      if (!result.rowCount) { await client.query('ROLLBACK'); return c.json({ error: 'Dieta no encontrada' }, 404) }
      await writeWeeks(client,id.data,weeks)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    return c.json(await dietDetail(id.data))
  })
  app.delete('/api/diets/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'ID inválido' }, 400)
    const result = await pool.query('DELETE FROM diets WHERE id=$1 AND gym_id=$2', [id.data, GYM_ID])
    return result.rowCount ? c.body(null, 204) : c.json({ error: 'Dieta no encontrada' }, 404)
  })
}
