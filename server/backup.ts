import 'dotenv/config'
import { existsSync } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
const database = new URL(process.env.DATABASE_URL)
const bin = process.env.PG_BIN_DIR || (process.platform === 'win32' && existsSync('C:\\Program Files\\PostgreSQL\\18\\bin') ? 'C:\\Program Files\\PostgreSQL\\18\\bin' : '')
const executable = (name: string) => bin ? join(bin, process.platform === 'win32' ? `${name}.exe` : name) : name
const backupDir = join(process.cwd(), 'backups')
const filename = `legado-gym-${new Date().toISOString().replace(/[.:]/g, '-')}.dump`
const output = join(backupDir, filename)
const env = {
  ...process.env,
  PGHOST: database.hostname,
  PGPORT: database.port || '5432',
  PGUSER: decodeURIComponent(database.username),
  PGPASSWORD: decodeURIComponent(database.password),
  PGDATABASE: decodeURIComponent(database.pathname.slice(1)),
}

await mkdir(backupDir, { recursive: true })
try {
  await run(executable('pg_dump'), ['--format=custom', '--no-owner', '--no-privileges', `--file=${output}`], { env })
  await run(executable('pg_restore'), ['--list', output], { env })
  const size = (await stat(output)).size
  if (size < 1024) throw new Error('El archivo de respaldo es demasiado pequeño')
  console.log(`Respaldo verificado: ${output} (${size} bytes)`)
} catch (error) {
  await rm(output, { force: true })
  throw error
}
