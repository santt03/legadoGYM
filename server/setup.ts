import { readFile } from 'node:fs/promises'
import { pool } from './db.js'

if (!process.env.DATABASE_URL) {
  console.error('Definí DATABASE_URL antes de ejecutar db:setup')
  process.exit(1)
}

try {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
  console.log('Base de datos de Legado Gym preparada')
} finally {
  await pool.end()
}
