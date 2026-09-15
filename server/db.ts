import 'dotenv/config'
import pg from 'pg'

// PostgreSQL DATE representa un día de calendario, no un instante con zona horaria.
pg.types.setTypeParser(1082, (value) => value)

export const GYM_ID = '00000000-0000-4000-8000-000000000001'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Falta DATABASE_URL. Configurá la cadena de conexión de PostgreSQL en .env.')
}

const database = new URL(connectionString)
const isSupabase = database.hostname.endsWith('.supabase.co') || database.hostname.endsWith('.supabase.com')

if (isSupabase) {
  if (!database.searchParams.has('sslmode')) database.searchParams.set('sslmode', 'require')
  if (!database.searchParams.has('uselibpqcompat')) database.searchParams.set('uselibpqcompat', 'true')
}

export const pool = new pg.Pool({
  connectionString: database.toString(),
  options: '-c timezone=America/Argentina/Buenos_Aires',
  // Cada instancia serverless conserva su propio pool; una conexión evita agotar Supavisor.
  max: process.env.VERCEL === '1' ? 1 : 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
})

pool.on('error', (error) => {
  console.error('Se perdió una conexión inactiva con PostgreSQL:', error.message)
})
