import { pool, GYM_ID } from './db.js'
import { hashPassword } from './auth.js'

const username = process.env.STAFF_USERNAME?.trim()
const password = process.env.STAFF_PASSWORD
const name = process.env.STAFF_NAME?.trim() || 'Entrenador'

if (!username || !/^[a-zA-Z0-9._-]{3,80}$/.test(username) || !password || password.length < 12) {
  console.error('Definí STAFF_USERNAME y STAFF_PASSWORD (al menos 12 caracteres) en .env.')
  process.exit(1)
}

try {
  const passwordHash = await hashPassword(password)
  const result = await pool.query(
    `INSERT INTO users (id,gym_id,username,password_hash,name,role)
     VALUES ($1,$2,$3,$4,$5,'TRAINER')
     ON CONFLICT (username) DO UPDATE SET password_hash=excluded.password_hash,name=excluded.name
     WHERE users.role='TRAINER' AND users.gym_id=excluded.gym_id`,
    [crypto.randomUUID(), GYM_ID, username, passwordHash, name],
  )
  if (!result.rowCount) throw new Error('El nombre de usuario ya pertenece a otro rol')
  await pool.query('DELETE FROM admin_sessions WHERE user_id IN (SELECT id FROM users WHERE username=$1 AND gym_id=$2)', [username, GYM_ID])
  console.log(`Entrenador ${username} creado o actualizado.`)
} finally { await pool.end() }
