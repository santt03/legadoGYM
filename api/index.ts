import app from '../server/app.js'

// Vercel detecta este export como una única Function y Hono resuelve las rutas /api/*.
export default app
