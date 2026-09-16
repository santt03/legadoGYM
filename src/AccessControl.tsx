import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock3, Delete, KeyRound, RotateCcw, Search, ShieldAlert, UserX, XCircle } from 'lucide-react'
import './AccessControl.css'

type Eligibility = {
  found: boolean
  eligible: boolean
  reason: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'NOT_STARTED' | 'NOT_FOUND'
  memberId?: string
  memberName?: string
  startDate?: string
  endDate?: string
}
type Entry = Eligibility & { id: string; dni: string; checkedAt: string }

const labels = {
  ACTIVE: ['Cuota al día', 'Puede ingresar'],
  EXPIRED: ['Cuota vencida', 'Derivar a recepción'],
  INACTIVE: ['Socio inactivo', 'Derivar a recepción'],
  NOT_STARTED: ['Membresía pendiente', 'Todavía no comenzó'],
  NOT_FOUND: ['DNI no encontrado', 'Revisá el número ingresado'],
} as const

function date(value?: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function sound(ok: boolean) {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = ok ? 720 : 210
  gain.gain.setValueAtTime(0.09, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (ok ? 0.16 : 0.3))
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (ok ? 0.16 : 0.3))
}

export function AccessControl({ onRenew }: { onRenew: (memberId: string) => void }) {
  const [dni, setDni] = useState('')
  const [result, setResult] = useState<Eligibility | null>(null)
  const [history, setHistory] = useState<Entry[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('legado-access-history') || '[]') as Entry[]
      return saved.filter((entry) => new Date(entry.checkedAt).toDateString() === new Date().toDateString()).slice(0, 30)
    } catch { return [] }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const focus = () => window.setTimeout(() => input.current?.focus(), 20)
  useEffect(() => { focus() }, [])
  useEffect(() => {
    if (!result) return
    const timer = window.setTimeout(() => { setResult(null); setDni(''); setError(''); focus() }, 8000)
    return () => window.clearTimeout(timer)
  }, [result])

  async function check() {
    if (!/^[0-9]{7,8}$/.test(dni)) { setError('Ingresá un DNI de 7 u 8 números.'); focus(); return }
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/members/eligibility?dni=${dni}`)
      if (!response.ok) throw new Error('No se pudo consultar el DNI')
      const value = await response.json() as Eligibility
      const entry = { ...value, id: crypto.randomUUID(), dni, checkedAt: new Date().toISOString() }
      const next = [entry, ...history].slice(0, 30)
      setHistory(next); localStorage.setItem('legado-access-history', JSON.stringify(next)); setResult(value); sound(value.eligible)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo consultar el DNI') }
    finally { setBusy(false); focus() }
  }

  function reset() { setDni(''); setResult(null); setError(''); focus() }
  return <div className="access-page">
    <div className="heading access-heading"><div><small>RECEPCIÓN ━━━</small><h1>Control de acceso<em>.</em></h1><p>El socio ingresa su DNI y presiona Enter.</p></div><div className="access-online"><i /> Sistema listo</div></div>
    <div className="access-layout">
      <section className="panel access-terminal" onClick={focus}>
        {!result ? <>
          <div className="access-symbol"><KeyRound size={34} /></div>
          <h2>Ingresá tu DNI</h2><p>Sin puntos ni espacios</p>
          <form onSubmit={(event) => { event.preventDefault(); void check() }}>
            <div className="dni-entry"><input ref={input} autoFocus inputMode="numeric" autoComplete="off" aria-label="DNI para controlar acceso" maxLength={8} value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, ''))} placeholder="00 000 000" /><button type="button" aria-label="Borrar último número" onClick={() => setDni((value) => value.slice(0, -1))}><Delete size={24} /></button></div>
            {error && <div className="access-error"><ShieldAlert size={17} />{error}</div>}
            <button className="button primary access-check" disabled={busy || dni.length < 7}><Search size={18} /> {busy ? 'Consultando…' : 'Consultar cuota'}</button>
          </form>
        </> : <div className={`access-result ${result.eligible ? 'allowed' : 'denied'}`}>
          <div className="result-icon">{result.eligible ? <CheckCircle2 size={52} /> : result.reason === 'NOT_FOUND' ? <UserX size={52} /> : <XCircle size={52} />}</div>
          <small>{labels[result.reason][1]}</small><h2>{labels[result.reason][0]}</h2>
          {result.memberName && <strong>{result.memberName}</strong>}
          {result.endDate && <p>Vencimiento <b>{date(result.endDate)}</b></p>}
          <div className="result-actions"><button className="button secondary" onClick={reset}>Nueva consulta</button>{!result.eligible && result.memberId && <button className="button primary" onClick={() => onRenew(result.memberId!)}><RotateCcw size={16} /> Renovar cuota</button>}</div>
        </div>}
      </section>
      <section className="panel access-history"><div className="panel-head"><div><small>REGISTRO LOCAL</small><h2>Ingresos de hoy</h2></div><span>{history.length}</span></div>
        {history.length ? <div className="access-entries">{history.map((entry) => <div className="access-entry" key={entry.id}><span className={entry.eligible ? 'entry-dot allowed' : 'entry-dot denied'}>{entry.eligible ? <CheckCircle2 size={16} /> : <XCircle size={16} />}</span><div><strong>{entry.memberName || `DNI ${entry.dni}`}</strong><small>{labels[entry.reason][0]} · termina en {entry.dni.slice(-3)}</small></div><time><Clock3 size={13} />{new Date(entry.checkedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div> : <div className="empty"><Clock3 size={30} /><strong>Todavía no hay consultas</strong><p>Los controles realizados hoy aparecerán aquí.</p></div>}
      </section>
    </div>
  </div>
}
