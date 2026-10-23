import { useEffect, useState } from 'react'
import { Bell, Plus, Trash2 } from 'lucide-react'

type Announcement = { id: string; title: string; body: string; kind: string; startsAt: string; endsAt: string | null; active: boolean }
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Legado-Request': '1', ...options?.headers } })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'No se pudo completar la operación')
  return response.status === 204 ? undefined as T : response.json()
}
export function Announcements({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState('INFO')
  const [error, setError] = useState('')
  const load = () => api<Announcement[]>('/announcements').then(setItems).catch(() => setError('No se pudieron cargar las novedades.'))
  useEffect(() => { void load() }, [])
  async function publish(event: React.FormEvent) {
    event.preventDefault(); setError('')
    try { const created = await api<Announcement>('/announcements', { method: 'POST', body: JSON.stringify({ title, body, kind }) }); setItems((current) => [created, ...current]); setTitle(''); setBody('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo publicar') }
  }
  async function remove(id: string) { await api(`/announcements/${id}`, { method: 'DELETE' }); setItems((current) => current.filter((item) => item.id !== id)) }
  return <section className="panel"><div className="panel-head"><div><small>COMUNICACIÓN</small><h2>Novedades para alumnos</h2></div></div>{enabled && <form onSubmit={(event) => void publish(event)} className="announcement-form"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required placeholder="Ej. Feriado: horarios especiales" /><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} required placeholder="Escribí el mensaje que verán los alumnos…" /><div><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="INFO">Información</option><option value="SCHEDULE">Horarios</option><option value="HOLIDAY">Feriado</option><option value="PLAN">Planes</option></select><button className="button primary"><Plus size={16}/> Publicar</button></div></form>}{error && <p className="form-error">{error}</p>}<div className="announcement-list">{items.length ? items.map((item) => <article key={item.id}><Bell size={16}/><div><strong>{item.title}</strong><p>{item.body}</p></div>{enabled && <button aria-label={`Eliminar ${item.title}`} onClick={() => void remove(item.id)}><Trash2 size={16}/></button>}</article>) : <div className="empty">Todavía no hay novedades publicadas.</div>}</div></section>
}
