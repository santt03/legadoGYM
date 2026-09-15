import { useEffect, useRef } from 'react'
import { Apple, ClipboardList, Dumbbell, FileText, RotateCcw, Settings2, UserPlus, Users, X } from 'lucide-react'
import './UsageGuide.css'

const steps = [
  { icon: UserPlus, title: 'Registrar alumnos', text: 'Entrá en Socios y elegí Nuevo socio. Cargá nombre, DNI, teléfono, fechas de la membresía y, si están disponibles, nacimiento, peso y objetivo.' },
  { icon: RotateCcw, title: 'Controlar y renovar membresías', text: 'Los estados Activo, Por vencer, Vencido, Pendiente e Inactivo se calculan con las fechas. Abrí la ficha de un alumno y usá Renovar para agregar 1, 3, 6 o 12 meses.' },
  { icon: ClipboardList, title: 'Abrir el plan de un alumno', text: 'En Planes por alumno aparece una tarjeta por persona. Al abrirla vas a encontrar juntas todas sus rutinas y dietas, con acceso para crear, editar, previsualizar o eliminar.' },
  { icon: Dumbbell, title: 'Crear una rutina', text: 'Primero revisá el catálogo de ejercicios y grupos musculares. Después elegí el alumno, completá el objetivo y organizá los días y ejercicios de las cuatro semanas con series, repeticiones, carga y descanso.' },
  { icon: Apple, title: 'Crear una dieta', text: 'Organizá el catálogo por Proteínas, Carbohidratos, Grasas, Frutas, Verduras y Lácteos. Los macros se guardan por 100 g; indicá los gramos en la dieta para que el PDF calcule cada comida.' },
  { icon: FileText, title: 'Revisar y descargar PDF', text: 'Guardá los cambios antes de abrir Vista previa. Revisá datos, semanas, ejercicios o comidas y macros; si todo está correcto, descargá el PDF desde esa misma pantalla.' },
  { icon: Settings2, title: 'Configurar el gimnasio', text: 'Un administrador puede cambiar el nombre, logo y duración inicial de membresía, además de crear entrenadores. En la versión web, los respaldos de PostgreSQL se administran desde Supabase.' },
  { icon: Users, title: 'Usuarios y permisos', text: 'Los administradores controlan socios, renovaciones, usuarios y eliminaciones. Los entrenadores pueden consultar alumnos y preparar planes. Usá Salir cuando termines de trabajar.' },
]

export function UsageGuide({ role, onClose }: { role: 'ADMIN' | 'TRAINER'; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="guide-backdrop" onMouseDown={onClose}>
    <section className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="guide-header">
        <div><small>GUÍA DE USO</small><h2 id="guide-title">Cómo usar Legado Gym</h2><p>Un recorrido rápido por las tareas principales del panel.</p></div>
        <button ref={closeRef} className="guide-close" type="button" aria-label="Cerrar guía" onClick={onClose}><X size={20} /></button>
      </header>
      <div className="guide-start"><strong>Para empezar</strong><span>Creá el alumno → verificá su membresía → prepará su rutina y dieta → revisá los PDF.</span></div>
      <div className="guide-grid">{steps.map(({ icon: Icon, title, text }, index) => <article className="guide-step" key={title}>
        <div className="guide-step-icon"><Icon size={19} /><span>{index + 1}</span></div>
        <div><h3>{title}</h3><p>{text}</p></div>
      </article>)}</div>
      {role === 'TRAINER' && <p className="guide-role">Tu acceso es de entrenador. Algunas acciones administrativas no aparecerán en el panel.</p>}
      <footer><button className="button primary" type="button" onClick={onClose}>Entendido</button></footer>
    </section>
  </div>
}
