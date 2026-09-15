import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from 'lucide-react'
import App from './App'
import logo from './assets/legado-mark.svg'
import './Login.css'

type Admin = { id: string; username: string; name: string; role: 'ADMIN' | 'TRAINER' }

export function AuthGate() {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [gym, setGym] = useState<{ name: string; logoDataUrl: string | null }>({ name: 'Legado Gym', logoDataUrl: null })

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => {
      if (response.ok) setAdmin(await response.json())
    }).catch(() => setError('No se pudo conectar con el servidor.')).finally(() => setChecking(false))
  }, [])

  useEffect(() => { fetch('/api/public/gym').then((response) => response.ok ? response.json() : null).then((value) => { if (value) setGym(value) }).catch(() => {}) }, [])

  useEffect(() => {
    const expired = () => setAdmin(null)
    window.addEventListener('legado:session-expired', expired)
    return () => window.removeEventListener('legado:session-expired', expired)
  }, [])

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Legado-Request': '1' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión')
      setPassword(''); setAdmin(data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión') }
    finally { setBusy(false) }
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Legado-Request': '1' } }) }
    catch { /* La sesión local se cierra aun si la red falla. */ }
    finally { setAdmin(null) }
  }

  if (checking) return <div className="auth-loading">Cargando Legado Gym…</div>
  if (admin) return <App username={admin.username} role={admin.role} onLogout={() => void logout()} />
  return <div className="login-page"><div className="login-glow" /><div className="login-card"><div className="login-brand"><img src={gym.logoDataUrl || logo} alt={`Logo de ${gym.name}`} /><strong>{gym.name.toUpperCase()}</strong><small>PANEL DE GESTIÓN</small></div><div className="login-copy"><span>ACCESO ADMINISTRATIVO</span><h1>Bienvenido de nuevo<span>.</span></h1><p>Ingresá tus credenciales para administrar el gimnasio.</p></div><form onSubmit={(event) => void login(event)}><label htmlFor="username">Usuario</label><div className="login-input"><UserRound size={18} /><input id="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Tu usuario" /></div><label htmlFor="password">Contraseña</label><div className="login-input"><LockKeyhole size={18} /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{error && <p className="login-error" role="alert">{error}</p>}<button className="login-submit" disabled={busy}>{busy ? 'Ingresando…' : <>Ingresar al panel <LogIn size={17} /></>}</button></form><div className="login-footer">{gym.name.toUpperCase()} · FUERZA EN CADA PASO</div></div></div>
}
