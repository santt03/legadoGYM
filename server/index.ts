import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import app from './app.js'

// En desarrollo y en Tauri, el servidor Node también entrega la web compilada.
app.use('/assets/*', serveStatic({ root: './dist' }))
app.get('/', serveStatic({ path: './dist/index.html' }))

serve({ fetch: app.fetch, port: Number(process.env.API_PORT || 3001), hostname: '127.0.0.1' }, (info) => {
  console.log(`API de Legado Gym en http://localhost:${info.port}`)
})
