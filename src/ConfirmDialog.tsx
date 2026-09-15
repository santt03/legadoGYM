import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import './ConfirmDialog.css'

export function ConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])
  return <div className="confirm-backdrop" onMouseDown={onCancel}>
    <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onMouseDown={(event) => event.stopPropagation()}>
      <button className="confirm-close" type="button" aria-label="Cancelar eliminación" onClick={onCancel}><X size={18} /></button>
      <div className="confirm-icon"><AlertTriangle size={24} /></div>
      <small>CONFIRMAR ELIMINACIÓN</small>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <div className="confirm-actions"><button ref={cancelRef} type="button" className="button secondary" onClick={onCancel}>Cancelar</button><button type="button" className="button confirm-danger" onClick={onConfirm}><Trash2 size={16} /> Eliminar</button></div>
    </div>
  </div>
}
