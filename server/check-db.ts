import { pool } from './db.js'

try {
  const client = await pool.connect()
  const result = await client.query<{
    database: string
    user_name: string
    server_version: string
  }>(`
    SELECT
      current_database() AS database,
      current_user AS user_name,
      current_setting('server_version') AS server_version
  `)
  const connection = result.rows[0]
  if (!connection) throw new Error('PostgreSQL no devolvió información de la conexión')
  const transport = client as unknown as { connection?: { stream?: { encrypted?: boolean } } }
  const encrypted = transport.connection?.stream?.encrypted === true
  client.release()
  console.log(`Conexión correcta: base=${connection.database}, usuario=${connection.user_name}, PostgreSQL=${connection.server_version}, TLS=${encrypted ? 'sí' : 'no'}`)
} finally {
  await pool.end()
}
