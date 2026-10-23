import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthGate } from './AuthGate.tsx'
import { StudentGate } from './StudentApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.startsWith('/alumno') ? <StudentGate /> : <AuthGate />}
  </StrictMode>,
)

window.setTimeout(() => {
  const splash = document.getElementById('pwa-splash')
  splash?.classList.add('pwa-splash--hidden')
  window.setTimeout(() => splash?.remove(), 300)
}, 250)
