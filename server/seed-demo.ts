import { pool, GYM_ID } from './db.js'
import type { PoolClient } from 'pg'

const START_DATE = '2026-09-14'
const END_DATE = '2026-10-13'

type ExerciseSeed = { name: string; group: string; notes: string }
type FoodSeed = { name: string; group: string; kcal: number; protein: number; carbs: number; fat: number }

const exercises: ExerciseSeed[] = [
  { name: 'Press banca con barra', group: 'Pecho', notes: 'Controlar el descenso y mantener las escápulas retraídas.' },
  { name: 'Press inclinado con mancuernas', group: 'Pecho', notes: 'Banco a 30 grados.' },
  { name: 'Remo con barra', group: 'Espalda', notes: 'Columna neutra y codos cerca del cuerpo.' },
  { name: 'Jalón al pecho', group: 'Espalda', notes: 'Llevar la barra a la parte alta del pecho.' },
  { name: 'Sentadilla con barra', group: 'Piernas', notes: 'Profundidad cómoda y rodillas alineadas.' },
  { name: 'Peso muerto rumano', group: 'Piernas', notes: 'Descenso controlado y cadera hacia atrás.' },
  { name: 'Prensa de piernas', group: 'Piernas', notes: 'No bloquear las rodillas.' },
  { name: 'Press militar', group: 'Hombros', notes: 'Evitar arquear la zona lumbar.' },
  { name: 'Elevaciones laterales', group: 'Hombros', notes: 'Movimiento controlado sin impulso.' },
  { name: 'Extensión de tríceps en polea', group: 'Tríceps', notes: 'Mantener los codos fijos.' },
  { name: 'Curl de bíceps con barra', group: 'Bíceps', notes: 'No balancear el torso.' },
  { name: 'Curl martillo', group: 'Bíceps', notes: 'Muñecas en posición neutra.' },
]

const foods: FoodSeed[] = [
  { name: 'Pechuga de pollo', group: 'Proteínas', kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Carne vacuna magra', group: 'Proteínas', kcal: 200, protein: 26, carbs: 0, fat: 10 },
  { name: 'Atún en lata al agua', group: 'Proteínas', kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { name: 'Huevos', group: 'Proteínas', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  { name: 'Arroz blanco cocido', group: 'Carbohidratos', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Avena', group: 'Carbohidratos', kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
  { name: 'Batata', group: 'Carbohidratos', kcal: 86, protein: 1.6, carbs: 20.1, fat: 0.1 },
  { name: 'Pan integral', group: 'Carbohidratos', kcal: 247, protein: 13, carbs: 41, fat: 3.4 },
  { name: 'Aceite de oliva', group: 'Grasas', kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { name: 'Almendras', group: 'Grasas', kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9 },
  { name: 'Palta', group: 'Grasas', kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { name: 'Banana', group: 'Frutas', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  { name: 'Manzana', group: 'Frutas', kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2 },
  { name: 'Brócoli', group: 'Verduras', kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  { name: 'Yogur natural', group: 'Lácteos', kcal: 63, protein: 5.3, carbs: 7, fat: 1.6 },
  { name: 'Leche descremada', group: 'Lácteos', kcal: 35, protein: 3.4, carbs: 5, fat: 0.1 },
]

async function catalog(client: PoolClient) {
  const exerciseIds = new Map<string, string>()
  for (const exercise of exercises) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO exercises (id,gym_id,name,muscle_group,notes) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (gym_id,name) DO UPDATE SET muscle_group=excluded.muscle_group,notes=excluded.notes RETURNING id`,
      [crypto.randomUUID(), GYM_ID, exercise.name, exercise.group, exercise.notes],
    )
    exerciseIds.set(exercise.name, result.rows[0].id)
  }

  const foodIds = new Map<string, string>()
  for (const food of foods) {
    const group = await client.query<{ id: string }>('SELECT id FROM food_groups WHERE gym_id=$1 AND lower(name)=lower($2)', [GYM_ID, food.group])
    if (!group.rows[0]) throw new Error(`No existe el grupo de alimentos ${food.group}`)
    const result = await client.query<{ id: string }>(
      `INSERT INTO foods (id,gym_id,group_id,name,calories,protein,carbs,fat,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Valores aproximados por 100 g')
       ON CONFLICT (gym_id,name) DO UPDATE SET group_id=excluded.group_id,calories=excluded.calories,protein=excluded.protein,carbs=excluded.carbs,fat=excluded.fat,notes=excluded.notes RETURNING id`,
      [crypto.randomUUID(), GYM_ID, group.rows[0].id, food.name, food.kcal, food.protein, food.carbs, food.fat],
    )
    foodIds.set(food.name, result.rows[0].id)
  }
  return { exerciseIds, foodIds }
}

async function member(client: PoolClient, data: { id: string; first: string; last: string; dni: string; phone: string; birth: string; weight: number; objective: string }) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO members (id,gym_id,first_name,last_name,dni,phone,birth_date,weight_kg,objective,start_date,end_date,inactive)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)
     ON CONFLICT (gym_id,dni) WHERE dni IS NOT NULL DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone,birth_date=excluded.birth_date,weight_kg=excluded.weight_kg,objective=excluded.objective,start_date=excluded.start_date,end_date=excluded.end_date,inactive=false,updated_at=now()
     RETURNING id`,
    [data.id, GYM_ID, data.first, data.last, data.dni, data.phone, data.birth, data.weight, data.objective, START_DATE, END_DATE],
  )
  return result.rows[0].id
}

async function trainingPlan(client: PoolClient, planId: string, memberId: string, name: string, objective: string, template: Array<{ name: string; group: string; items: Array<[string, number, string, string, number]> }>, exerciseIds: Map<string, string>) {
  await client.query(
    `INSERT INTO training_plans (id,gym_id,member_id,name,objective,start_date) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET member_id=excluded.member_id,name=excluded.name,objective=excluded.objective,start_date=excluded.start_date,updated_at=now()`,
    [planId, GYM_ID, memberId, name, objective, START_DATE],
  )
  await client.query('DELETE FROM training_weeks WHERE plan_id=$1', [planId])
  for (let week = 1; week <= 4; week++) {
    const weekId = crypto.randomUUID()
    await client.query('INSERT INTO training_weeks (id,plan_id,week_number) VALUES ($1,$2,$3)', [weekId, planId, week])
    for (const [dayPosition, day] of template.entries()) {
      const dayId = crypto.randomUUID()
      await client.query('INSERT INTO training_days (id,week_id,name,muscle_group,position) VALUES ($1,$2,$3,$4,$5)', [dayId, weekId, day.name, day.group, dayPosition])
      for (const [position, [exerciseName, sets, reps, load, rest]] of day.items.entries()) {
        await client.query('INSERT INTO workout_exercises (id,day_id,exercise_id,position,sets,reps,load,rest_seconds,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [crypto.randomUUID(), dayId, exerciseIds.get(exerciseName), position, sets, reps, load, rest, week === 4 ? 'Semana de consolidación técnica' : 'Dejar 2 repeticiones en reserva'])
      }
    }
  }
}

type Meal = { name: string; items: Array<[string, string, number]> }
async function diet(client: PoolClient, dietId: string, memberId: string, name: string, objective: string, days: Array<{ name: string; meals: Meal[] }>, foodIds: Map<string, string>) {
  await client.query(
    `INSERT INTO diets (id,gym_id,member_id,name,objective,start_date) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET member_id=excluded.member_id,name=excluded.name,objective=excluded.objective,start_date=excluded.start_date,updated_at=now()`,
    [dietId, GYM_ID, memberId, name, objective, START_DATE],
  )
  await client.query('DELETE FROM diet_weeks WHERE diet_id=$1', [dietId])
  for (let week = 1; week <= 4; week++) {
    const weekId = crypto.randomUUID()
    await client.query('INSERT INTO diet_weeks (id,diet_id,week_number) VALUES ($1,$2,$3)', [weekId, dietId, week])
    for (const [dayPosition, day] of days.entries()) {
      const dayId = crypto.randomUUID()
      await client.query('INSERT INTO diet_days (id,week_id,name,position) VALUES ($1,$2,$3,$4)', [dayId, weekId, day.name, dayPosition])
      for (const [mealPosition, meal] of day.meals.entries()) {
        const mealId = crypto.randomUUID()
        await client.query('INSERT INTO diet_meals (id,day_id,name,position) VALUES ($1,$2,$3,$4)', [mealId, dayId, meal.name, mealPosition])
        for (const [position, [foodName, quantity, grams]] of meal.items.entries()) {
          await client.query('INSERT INTO diet_items (id,meal_id,food_id,quantity,grams,notes,position) VALUES ($1,$2,$3,$4,$5,$6,$7)', [crypto.randomUUID(), mealId, foodIds.get(foodName), quantity, grams, '', position])
        }
      }
    }
  }
}

const planA = [
  { name: 'Lunes - Empuje', group: 'Pecho, Hombros y Tríceps', items: [['Press banca con barra', 4, '8-10', 'Moderada', 90], ['Press inclinado con mancuernas', 3, '10-12', 'Moderada', 75], ['Elevaciones laterales', 3, '12-15', 'Liviana', 60], ['Extensión de tríceps en polea', 3, '12-15', 'Moderada', 60]] },
  { name: 'Miércoles - Tirón', group: 'Espalda y Bíceps', items: [['Jalón al pecho', 4, '8-12', 'Moderada', 90], ['Remo con barra', 4, '8-10', 'Moderada', 90], ['Curl de bíceps con barra', 3, '10-12', 'Moderada', 60], ['Curl martillo', 3, '12', 'Liviana', 60]] },
  { name: 'Viernes - Piernas', group: 'Piernas', items: [['Sentadilla con barra', 4, '8-10', 'Moderada', 120], ['Peso muerto rumano', 3, '10', 'Moderada', 90], ['Prensa de piernas', 3, '12-15', 'Moderada', 90]] },
] as Array<{ name: string; group: string; items: Array<[string, number, string, string, number]> }>

const planB = [
  { name: 'Martes - Tren inferior', group: 'Piernas', items: [['Sentadilla con barra', 3, '10-12', 'Liviana', 90], ['Prensa de piernas', 3, '12', 'Moderada', 75], ['Peso muerto rumano', 3, '10-12', 'Liviana', 75]] },
  { name: 'Jueves - Tren superior', group: 'Pecho, Espalda y Hombros', items: [['Press inclinado con mancuernas', 3, '10', 'Moderada', 75], ['Jalón al pecho', 3, '10-12', 'Moderada', 75], ['Press militar', 3, '10', 'Liviana', 75], ['Remo con barra', 3, '12', 'Liviana', 75]] },
  { name: 'Sábado - Cuerpo completo', group: 'Piernas, Pecho y Brazos', items: [['Prensa de piernas', 3, '15', 'Moderada', 75], ['Press banca con barra', 3, '10', 'Liviana', 75], ['Curl martillo', 3, '12', 'Liviana', 60], ['Extensión de tríceps en polea', 3, '12', 'Liviana', 60]] },
] as Array<{ name: string; group: string; items: Array<[string, number, string, string, number]> }>

const baseMeals: Meal[] = [
  { name: 'Desayuno', items: [['Avena', '60 g', 60], ['Leche descremada', '250 ml', 250], ['Banana', '1 unidad', 120]] },
  { name: 'Almuerzo', items: [['Pechuga de pollo', '180 g', 180], ['Arroz blanco cocido', '150 g', 150], ['Brócoli', '150 g', 150], ['Aceite de oliva', '1 cucharada', 10]] },
  { name: 'Merienda', items: [['Yogur natural', '1 pote', 190], ['Almendras', '1 puñado', 25], ['Manzana', '1 unidad', 160]] },
  { name: 'Cena', items: [['Carne vacuna magra', '160 g', 160], ['Batata', '200 g', 200], ['Brócoli', '120 g', 120], ['Palta', '1/2 unidad', 70]] },
]
const alternateMeals: Meal[] = [
  { name: 'Desayuno', items: [['Pan integral', '2 rebanadas', 70], ['Huevos', '2 unidades', 100], ['Manzana', '1 unidad', 160]] },
  { name: 'Almuerzo', items: [['Atún en lata al agua', '1 lata', 120], ['Arroz blanco cocido', '180 g', 180], ['Brócoli', '150 g', 150], ['Aceite de oliva', '1 cucharada', 10]] },
  { name: 'Merienda', items: [['Yogur natural', '1 pote', 190], ['Banana', '1 unidad', 120], ['Almendras', '20 g', 20]] },
  { name: 'Cena', items: [['Pechuga de pollo', '180 g', 180], ['Batata', '200 g', 200], ['Palta', '1/2 unidad', 70]] },
]
const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const client = await pool.connect()
try {
  await client.query('BEGIN')
  const { exerciseIds, foodIds } = await catalog(client)
  const santiago = await member(client, { id: '10000000-0000-4000-8000-000000000001', first: 'Santiago', last: 'Navarro', dni: '30123456', phone: '11 5555-0101', birth: '1992-04-18', weight: 82, objective: 'Ganar fuerza y masa muscular' })
  const valentina = await member(client, { id: '10000000-0000-4000-8000-000000000002', first: 'Valentina', last: 'Ruiz', dni: '32987654', phone: '11 5555-0102', birth: '1995-08-27', weight: 64, objective: 'Mejorar composición corporal y resistencia' })
  await trainingPlan(client, '20000000-0000-4000-8000-000000000001', santiago, 'Fuerza e hipertrofia - 4 semanas', 'Progresar cargas manteniendo una técnica sólida.', planA, exerciseIds)
  await trainingPlan(client, '20000000-0000-4000-8000-000000000002', valentina, 'Acondicionamiento general - 4 semanas', 'Mejorar fuerza general y tolerancia al entrenamiento.', planB, exerciseIds)
  const daysA = dayNames.map((name, index) => ({ name, meals: index % 2 ? alternateMeals : baseMeals }))
  const daysB = dayNames.map((name, index) => ({ name, meals: index % 2 ? baseMeals : alternateMeals }))
  await diet(client, '30000000-0000-4000-8000-000000000001', santiago, 'Plan alimentario para ganancia muscular', 'Alimentación variada con aporte suficiente de proteínas y energía.', daysA, foodIds)
  await diet(client, '30000000-0000-4000-8000-000000000002', valentina, 'Plan alimentario equilibrado', 'Organizar comidas completas para acompañar el entrenamiento.', daysB, foodIds)
  await client.query('COMMIT')
  console.log('Datos demo creados: 2 alumnos, 2 rutinas, 2 dietas, 12 ejercicios y 16 alimentos.')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
