import { readFile } from 'node:fs/promises'
import { GYM_ID, pool } from './db.js'
import { hashPassword } from './auth.js'

if (!process.env.DATABASE_URL) {
  console.error('Definí DATABASE_URL antes de ejecutar db:setup')
  process.exit(1)
}

try {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
  const membersWithoutAccount = await pool.query<{ id: string; dni: string; first_name: string; last_name: string }>(
    `SELECT m.id,m.dni,m.first_name,m.last_name FROM members m
     LEFT JOIN users u ON u.member_id=m.id
     WHERE m.gym_id=$1 AND m.dni IS NOT NULL AND u.id IS NULL`, [GYM_ID],
  )
  const initialPassword = process.env.MEMBER_INITIAL_PASSWORD || 'legado2026'
  for (const member of membersWithoutAccount.rows) {
    await pool.query(
      `INSERT INTO users (id,gym_id,username,name,role,member_id,password_hash,force_password_change)
       VALUES ($1,$2,$3,$4,'MEMBER',$5,$6,true) ON CONFLICT (username) DO NOTHING`,
      [crypto.randomUUID(), GYM_ID, member.dni, `${member.first_name} ${member.last_name}`, member.id, await hashPassword(initialPassword)],
    )
  }
  console.log('Base de datos de Legado Gym preparada')
} finally {
  await pool.end()
}
