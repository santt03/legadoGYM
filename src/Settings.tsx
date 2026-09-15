import { useEffect, useState } from 'react'
import { Apple, DatabaseBackup, Download, Dumbbell, ImagePlus, Pencil, Plus, Save, Settings2, Trash2, Users, X } from 'lucide-react'
import { useConfirmDialog } from './useConfirmDialog'
import fallbackLogo from './assets/legado-mark.svg'
import './Settings.css'

export type GymSettings = { name: string; logoDataUrl: string | null; defaultMembershipMonths: 1 | 3 | 6 | 12 }
type StaffUser = { id: string; username: string; name: string; role: 'ADMIN' | 'TRAINER'; createdAt: string }
type Backup = { name: string; size: number; createdAt: string }
type BackupResponse = { available: boolean; files: Backup[] }
type StaffDraft = { username: string; name: string; role: 'ADMIN' | 'TRAINER'; password: string }

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/settings${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Legado-Request': '1', ...options?.headers } })
  if (response.status === 401) window.dispatchEvent(new Event('legado:session-expired'))
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'No se pudo completar la operación') }
  return response.status === 204 ? undefined as T : response.json()
}

export function Settings({ value, onSaved, onOpenCatalog }: { value: GymSettings; onSaved: (value: GymSettings) => void; onOpenCatalog: (area: 'training' | 'food') => void }) {
  const { confirm, dialog } = useConfirmDialog()
  const [gym, setGym] = useState(value)
  const [users, setUsers] = useState<StaffUser[]>([])
  const [backups, setBackups] = useState<Backup[]>([])
  const [backupsAvailable, setBackupsAvailable] = useState(true)
  const [staffForm, setStaffForm] = useState<StaffUser | 'new' | null>(null)
  const [staffDraft, setStaffDraft] = useState<StaffDraft>({ username: '', name: '', role: 'TRAINER', password: '' })
  const [busy, setBusy] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([api<StaffUser[]>('/users'), api<BackupResponse>('/backups')])
      .then(([staff, backupState]) => { setUsers(staff); setBackups(backupState.files); setBackupsAvailable(backupState.available) })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración'))
  }, [])

  async function selectLogo(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 750_000) { setError('Elegí una imagen PNG, JPG o WebP de hasta 750 KB.'); return }
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
    setGym((current) => ({ ...current, logoDataUrl: dataUrl })); setError('')
  }
  async function saveGym() {
    setBusy(true); setError(''); setNotice('')
    try { const saved = await api<GymSettings>('', { method: 'PUT', body: JSON.stringify(gym) }); setGym(saved); onSaved(saved); setNotice('Datos del gimnasio guardados.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  function beginStaff(user?: StaffUser) {
    setStaffForm(user || 'new')
    setStaffDraft(user ? { username: user.username, name: user.name, role: user.role, password: '' } : { username: '', name: '', role: 'TRAINER', password: '' })
    setError('')
  }
  async function saveStaff() {
    setBusy(true); setError(''); setNotice('')
    try {
      const existing = staffForm && staffForm !== 'new' ? staffForm : null
      await api(existing ? `/users/${existing.id}` : '/users', { method: existing ? 'PUT' : 'POST', body: JSON.stringify(staffDraft) })
      setUsers(await api<StaffUser[]>('/users')); setStaffForm(null); setNotice('Usuario guardado. Si cambiaste tu contraseña o rol, iniciá sesión nuevamente.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el usuario') }
    finally { setBusy(false) }
  }
  async function deleteStaff(user: StaffUser) {
    if (!await confirm('¿Eliminar entrenador?', `Se eliminará el acceso de ${user.name} (${user.username}).`)) return
    try { await api<void>(`/users/${user.id}`, { method: 'DELETE' }); setUsers(await api<StaffUser[]>('/users')); setNotice('Entrenador eliminado.'); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el usuario') }
  }
  async function createBackup() {
    setBackupBusy(true); setError(''); setNotice('')
    try { const created = await api<Backup>('/backups', { method: 'POST' }); setBackups((current) => [created, ...current]); setNotice('Respaldo creado y verificado. Descargalo y guardalo en otra unidad.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el respaldo') }
    finally { setBackupBusy(false) }
  }

  return <div className="settings-page">
    {dialog}
    <div className="heading"><div><small>ADMINISTRACIÓN ━━━</small><h1>Configuración<em>.</em></h1><p>Datos del gimnasio, equipo, membresías y respaldos.</p></div></div>
    {error && <div className="alert" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}
    {notice && <div className="plan-notice" role="status">{notice}</div>}
    <div className="settings-grid">
      <section className="panel settings-card"><div className="settings-card-title"><Settings2 size={20} /><div><small>IDENTIDAD</small><h2>Gimnasio</h2></div></div><div className="settings-logo-row"><img src={gym.logoDataUrl || fallbackLogo} alt="Logo del gimnasio" /><div><label className="button secondary settings-file"><ImagePlus size={16} /> Cambiar logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectLogo(event.target.files?.[0])} /></label>{gym.logoDataUrl && <button className="settings-text-button" onClick={() => setGym({ ...gym, logoDataUrl: null })}>Usar logo original</button>}<small>PNG, JPG o WebP · máximo 750 KB</small></div></div><label className="settings-label">Nombre del gimnasio<input maxLength={100} value={gym.name} onChange={(event) => setGym({ ...gym, name: event.target.value })} /></label><label className="settings-label">Duración inicial de membresía<select value={gym.defaultMembershipMonths} onChange={(event) => setGym({ ...gym, defaultMembershipMonths: Number(event.target.value) as GymSettings['defaultMembershipMonths'] })}>{([1, 3, 6, 12] as const).map((months) => <option key={months} value={months}>{months} {months === 1 ? 'mes' : 'meses'}</option>)}</select></label><p className="settings-help">Se aplicará a los socios nuevos. Las renovaciones siguen permitiendo elegir la duración.</p><button className="button primary" disabled={busy || !gym.name.trim()} onClick={() => void saveGym()}><Save size={16} /> {busy ? 'Guardando…' : 'Guardar ajustes'}</button></section>
      <section className="panel settings-card"><div className="settings-card-title"><Users size={20} /><div><small>ACCESOS</small><h2>Usuarios y permisos</h2></div></div><p className="settings-help">Los administradores gestionan socios, usuarios y respaldos. Los entrenadores crean y editan planes y catálogos.</p><div className="settings-users">{users.map((user) => <div className="settings-user" key={user.id}><div><strong>{user.name}</strong><small>@{user.username} · {user.role === 'ADMIN' ? 'Administrador' : 'Entrenador'}</small></div><button className="icon" aria-label={`Editar ${user.username}`} onClick={() => beginStaff(user)}><Pencil size={15} /></button>{user.role === 'TRAINER' && <button className="icon danger-icon" aria-label={`Eliminar ${user.username}`} onClick={() => void deleteStaff(user)}><Trash2 size={15} /></button>}</div>)}</div><button className="button secondary" onClick={() => beginStaff()}><Plus size={16} /> Agregar usuario</button></section>
      <section className="panel settings-card"><div className="settings-card-title"><Dumbbell size={20} /><div><small>CATÁLOGOS</small><h2>Organización</h2></div></div><p className="settings-help">Administrá los grupos y elementos que aparecen al crear rutinas y dietas.</p><button className="settings-link" onClick={() => onOpenCatalog('training')}><Dumbbell size={17} /><span>Ejercicios y grupos musculares</span><span>Ir →</span></button><button className="settings-link" onClick={() => onOpenCatalog('food')}><Apple size={17} /><span>Alimentos y grupos de alimentos</span><span>Ir →</span></button></section>
      <section className="panel settings-card"><div className="settings-card-title"><DatabaseBackup size={20} /><div><small>SEGURIDAD DE DATOS</small><h2>Respaldos</h2></div></div>{backupsAvailable ? <><p className="settings-help">Generá una copia verificada de PostgreSQL y descargala. Guardá otra copia fuera de esta computadora.</p><button className="button primary" disabled={backupBusy} onClick={() => void createBackup()}><DatabaseBackup size={16} /> {backupBusy ? 'Creando respaldo…' : 'Crear respaldo'}</button><div className="settings-backups">{backups.map((backup) => <div className="settings-backup" key={backup.name}><div><strong>{new Date(backup.createdAt).toLocaleString('es-AR')}</strong><small>{(backup.size / 1024 / 1024).toFixed(2)} MB · {backup.name}</small></div><a className="icon" title="Descargar respaldo" aria-label={`Descargar ${backup.name}`} href={`/api/settings/backups/${encodeURIComponent(backup.name)}`}><Download size={16} /></a></div>)}{!backups.length && <p className="settings-help">Todavía no hay respaldos en este equipo.</p>}</div></> : <p className="settings-help">La base web está alojada en Supabase. Administrá sus copias de seguridad desde el panel del proyecto de Supabase.</p>}</section>
    </div>
    {staffForm && <div className="backdrop" onMouseDown={() => setStaffForm(null)}><div className="modal settings-staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><small>USUARIOS</small><h2 id="staff-title">{staffForm === 'new' ? 'Nuevo usuario' : 'Editar usuario'}</h2></div><button className="icon" aria-label="Cerrar" onClick={() => setStaffForm(null)}><X size={18} /></button></div><form onSubmit={(event) => { event.preventDefault(); void saveStaff() }}><label>Nombre<input required minLength={2} maxLength={100} value={staffDraft.name} onChange={(event) => setStaffDraft({ ...staffDraft, name: event.target.value })} /></label><label>Usuario<input required minLength={3} maxLength={80} pattern="[a-zA-Z0-9._-]+" disabled={staffForm !== 'new'} value={staffDraft.username} onChange={(event) => setStaffDraft({ ...staffDraft, username: event.target.value })} /></label><label>Rol<select value={staffDraft.role} onChange={(event) => setStaffDraft({ ...staffDraft, role: event.target.value as StaffDraft['role'] })}><option value="TRAINER">Entrenador</option><option value="ADMIN">Administrador</option></select></label><label>{staffForm === 'new' ? 'Contraseña' : 'Nueva contraseña (opcional)'}<input type="password" autoComplete="new-password" minLength={12} maxLength={200} required={staffForm === 'new'} value={staffDraft.password} onChange={(event) => setStaffDraft({ ...staffDraft, password: event.target.value })} /></label><p className="settings-help">La contraseña debe tener al menos 12 caracteres. Cambiarla cierra las sesiones de ese usuario.</p>{error && <div className="alert" role="alert">{error}</div>}<div className="actions"><button type="button" className="button secondary" onClick={() => setStaffForm(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar usuario'}</button></div></form></div></div>}
  </div>
}
