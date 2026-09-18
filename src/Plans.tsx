import { useEffect, useState } from 'react'
import { Apple, ArrowLeft, ChevronDown, ChevronRight, Download, Dumbbell, Eye, Pencil, Plus, Salad, Save, Search, Target, Trash2, Users, X } from 'lucide-react'
import { createPlanPdf, downloadPlanPdf } from './planPdf'
import { createDietPdf, downloadDietPdf } from './dietPdf'
import { useConfirmDialog } from './useConfirmDialog'
import './Plans.css'

type MemberOption = { id: string; firstName: string; lastName: string }
type MuscleGroup = { id: string; name: string; exerciseCount: number }
type Exercise = { id: string; name: string; muscleGroup: string; notes: string }
type Item = { id?: string; exerciseId: string; exerciseName?: string; sets: number; reps: string; load: string; restSeconds: number | null; notes: string }
type Day = { id?: string; name: string; muscleGroup: string; exercises: Item[] }
type Week = { weekNumber: number; days: Day[] }
type Plan = { id: string; memberId: string; name: string; objective: string; startDate: string; firstName: string; lastName: string; birthDate: string | null; weightKg: string | null; memberObjective: string; membershipStartDate: string; membershipEndDate: string; weeks: Week[] }
type PlanSummary = Omit<Plan, 'weeks'> & { dayCount: number; exerciseCount: number; createdAt: string }
type PlanInput = Pick<Plan, 'memberId' | 'name' | 'objective' | 'startDate' | 'weeks'>
type FoodGroup = { id: string; name: string; foodCount: number }
type Food = { id: string; name: string; groupId: string | null; groupName: string | null; calories: number; protein: number; carbs: number; fat: number; notes: string }
type DietItem = { id?: string; foodId: string; foodName?: string; quantity: string; grams: number | null; notes: string; calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null }
type DietMeal = { id?: string; name: string; items: DietItem[] }
type DietDay = { id?: string; name: string; meals: DietMeal[] }
type DietWeek = { weekNumber: number; days: DietDay[] }
type Diet = { id: string; memberId: string; name: string; objective: string; startDate: string; firstName: string; lastName: string; birthDate: string | null; weightKg: string | null; memberObjective: string; membershipStartDate: string; membershipEndDate: string; weeks: DietWeek[] }
type DietSummary = Omit<Diet, 'weeks'> & { dayCount: number; itemCount: number; createdAt: string }
type DietInput = Pick<Diet, 'memberId' | 'name' | 'objective' | 'startDate' | 'weeks'>
const normalizeGroup = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
const hasGroup = (value: string, group: string) => normalizeGroup(value).includes(normalizeGroup(group).replace(/s$/, ''))

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Legado-Request': '1', ...options?.headers } })
  if (response.status === 401) window.dispatchEvent(new Event('legado:session-expired'))
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'No se pudo completar la operación')
  }
  return response.status === 204 ? undefined as T : response.json()
}

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function addCalendarMonths(value: string, count: number) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + count, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target
}
function dietMonthPeriod(startDate: string, monthNumber: number) {
  const start = addCalendarMonths(startDate, monthNumber - 1)
  const end = addCalendarMonths(startDate, monthNumber)
  end.setUTCDate(end.getUTCDate() - 1)
  const format = (date: Date) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
  return `${format(start)} – ${format(end)}`
}
function pdfName(firstName: string, lastName: string, name: string, fallback: string) {
  const slug = `${firstName}-${lastName}-${name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)
  return `legado-gym-${slug || fallback}.pdf`
}
const emptyWeeks = (): Week[] => [{ weekNumber: 1, days: [] }]
const emptyItem = (exerciseId = '', exerciseName = ''): Item => ({ exerciseId, exerciseName, sets: 3, reps: '10', load: '', restSeconds: 60, notes: '' })
const emptyDietWeeks = (): DietWeek[] => [{ weekNumber: 1, days: [] }]
const emptyDietItem = (foodId = '', foodName = ''): DietItem => ({ foodId, foodName, quantity: '', grams: null, notes: '' })
const mealNames = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Colación']

function MacroLine({ value, label }: { value: { kcal: number; protein: number; carbs: number; fat: number } | null; label: string }) {
  if (!value) return null
  return <div className="macro-total"><small>{label}</small><span>≈ {value.kcal} kcal · P {value.protein} g · C {value.carbs} g · G {value.fat} g</span></div>
}

function FoodCatalog({ foods, groups, search, onSearch, filter, onFilter, onEdit, onDelete, onCreate, role }: {
  foods: Food[]; groups: FoodGroup[]; search: string; onSearch: (value: string) => void; filter: string; onFilter: (value: string) => void
  onEdit: (food: Food) => void; onDelete: (food: Food) => void; onCreate: () => void; role: 'ADMIN' | 'TRAINER'
}) {
  const visible = foods.filter((food) => (filter === 'all' || (filter === 'none' ? !food.groupId : food.groupId === filter)) && `${food.name} ${food.notes}`.toLocaleLowerCase('es-AR').includes(search.toLocaleLowerCase('es-AR')))
  const sections = [...groups.map((group) => ({ id: group.id, name: group.name })), { id: 'none', name: 'Sin grupo' }]
  return <section className="panel catalog food-catalog">
    <div className="toolbar"><div className="search"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar alimento…" /></div><span>{visible.length} alimentos</span></div>
    <div className="group-chips food-filter"><button className={filter === 'all' ? 'chip picked' : 'chip'} onClick={() => onFilter('all')}>Todos <span>{foods.length}</span></button>{sections.map((section) => { const count = foods.filter((food) => section.id === 'none' ? !food.groupId : food.groupId === section.id).length; return <button key={section.id} className={filter === section.id ? 'chip picked' : 'chip'} onClick={() => onFilter(section.id)}>{section.name} <span>{count}</span></button> })}</div>
    {sections.map((section) => {
      const items = visible.filter((food) => section.id === 'none' ? !food.groupId : food.groupId === section.id)
      return items.length ? <div className="food-section" key={section.id}><div className="food-section-title"><strong>{section.name}</strong><span>{items.length} alimento{items.length === 1 ? '' : 's'}</span></div>{items.map((food) => <div className="catalog-row" key={food.id}><div className="card-icon"><Apple size={17} /></div><div><strong>{food.name}</strong><small>{food.calories} kcal · P {food.protein} g · C {food.carbs} g · G {food.fat} g · cada 100 g{food.notes ? ` · ${food.notes}` : ''}</small></div><button className="icon" aria-label={`Editar ${food.name}`} onClick={() => onEdit(food)}><Pencil size={15} /></button>{role === 'ADMIN' && <button className="icon danger-icon" aria-label={`Eliminar ${food.name}`} onClick={() => onDelete(food)}><Trash2 size={15} /></button>}</div>)}</div> : null
    })}
    {!visible.length && <div className="empty"><Apple size={28} /><strong>{foods.length ? 'No hay alimentos en este grupo' : 'Todavía no hay alimentos'}</strong><button className="button primary" onClick={onCreate}><Plus size={15} /> Nuevo alimento</button></div>}
  </section>
}

function MemberPlanOverview({ members, plans, diets, role, onOpenPlan, onOpenDiet, onNewPlan, onNewDiet, onDeletePlan, onDeleteDiet }: {
  members: MemberOption[]; plans: PlanSummary[]; diets: DietSummary[]
  role: 'ADMIN' | 'TRAINER'
  onOpenPlan: (id: string) => void; onOpenDiet: (id: string) => void
  onNewPlan: (memberId: string) => void; onNewDiet: (memberId: string) => void
  onDeletePlan: (plan: PlanSummary) => void; onDeleteDiet: (diet: DietSummary) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const filtered = members.filter((member) => `${member.firstName} ${member.lastName}`.toLocaleLowerCase('es-AR').includes(query.trim().toLocaleLowerCase('es-AR')))
  const selectedMember = members.find((member) => member.id === selectedMemberId)
  const memberPlans = selectedMember ? plans.filter((plan) => plan.memberId === selectedMember.id) : []
  const memberDiets = selectedMember ? diets.filter((diet) => diet.memberId === selectedMember.id) : []
  return <div className="member-plans">
    {selectedMember ? <>
      <button className="plan-back member-plan-back" onClick={() => setSelectedMemberId(null)}><ArrowLeft size={17} /> Volver a alumnos</button>
      <section className="panel member-plan-card">
        <div className="member-plan-header"><div className="member-plan-avatar">{selectedMember.firstName.charAt(0)}{selectedMember.lastName.charAt(0)}</div><div><h2>{selectedMember.firstName} {selectedMember.lastName}</h2><p>{memberPlans.length} rutina{memberPlans.length === 1 ? '' : 's'} · {memberDiets.length} dieta{memberDiets.length === 1 ? '' : 's'}</p></div></div>
        <div className="member-plan-columns">
          <div className="member-plan-column"><div className="member-plan-column-title"><Dumbbell size={17} /><strong>Rutinas</strong><span>{memberPlans.length}</span></div>{memberPlans.length ? memberPlans.map((plan) => <div className="member-plan-row" key={plan.id}><button className="member-plan-entry" onClick={() => onOpenPlan(plan.id)}><span><strong>{plan.name}</strong><small>{plan.dayCount} días · {plan.exerciseCount} ejercicios</small></span><ChevronRight size={17} /></button>{role === 'ADMIN' && <button className="icon danger-icon member-plan-delete" aria-label={`Eliminar rutina ${plan.name}`} title="Eliminar rutina" onClick={() => onDeletePlan(plan)}><Trash2 size={16} /></button>}</div>) : <p className="member-plan-empty">Sin rutinas asignadas.</p>}<button className="member-plan-create" onClick={() => onNewPlan(selectedMember.id)}><Plus size={15} /> Nueva rutina</button></div>
          <div className="member-plan-column"><div className="member-plan-column-title"><Salad size={17} /><strong>Dietas</strong><span>{memberDiets.length}</span></div>{memberDiets.length ? memberDiets.map((diet) => <div className="member-plan-row" key={diet.id}><button className="member-plan-entry" onClick={() => onOpenDiet(diet.id)}><span><strong>{diet.name}</strong><small>{diet.dayCount} días · {diet.itemCount} alimentos</small></span><ChevronRight size={17} /></button>{role === 'ADMIN' && <button className="icon danger-icon member-plan-delete" aria-label={`Eliminar dieta ${diet.name}`} title="Eliminar dieta" onClick={() => onDeleteDiet(diet)}><Trash2 size={16} /></button>}</div>) : <p className="member-plan-empty">Sin dietas asignadas.</p>}<button className="member-plan-create" onClick={() => onNewDiet(selectedMember.id)}><Plus size={15} /> Nueva dieta</button></div>
        </div>
      </section>
    </> : <>
      <div className="toolbar member-plans-toolbar"><div className="search"><Search size={17} /><input aria-label="Buscar alumno" placeholder="Buscar alumno…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span>{filtered.length} alumnos</span></div>
      {filtered.length ? <div className="member-plan-list">{filtered.map((member) => {
        const planCount = plans.filter((plan) => plan.memberId === member.id).length
        const dietCount = diets.filter((diet) => diet.memberId === member.id).length
        return <button className="panel member-plan-selector" key={member.id} onClick={() => setSelectedMemberId(member.id)}><span className="member-plan-avatar">{member.firstName.charAt(0)}{member.lastName.charAt(0)}</span><span className="member-plan-selector-text"><strong>{member.firstName} {member.lastName}</strong><small>{planCount} rutina{planCount === 1 ? '' : 's'} · {dietCount} dieta{dietCount === 1 ? '' : 's'}</small></span><ChevronRight size={18} /></button>
      })}</div> : <div className="panel plan-empty"><Users size={32} /><h2>{members.length ? 'No se encontraron alumnos' : 'Todavía no hay alumnos'}</h2><p>{members.length ? 'Probá con otro nombre.' : 'Registrá un socio para asignarle rutinas y dietas.'}</p></div>}
    </>}
  </div>
}

export function Plans({ members, role, initialMemberId, initialTab = 'overview', logoUrl, gymName }: { members: MemberOption[]; role: 'ADMIN' | 'TRAINER'; initialMemberId?: string | null; initialTab?: 'overview' | 'catalog' | 'foods'; logoUrl: string; gymName: string }) {
  const { confirm, dialog } = useConfirmDialog()
const [tab, setTab] = useState<'overview' | 'plans' | 'diets' | 'catalog' | 'foods' | 'groups' | 'foodGroups'>(initialTab)
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [diets, setDiets] = useState<DietSummary[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [foodGroups, setFoodGroups] = useState<FoodGroup[]>([])
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
  const [groupForm, setGroupForm] = useState<MuscleGroup | 'new' | null>(null)
  const [groupDraft, setGroupDraft] = useState('')
  const [draft, setDraft] = useState<Plan | PlanInput | null>(null)
  const [dietDraft, setDietDraft] = useState<Diet | DietInput | null>(null)
  const [openWeek, setOpenWeek] = useState(1)
  const [openDietWeek, setOpenDietWeek] = useState(1)
  const [search, setSearch] = useState('')
  const [foodSearch, setFoodSearch] = useState('')
  const [foodGroupFilter, setFoodGroupFilter] = useState('all')
  const [catalogGroup] = useState('Todos')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [preview, setPreview] = useState<{ url: string; filename: string; title: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [exerciseForm, setExerciseForm] = useState<Exercise | 'new' | null>(null)
  const [exerciseDraft, setExerciseDraft] = useState({ name: '', muscleGroup: '', notes: '' })
  const [foodForm, setFoodForm] = useState<Food | 'new' | null>(null)
  const [foodDraft, setFoodDraft] = useState({ name: '', groupId: '' as string, calories: 0, protein: 0, carbs: 0, fat: 0, notes: '' })
  const [foodGroupForm, setFoodGroupForm] = useState<FoodGroup | 'new' | null>(null)
  const [foodGroupDraft, setFoodGroupDraft] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  async function load() {
    try {
      const [p, e, g, d, f, fg] = await Promise.all([request<PlanSummary[]>('/plans'), request<Exercise[]>('/exercises'), request<MuscleGroup[]>('/muscle-groups'), request<DietSummary[]>('/diets'), request<Food[]>('/foods'), request<FoodGroup[]>('/food-groups')])
      setPlans(p); setExercises(e); setMuscleGroups(g); setDiets(d); setFoods(f); setFoodGroups(fg); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los planes') }
  }
  useEffect(() => {
    Promise.all([request<PlanSummary[]>('/plans'), request<Exercise[]>('/exercises'), request<MuscleGroup[]>('/muscle-groups'), request<DietSummary[]>('/diets'), request<Food[]>('/foods'), request<FoodGroup[]>('/food-groups')])
      .then(([p, e, g, d, f, fg]) => { setPlans(p); setExercises(e); setMuscleGroups(g); setDiets(d); setFoods(f); setFoodGroups(fg) })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los planes'))
  }, [])

  const beginPlan = (memberId?: string) => {
    if (!members.length) { setError('Cargá un socio antes de crear su plan.'); return }
    const selectedId = memberId || initialMemberId
    setDraft({ memberId: selectedId && members.some((m) => m.id === selectedId) ? selectedId : members[0].id, name: '', objective: '', startDate: today(), weeks: emptyWeeks() })
    setOpenWeek(1); setNotice(''); setDirty(false)
  }
  const openPlan = async (id: string) => {
    try { setDraft(await request<Plan>(`/plans/${id}`)); setOpenWeek(1); setError(''); setNotice(''); setDirty(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir el plan') }
  }
  const update = (change: Partial<PlanInput>) => { setDraft((p) => p ? { ...p, ...change } : null); setDirty(true); setNotice('') }
  const updateWeeks = (weeks: Week[]) => update({ weeks })
  const addPlanMonth = () => {
    if (!draft || draft.weeks.length >= 12) return
    const weekNumber = draft.weeks.length + 1
    updateWeeks([...draft.weeks, { weekNumber, days: [] }])
    setOpenWeek(weekNumber)
  }
  const removeLastPlanMonth = async () => {
    if (!draft || draft.weeks.length <= 1 || !await confirm('¿Quitar el último mes?', `Se quitará el mes ${draft.weeks.length} y todos sus ejercicios del borrador.`)) return
    updateWeeks(draft.weeks.slice(0, -1))
    setOpenWeek(draft.weeks.length - 1)
  }
  const updateDay = (weekNumber: number, dayIndex: number, change: Partial<Day>) => {
    if (!draft) return
    updateWeeks(draft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, days: week.days.map((day, index) => index === dayIndex ? { ...day, ...change } : day) } : week))
  }
const dayGroups = (value: string) => muscleGroups.filter((group) => hasGroup(value, group.name))
  const toggleDayGroup = (weekNumber: number, dayIndex: number, day: Day, group: string) => {
    const current = dayGroups(day.muscleGroup).map((item) => item.name)
    const next = current.includes(group) ? current.filter((item) => item !== group) : [...current, group]
    updateDay(weekNumber, dayIndex, { muscleGroup: next.join(', ') })
  }
  const updateItem = (weekNumber: number, dayIndex: number, itemIndex: number, change: Partial<Item>) => {
    const day = draft?.weeks.find((week) => week.weekNumber === weekNumber)?.days[dayIndex]
    if (day) updateDay(weekNumber, dayIndex, { exercises: day.exercises.map((item, index) => index === itemIndex ? { ...item, ...change } : item) })
  }
  const addDay = (weekNumber: number) => {
    if (!draft) return
    updateWeeks(draft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, days: [...week.days, { name: `Día ${week.days.length + 1}`, muscleGroup: '', exercises: [] }] } : week))
  }
  const removeDay = async (weekNumber: number, index: number) => {
    if (!draft || !await confirm('¿Quitar este día?', 'Se quitarán del borrador el día y todos sus ejercicios.')) return
    updateWeeks(draft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, days: week.days.filter((_, i) => i !== index) } : week))
  }
  const addItem = (weekNumber: number, dayIndex: number) => {
    const day = draft?.weeks.find((week) => week.weekNumber === weekNumber)?.days[dayIndex]
    if (day) {
      const first = exercises.find((exercise) => dayGroups(day.muscleGroup).some((group) => hasGroup(exercise.muscleGroup, group.name))) || exercises[0]
      updateDay(weekNumber, dayIndex, { exercises: [...day.exercises, emptyItem(first?.id, first?.name)] })
    }
  }
  const removeItem = (weekNumber: number, dayIndex: number, itemIndex: number) => {
    const day = draft?.weeks.find((week) => week.weekNumber === weekNumber)?.days[dayIndex]
    if (day) updateDay(weekNumber, dayIndex, { exercises: day.exercises.filter((_, index) => index !== itemIndex) })
  }
  const savePlan = async () => {
    if (!draft) return
    if (!draft.name.trim()) { setError('Poné un nombre al plan.'); return }
    if (draft.weeks.some((week) => week.days.some((day) => !day.name.trim()))) { setError('Cada día necesita un nombre.'); return }
    setBusy(true)
    try {
      const resolvedWeeks: Week[] = []
      const available = [...exercises]
      for (const week of draft.weeks) {
        const days: Day[] = []
        for (const day of week.days) {
          const items: Item[] = []
          for (const item of day.exercises) {
            const typedName = (item.exerciseName || available.find((exercise) => exercise.id === item.exerciseId)?.name || '').trim()
            if (!typedName) throw new Error('Escribí el nombre de cada ejercicio.')
            let exercise = available.find((entry) => entry.name.localeCompare(typedName, 'es-AR', { sensitivity: 'base' }) === 0)
            if (!exercise) {
              exercise = await request<Exercise>('/exercises', { method: 'POST', body: JSON.stringify({ name: typedName, muscleGroup: day.muscleGroup.split(',')[0].trim() || 'General', notes: '' }) })
              available.push(exercise)
            }
            items.push({ ...item, exerciseId: exercise.id, exerciseName: exercise.name })
          }
          days.push({ ...day, exercises: items })
        }
        resolvedWeeks.push({ ...week, days })
      }
      const existing = 'id' in draft
      const saved = await request<Plan>(existing ? `/plans/${draft.id}` : '/plans', {
        method: existing ? 'PUT' : 'POST',
        body: JSON.stringify({ memberId: draft.memberId, name: draft.name, objective: draft.objective, startDate: draft.startDate, weeks: resolvedWeeks }),
      })
      setDraft(saved); setError(''); setNotice('Plan guardado correctamente.'); setDirty(false); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  const exportPdf = async () => {
    if (!draft || !('id' in draft)) return
    setExporting(true)
    try {
      const saved = await request<Plan>(`/plans/${draft.id}`)
      await downloadPlanPdf(saved, logoUrl, gymName)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo generar el PDF') }
    finally { setExporting(false) }
  }
  const exportDietPdf = async () => {
    if (!dietDraft || !('id' in dietDraft)) return
    setExporting(true)
    try {
      const saved = await request<Diet>(`/diets/${dietDraft.id}`)
      await downloadDietPdf(saved, logoUrl, gymName)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo generar el PDF') }
    finally { setExporting(false) }
  }
  const openPdfPreview = async (kind: 'plan' | 'diet') => {
    const id = kind === 'plan' ? draft && 'id' in draft ? draft.id : null : dietDraft && 'id' in dietDraft ? dietDraft.id : null
    if (!id || dirty) return
    setExporting(true)
    try {
      if (kind === 'plan') {
        const saved = await request<Plan>(`/plans/${id}`)
        const doc = await createPlanPdf(saved, logoUrl, gymName)
        setPreview({ url: URL.createObjectURL(doc.output('blob')), filename: pdfName(saved.firstName, saved.lastName, saved.name, 'plan'), title: `Rutina · ${saved.name}` })
      } else {
        const saved = await request<Diet>(`/diets/${id}`)
        const doc = await createDietPdf(saved, logoUrl, gymName)
        setPreview({ url: URL.createObjectURL(doc.output('blob')), filename: pdfName(saved.firstName, saved.lastName, saved.name, 'dieta'), title: `Dieta · ${saved.name}` })
      }
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo generar la vista previa') }
    finally { setExporting(false) }
  }
  const beginExercise = (exercise?: Exercise) => { setExerciseForm(exercise || 'new'); setExerciseDraft(exercise ? { name: exercise.name, muscleGroup: exercise.muscleGroup, notes: exercise.notes } : { name: '', muscleGroup: catalogGroup === 'Todos' ? (muscleGroups[0]?.name || '') : catalogGroup, notes: '' }) }
  const saveExercise = async () => {
    setBusy(true)
    try {
      const existing = exerciseForm && exerciseForm !== 'new' ? exerciseForm : null
      await request(existing ? `/exercises/${existing.id}` : '/exercises', { method: existing ? 'PUT' : 'POST', body: JSON.stringify(exerciseDraft) })
      setExerciseForm(null); setError(''); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el ejercicio') }
    finally { setBusy(false) }
  }
  const deleteExercise = async (exercise: Exercise) => {
    if (!await confirm('¿Eliminar ejercicio?', `Se eliminará "${exercise.name}" del catálogo.`)) return
    try { await request(`/exercises/${exercise.id}`, { method: 'DELETE' }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar') }
  }
  const beginGroup = (group?: MuscleGroup) => { setGroupForm(group || 'new'); setGroupDraft(group ? group.name : '') }
  const saveGroup = async () => {
    if (!groupDraft.trim()) { setError('Poné un nombre al grupo muscular.'); return }
    setBusy(true)
    try {
      const existing = groupForm && groupForm !== 'new' ? groupForm : null
      await request(existing ? `/muscle-groups/${existing.id}` : '/muscle-groups', { method: existing ? 'PUT' : 'POST', body: JSON.stringify({ name: groupDraft.trim() }) })
      setGroupForm(null); setGroupDraft(''); setError(''); setNotice('Grupo muscular guardado correctamente.'); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el grupo') }
    finally { setBusy(false) }
  }
  const deleteGroup = async (group: MuscleGroup) => {
    if (!await confirm('¿Eliminar grupo muscular?', `Se eliminará el grupo "${group.name}".`)) return
    try { await request(`/muscle-groups/${group.id}`, { method: 'DELETE' }); setError(''); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar') }
  }
  const beginDiet = (memberId?: string) => {
    if (!members.length) { setError('Cargá un socio antes de crear su dieta.'); return }
    const selectedId = memberId || initialMemberId
    setDietDraft({ memberId: selectedId && members.some((m) => m.id === selectedId) ? selectedId : members[0].id, name: '', objective: '', startDate: today(), weeks: emptyDietWeeks() })
    setOpenDietWeek(1); setNotice(''); setDirty(false)
  }
  const openDiet = async (id: string) => {
    try { setDietDraft(await request<Diet>(`/diets/${id}`)); setOpenDietWeek(1); setError(''); setNotice(''); setDirty(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir la dieta') }
  }
  const deletePlan = async (plan: PlanSummary) => {
    if (!await confirm('¿Eliminar rutina?', `Se eliminará "${plan.name}" de ${plan.firstName} ${plan.lastName}. Esta acción no se puede deshacer.`)) return
    try {
      await request<void>(`/plans/${plan.id}`, { method: 'DELETE' })
      setPlans((current) => current.filter((item) => item.id !== plan.id))
      setError(''); setNotice('Rutina eliminada correctamente.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la rutina') }
  }
  const deleteDiet = async (diet: DietSummary) => {
    if (!await confirm('¿Eliminar dieta?', `Se eliminará "${diet.name}" de ${diet.firstName} ${diet.lastName}. Esta acción no se puede deshacer.`)) return
    try {
      await request<void>(`/diets/${diet.id}`, { method: 'DELETE' })
      setDiets((current) => current.filter((item) => item.id !== diet.id))
      setError(''); setNotice('Dieta eliminada correctamente.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la dieta') }
  }
  const updateDiet = (change: Partial<DietInput>) => { setDietDraft((p) => p ? { ...p, ...change } : null); setDirty(true); setNotice('') }
  const updateDietWeeks = (weeks: DietWeek[]) => updateDiet({ weeks })
  const updateDietDay = (weekNumber: number, dayIndex: number, change: Partial<DietDay>) => {
    if (!dietDraft) return
    updateDietWeeks(dietDraft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, days: week.days.map((day, index) => index === dayIndex ? { ...day, ...change } : day) } : week))
  }
  const updateDietMeal = (weekNumber: number, dayIndex: number, mealIndex: number, change: Partial<DietMeal>) => {
    const day = dietDraft?.weeks.find((w) => w.weekNumber === weekNumber)?.days[dayIndex]
    if (day) updateDietDay(weekNumber, dayIndex, { meals: day.meals.map((meal, index) => index === mealIndex ? { ...meal, ...change } : meal) })
  }
  const updateDietItem = (weekNumber: number, dayIndex: number, mealIndex: number, itemIndex: number, change: Partial<DietItem>) => {
    const meal = dietDraft?.weeks.find((w) => w.weekNumber === weekNumber)?.days[dayIndex]?.meals[mealIndex]
    if (meal) updateDietMeal(weekNumber, dayIndex, mealIndex, { items: meal.items.map((item, index) => index === itemIndex ? { ...item, ...change } : item) })
  }
  const addDietDay = (weekNumber: number) => {
    if (!dietDraft) return
    updateDietWeeks(dietDraft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, days: [...week.days, { name: `Menú ${week.days.length + 1}`, meals: [] }] } : week))
  }
  const removeDietDay = async (weekNumber: number, index: number) => {
    if (!dietDraft || !await confirm('¿Quitar este menú?', 'Se quitarán del borrador el menú y todas sus comidas.')) return
    updateDietWeeks(dietDraft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, days: week.days.filter((_, i) => i !== index) } : week))
  }
  const addDietMonth = () => {
    if (!dietDraft || dietDraft.weeks.length >= 12) return
    const weekNumber = dietDraft.weeks.length + 1
    updateDietWeeks([...dietDraft.weeks, { weekNumber, days: [] }])
    setOpenDietWeek(weekNumber)
  }
  const removeLastDietMonth = async () => {
    if (!dietDraft || dietDraft.weeks.length <= 1 || !await confirm('¿Quitar el último mes?', `Se quitará el mes ${dietDraft.weeks.length} y todo su contenido del borrador.`)) return
    updateDietWeeks(dietDraft.weeks.slice(0, -1))
    setOpenDietWeek(dietDraft.weeks.length - 1)
  }
  const addDietMeal = (weekNumber: number, dayIndex: number) => {
    const day = dietDraft?.weeks.find((w) => w.weekNumber === weekNumber)?.days[dayIndex]
    if (day) updateDietDay(weekNumber, dayIndex, { meals: [...day.meals, { name: mealNames[day.meals.length] || `Comida ${day.meals.length + 1}`, items: [] }] })
  }
  const removeDietMeal = (weekNumber: number, dayIndex: number, mealIndex: number) => {
    const day = dietDraft?.weeks.find((w) => w.weekNumber === weekNumber)?.days[dayIndex]
    if (day) updateDietDay(weekNumber, dayIndex, { meals: day.meals.filter((_, index) => index !== mealIndex) })
  }
  const addDietItem = (weekNumber: number, dayIndex: number, mealIndex: number) => {
    const meal = dietDraft?.weeks.find((w) => w.weekNumber === weekNumber)?.days[dayIndex]?.meals[mealIndex]
    if (meal) updateDietMeal(weekNumber, dayIndex, mealIndex, { items: [...meal.items, emptyDietItem(foods[0]?.id, foods[0]?.name)] })
  }
  const removeDietItem = (weekNumber: number, dayIndex: number, mealIndex: number, itemIndex: number) => {
    const meal = dietDraft?.weeks.find((w) => w.weekNumber === weekNumber)?.days[dayIndex]?.meals[mealIndex]
    if (meal) updateDietMeal(weekNumber, dayIndex, mealIndex, { items: meal.items.filter((_, index) => index !== itemIndex) })
  }
  const saveDiet = async () => {
    if (!dietDraft) return
    if (!dietDraft.name.trim()) { setError('Poné un nombre a la dieta.'); return }
    if (dietDraft.weeks.some((w) => w.days.some((d) => !d.name.trim()))) { setError('Cada día necesita un nombre.'); return }
    if (dietDraft.weeks.some((w) => w.days.some((d) => d.meals.some((m) => !m.name.trim())))) { setError('Cada comida necesita un nombre.'); return }
    setBusy(true)
    try {
      const resolvedWeeks: DietWeek[] = []
      const available = [...foods]
      for (const week of dietDraft.weeks) {
        const days: DietDay[] = []
        for (const day of week.days) {
          const meals: DietMeal[] = []
          for (const meal of day.meals) {
            const items: DietItem[] = []
            for (const item of meal.items) {
              const typedName = (item.foodName || available.find((food) => food.id === item.foodId)?.name || '').trim()
              if (!typedName) throw new Error('Escribí el nombre de cada alimento.')
              let food = available.find((entry) => entry.name.localeCompare(typedName, 'es-AR', { sensitivity: 'base' }) === 0)
              if (!food) {
                food = await request<Food>('/foods', { method: 'POST', body: JSON.stringify({ name: typedName, groupId: null, calories: 0, protein: 0, carbs: 0, fat: 0, notes: 'Creado desde una dieta; completar valores nutricionales.' }) })
                available.push(food)
              }
              items.push({ ...item, foodId: food.id, foodName: food.name })
            }
            meals.push({ ...meal, items })
          }
          days.push({ ...day, meals })
        }
        resolvedWeeks.push({ ...week, days })
      }
      const existing = 'id' in dietDraft
      const saved = await request<Diet>(existing ? `/diets/${dietDraft.id}` : '/diets', {
        method: existing ? 'PUT' : 'POST',
        body: JSON.stringify({ memberId: dietDraft.memberId, name: dietDraft.name, objective: dietDraft.objective, startDate: dietDraft.startDate, weeks: resolvedWeeks }),
      })
      setDietDraft(saved); setError(''); setNotice('Dieta guardada correctamente.'); setDirty(false); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  const itemMacros = (item: DietItem) => { const food = foods.find((f) => f.id === item.foodId); if (!food || !item.grams) return null; const k = item.grams / 100; return { kcal: Math.round(food.calories * k), protein: Math.round(food.protein * k * 10) / 10, carbs: Math.round(food.carbs * k * 10) / 10, fat: Math.round(food.fat * k * 10) / 10 } }
  const sumMacros = (items: DietItem[]) => { const totals = items.map(itemMacros).filter((m): m is NonNullable<ReturnType<typeof itemMacros>> => m !== null); if (!totals.length) return null; return totals.reduce((acc, m) => ({ kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }) }
  const beginFood = (food?: Food) => { setFoodForm(food || 'new'); setFoodDraft(food ? { name: food.name, groupId: food.groupId || '', calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, notes: food.notes } : { name: '', groupId: foodGroupFilter !== 'all' && foodGroupFilter !== 'none' ? foodGroupFilter : '', calories: 0, protein: 0, carbs: 0, fat: 0, notes: '' }) }
  const saveFood = async () => {
    setBusy(true)
    try {
      const existing = foodForm && foodForm !== 'new' ? foodForm : null
      await request(existing ? `/foods/${existing.id}` : '/foods', { method: existing ? 'PUT' : 'POST', body: JSON.stringify({ ...foodDraft, groupId: foodDraft.groupId || null }) })
      setFoodForm(null); setError(''); setNotice('Alimento guardado correctamente.'); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el alimento') }
    finally { setBusy(false) }
  }
  const deleteFood = async (food: Food) => {
    if (!await confirm('¿Eliminar alimento?', `Se eliminará "${food.name}" del catálogo.`)) return
    try { await request(`/foods/${food.id}`, { method: 'DELETE' }); setError(''); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar') }
  }
  const beginFoodGroup = (group?: FoodGroup) => { setFoodGroupForm(group || 'new'); setFoodGroupDraft(group?.name || '') }
  const saveFoodGroup = async () => {
    if (!foodGroupDraft.trim()) { setError('Poné un nombre al grupo de alimentos.'); return }
    setBusy(true)
    try {
      const existing = foodGroupForm && foodGroupForm !== 'new' ? foodGroupForm : null
      await request(existing ? `/food-groups/${existing.id}` : '/food-groups', { method: existing ? 'PUT' : 'POST', body: JSON.stringify({ name: foodGroupDraft.trim() }) })
      setFoodGroupForm(null); setError(''); setNotice('Grupo de alimentos guardado.'); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el grupo') }
    finally { setBusy(false) }
  }
  const deleteFoodGroup = async (group: FoodGroup) => {
    if (!await confirm('¿Eliminar grupo de alimentos?', `Se eliminará el grupo "${group.name}". Solo se puede borrar si no tiene alimentos asignados.`)) return
    try { await request(`/food-groups/${group.id}`, { method: 'DELETE' }); setError(''); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el grupo') }
  }

  return <div className="plans-page">
    {dialog}
    {preview && <div className="backdrop pdf-preview-backdrop" onMouseDown={() => setPreview(null)}><div className="modal pdf-preview-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title" onMouseDown={(event) => event.stopPropagation()}><div className="pdf-preview-header"><div><small>VISTA PREVIA DEL PDF</small><h2 id="pdf-preview-title">{preview.title}</h2></div><div className="pdf-preview-actions"><a className="button primary" href={preview.url} download={preview.filename}><Download size={16} /> Descargar PDF</a><button className="icon" aria-label="Cerrar vista previa" onClick={() => setPreview(null)}><X size={18} /></button></div></div><iframe className="pdf-preview-frame" title={`Vista previa de ${preview.title}`} src={preview.url} /><p className="pdf-preview-fallback">Si el visor no muestra el documento, usá “Descargar PDF” para abrirlo en tu equipo.</p></div></div>}
    {error && <div className="alert" role="alert">{error} <button onClick={() => setError('')}>Cerrar</button></div>}
    {notice && <div className="plan-notice">{notice}</div>}
    {draft ? <>
      <div className="plan-heading"><button className="plan-back" onClick={() => { setDraft(null); setNotice('') }}><ArrowLeft size={17} /> Volver a planes</button><div className="heading plan-title"><div><small>PLAN DE ENTRENAMIENTO ━━━</small><h1>{'id' in draft ? 'Editar plan' : 'Nuevo plan'}<em>.</em></h1><p>Comenzá con un mes y agregá los siguientes cuando los necesites.</p></div><div className="plan-heading-actions">{'id' in draft && <button className="button outline" disabled={exporting || dirty} title={dirty ? 'Guardá los cambios para ver la vista previa' : 'Ver el PDF antes de descargar'} onClick={() => void openPdfPreview('plan')}><Eye size={17} /> Vista previa</button>}{'id' in draft && <button className="button outline" disabled={exporting || dirty} title={dirty ? 'Guardá los cambios antes de exportar' : 'Descargar el plan guardado'} onClick={() => void exportPdf()}><Download size={17} /> {exporting ? 'Generando…' : 'Exportar PDF'}</button>}<button className="button primary" disabled={busy} onClick={() => void savePlan()}><Save size={17} /> {busy ? 'Guardando…' : 'Guardar plan'}</button></div></div></div>
      <section className="panel plan-meta"><div className="plan-fields"><label>Nombre del plan<input maxLength={120} value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Ej: Fuerza inicial" /></label><label>Socio<select value={draft.memberId} onChange={(e) => update({ memberId: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></label><label>Fecha de inicio<input type="date" value={draft.startDate} onChange={(e) => update({ startDate: e.target.value })} /></label></div><label>Objetivo del plan<textarea rows={2} maxLength={500} value={draft.objective} onChange={(e) => update({ objective: e.target.value })} placeholder="Objetivo principal del entrenamiento" /></label></section>
      <div className="week-list">{draft.weeks.map((week) => <section className="panel week" key={week.weekNumber}><button className="week-header" onClick={() => setOpenWeek(openWeek === week.weekNumber ? 0 : week.weekNumber)}><span className="week-number">{String(week.weekNumber).padStart(2, '0')}</span><span><strong>Mes {week.weekNumber}</strong><small>{week.days.length} días · {week.days.reduce((n, d) => n + d.exercises.length, 0)} ejercicios</small></span>{openWeek === week.weekNumber ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>{openWeek === week.weekNumber && <div className="week-content">{week.days.map((day, dayIndex) => <div className="day" key={day.id || dayIndex}><div className="day-head"><span>DÍA {dayIndex + 1}</span><button className="icon danger-icon" aria-label={`Quitar día ${dayIndex + 1}`} onClick={() => removeDay(week.weekNumber, dayIndex)}><Trash2 size={15} /></button></div><div className="day-fields"><label>Nombre del día<input value={day.name} onChange={(e) => updateDay(week.weekNumber, dayIndex, { name: e.target.value })} /></label><label>Grupo muscular<input value={day.muscleGroup} onChange={(e) => updateDay(week.weekNumber, dayIndex, { muscleGroup: e.target.value })} placeholder="Ej: Pecho y tríceps" /></label></div>{muscleGroups.length ? <div className="group-chips">{muscleGroups.map((group) => <button key={group.id} type="button" className={dayGroups(day.muscleGroup).some((item) => item.name === group.name) ? 'chip picked' : 'chip'} onClick={() => toggleDayGroup(week.weekNumber, dayIndex, day, group.name)}>{group.name}</button>)}</div> : null}<div className="items-head">EJERCICIOS <span>SERIES · REPETICIONES · CARGA · DESCANSO</span></div>{day.exercises.map((item, itemIndex) => <div className="item" key={item.id || itemIndex}><input aria-label="Ejercicio" list="exercise-options" placeholder="Escribí o elegí un ejercicio" value={item.exerciseName || exercises.find((exercise) => exercise.id === item.exerciseId)?.name || ''} onChange={(e) => { const exercise = exercises.find((entry) => entry.name.localeCompare(e.target.value, 'es-AR', { sensitivity: 'base' }) === 0); updateItem(week.weekNumber, dayIndex, itemIndex, { exerciseId: exercise?.id || '', exerciseName: e.target.value }) }} /><input aria-label="Series" type="number" min={1} max={30} value={item.sets} onChange={(e) => updateItem(week.weekNumber, dayIndex, itemIndex, { sets: Number(e.target.value) })} /><input aria-label="Repeticiones" value={item.reps} onChange={(e) => updateItem(week.weekNumber, dayIndex, itemIndex, { reps: e.target.value })} /><input aria-label="Carga" placeholder="kg" value={item.load} onChange={(e) => updateItem(week.weekNumber, dayIndex, itemIndex, { load: e.target.value })} /><input aria-label="Descanso en segundos" type="number" min={0} max={3600} placeholder="seg" value={item.restSeconds ?? ''} onChange={(e) => updateItem(week.weekNumber, dayIndex, itemIndex, { restSeconds: e.target.value ? Number(e.target.value) : null })} /><button className="icon danger-icon" aria-label="Quitar ejercicio" onClick={() => removeItem(week.weekNumber, dayIndex, itemIndex)}><X size={15} /></button><input className="item-notes" aria-label="Observaciones" placeholder="Observaciones (opcional)" value={item.notes} onChange={(e) => updateItem(week.weekNumber, dayIndex, itemIndex, { notes: e.target.value })} /></div>)}<button className="plan-add" onClick={() => addItem(week.weekNumber, dayIndex)}><Plus size={15} /> Agregar ejercicio</button></div>)}<button className="plan-add add-day" onClick={() => addDay(week.weekNumber)}><Plus size={16} /> Agregar día de entrenamiento</button></div>}</section>)}<div className="diet-month-actions"><button className="plan-add" disabled={draft.weeks.length >= 12} onClick={addPlanMonth}><Plus size={16} /> Agregar mes</button>{draft.weeks.length > 1 && <button className="plan-add danger-month" onClick={() => void removeLastPlanMonth()}><Trash2 size={15} /> Quitar último mes</button>}</div></div>
    </> : dietDraft ? <><div className="plan-heading"><button className="plan-back" onClick={() => { setDietDraft(null); setNotice('') }}><ArrowLeft size={17} /> Volver a dietas</button><div className="heading plan-title"><div><small>PLAN DE ALIMENTACIÓN ━━━</small><h1>{'id' in dietDraft ? 'Editar dieta' : 'Nueva dieta'}<em>.</em></h1><p>Comenzá con un mes y agregá los siguientes cuando los necesites.</p></div><div className="plan-heading-actions">{'id' in dietDraft && <button className="button outline" disabled={exporting || dirty} title={dirty ? 'Guardá los cambios para ver la vista previa' : 'Ver el PDF antes de descargar'} onClick={() => void openPdfPreview('diet')}><Eye size={17} /> Vista previa</button>}{'id' in dietDraft && <button className="button outline" disabled={exporting || dirty} title={dirty ? 'Guardá los cambios antes de exportar' : 'Descargar la dieta guardada'} onClick={() => void exportDietPdf()}><Download size={17} /> {exporting ? 'Generando…' : 'Exportar PDF'}</button>}<button className="button primary" disabled={busy} onClick={() => void saveDiet()}><Save size={17} /> {busy ? 'Guardando…' : 'Guardar dieta'}</button></div></div></div><section className="panel plan-meta"><div className="plan-fields"><label>Nombre de la dieta<input maxLength={120} value={dietDraft.name} onChange={(e) => updateDiet({ name: e.target.value })} placeholder="Ej: Volumen y fuerza" /></label><label>Socio<select value={dietDraft.memberId} onChange={(e) => updateDiet({ memberId: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></label><label>Fecha de inicio<input type="date" value={dietDraft.startDate} onChange={(e) => updateDiet({ startDate: e.target.value })} /></label></div><label>Objetivo de la dieta<textarea rows={2} maxLength={500} value={dietDraft.objective} onChange={(e) => updateDiet({ objective: e.target.value })} placeholder="Objetivo principal de la alimentación" /></label></section><div className="week-list">{dietDraft.weeks.map((week) => <section className="panel week diet-month" key={week.weekNumber}><button className="week-header" onClick={() => setOpenDietWeek(openDietWeek === week.weekNumber ? 0 : week.weekNumber)}><span className="week-number">{String(week.weekNumber).padStart(2, '0')}</span><span><strong>Mes {week.weekNumber}</strong><small>{dietMonthPeriod(dietDraft.startDate, week.weekNumber)} · {week.days.length} menú{week.days.length === 1 ? '' : 's'} · {week.days.reduce((n, d) => n + d.meals.reduce((m, meal) => m + meal.items.length, 0), 0)} alimentos</small></span>{openDietWeek === week.weekNumber ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>{openDietWeek === week.weekNumber && <div className="week-content">{week.days.map((day, dayIndex) => <div className="day diet-menu" key={day.id || dayIndex}><div className="day-head"><span>MENÚ {dayIndex + 1}</span><button className="icon danger-icon" aria-label={`Quitar menú ${dayIndex + 1}`} onClick={() => removeDietDay(week.weekNumber, dayIndex)}><Trash2 size={15} /></button></div><div className="day-fields"><label>Nombre o frecuencia<input value={day.name} onChange={(e) => updateDietDay(week.weekNumber, dayIndex, { name: e.target.value })} placeholder="Ej: Lunes a viernes" /></label></div>{day.meals.map((meal, mealIndex) => <div className="meal" key={meal.id || mealIndex}><div className="meal-head"><input className="meal-name" aria-label="Nombre de la comida" value={meal.name} onChange={(e) => updateDietMeal(week.weekNumber, dayIndex, mealIndex, { name: e.target.value })} /><button className="icon danger-icon" aria-label="Quitar comida" onClick={() => removeDietMeal(week.weekNumber, dayIndex, mealIndex)}><Trash2 size={15} /></button></div>{meal.items.map((item, itemIndex) => <div className="diet-item" key={item.id || itemIndex}><input aria-label="Alimento" list="food-options" placeholder="Escribí o elegí un alimento" value={item.foodName || foods.find((food) => food.id === item.foodId)?.name || ''} onChange={(e) => { const food = foods.find((entry) => entry.name.localeCompare(e.target.value, 'es-AR', { sensitivity: 'base' }) === 0); updateDietItem(week.weekNumber, dayIndex, mealIndex, itemIndex, { foodId: food?.id || '', foodName: e.target.value }) }} /><input aria-label="Cantidad" placeholder="Cantidad" value={item.quantity} onChange={(e) => updateDietItem(week.weekNumber, dayIndex, mealIndex, itemIndex, { quantity: e.target.value })} /><input aria-label="Gramos" type="number" min={1} max={5000} placeholder="gramos" value={item.grams ?? ''} onChange={(e) => updateDietItem(week.weekNumber, dayIndex, mealIndex, itemIndex, { grams: e.target.value ? Number(e.target.value) : null })} /><button className="icon danger-icon" aria-label="Quitar alimento" onClick={() => removeDietItem(week.weekNumber, dayIndex, mealIndex, itemIndex)}><X size={15} /></button><input className="item-notes" aria-label="Observaciones" placeholder="Observaciones (opcional)" value={item.notes} onChange={(e) => updateDietItem(week.weekNumber, dayIndex, mealIndex, itemIndex, { notes: e.target.value })} /></div>)}<MacroLine value={sumMacros(meal.items)} label="TOTAL COMIDA" /><button className="plan-add" onClick={() => addDietItem(week.weekNumber, dayIndex, mealIndex)}><Plus size={15} /> Agregar alimento</button></div>)}<button className="plan-add add-meal" onClick={() => addDietMeal(week.weekNumber, dayIndex)}><Plus size={16} /> Agregar comida</button><MacroLine value={sumMacros(day.meals.flatMap((meal) => meal.items))} label="TOTAL DÍA" /></div>)}<button className="plan-add add-day" onClick={() => addDietDay(week.weekNumber)}><Plus size={16} /> Agregar día o menú</button></div>}</section>)}{role === 'ADMIN' && <div className="diet-month-actions"><button className="plan-add" disabled={dietDraft.weeks.length >= 12} onClick={addDietMonth}><Plus size={16} /> Agregar mes</button>{dietDraft.weeks.length > 1 && <button className="plan-add danger-month" onClick={() => void removeLastDietMonth()}><Trash2 size={15} /> Quitar último mes</button>}</div>}</div></> : <><div className="heading"><div><small>{tab === 'overview' ? 'PLANES ━━━' : ['plans', 'catalog', 'groups'].includes(tab) ? 'ENTRENAMIENTO ━━━' : 'ALIMENTACIÓN ━━━'}</small><h1>{tab === 'overview' ? <>Planes por alumno<em>.</em></> : tab === 'plans' ? <>Rutinas<em>.</em></> : tab === 'diets' ? <>Dietas<em>.</em></> : tab === 'catalog' ? <>Ejercicios<em>.</em></> : tab === 'foods' ? <>Alimentos<em>.</em></> : tab === 'foodGroups' ? <>Grupos de alimentos<em>.</em></> : <>Grupos musculares<em>.</em></>}</h1><p>{tab === 'overview' ? 'Rutinas y dietas reunidas en la ficha de cada alumno.' : tab === 'plans' ? 'Rutinas mensuales asociadas a tus socios.' : tab === 'diets' ? 'Planes mensuales de alimentación para tus socios.' : tab === 'catalog' ? 'Catálogo reutilizable de movimientos del gimnasio.' : tab === 'foods' ? 'Catálogo de alimentos con calorías y macros por 100 g.' : tab === 'foodGroups' ? 'Categorías para organizar los alimentos de tus dietas.' : 'Los grupos que organizan los ejercicios de tus rutinas.'}</p></div>{tab !== 'overview' && <button className="button primary" onClick={() => tab === 'plans' ? beginPlan() : tab === 'diets' ? beginDiet() : tab === 'groups' ? beginGroup() : tab === 'foods' ? beginFood() : tab === 'foodGroups' ? beginFoodGroup() : beginExercise()}><Plus size={17} /> {tab === 'plans' ? 'Nueva rutina' : tab === 'diets' ? 'Nueva dieta' : tab === 'groups' ? 'Nuevo grupo' : tab === 'foods' ? 'Nuevo alimento' : tab === 'foodGroups' ? 'Nuevo grupo' : 'Nuevo ejercicio'}</button>}</div><div className="plan-sections" aria-label="Áreas de trabajo"><button className={tab === 'overview' ? 'picked' : ''} onClick={() => setTab('overview')}><Users size={18} /><span><strong>Por alumno</strong><small>Rutinas y dietas en un solo lugar</small></span></button><button className={['plans', 'catalog', 'groups'].includes(tab) ? 'picked' : ''} onClick={() => setTab('plans')}><Dumbbell size={18} /><span><strong>Entrenamiento</strong><small>Rutinas, ejercicios y grupos musculares</small></span></button><button className={['diets', 'foods', 'foodGroups'].includes(tab) ? 'picked' : ''} onClick={() => setTab('diets')}><Salad size={18} /><span><strong>Dietas</strong><small>Planes de alimentación y alimentos</small></span></button></div>{tab !== 'overview' && <div className="plan-tabs" aria-label="Secciones del área">{['plans', 'catalog', 'groups'].includes(tab) ? <><button className={tab === 'plans' ? 'picked' : ''} onClick={() => setTab('plans')}><Dumbbell size={16} /> Rutinas</button><button className={tab === 'catalog' ? 'picked' : ''} onClick={() => setTab('catalog')}><Search size={16} /> Ejercicios</button><button className={tab === 'groups' ? 'picked' : ''} onClick={() => setTab('groups')}><Target size={16} /> Grupos musculares</button></> : <><button className={tab === 'diets' ? 'picked' : ''} onClick={() => setTab('diets')}><Salad size={16} /> Planes de dieta</button><button className={tab === 'foods' ? 'picked' : ''} onClick={() => setTab('foods')}><Apple size={16} /> Alimentos</button><button className={tab === 'foodGroups' ? 'picked' : ''} onClick={() => setTab('foodGroups')}><Target size={16} /> Grupos de alimentos</button></>}</div>}{tab === 'overview' ? <MemberPlanOverview members={members} plans={plans} diets={diets} role={role} onDeletePlan={deletePlan} onDeleteDiet={deleteDiet} onOpenPlan={(id) => void openPlan(id)} onOpenDiet={(id) => void openDiet(id)} onNewPlan={beginPlan} onNewDiet={beginDiet} /> : tab === 'plans' ? <section className="plan-cards">{plans.length ? plans.map((plan) => <div className="plan-card-wrap" key={plan.id}><button className="panel plan-card" onClick={() => void openPlan(plan.id)}><div className="card-icon"><Dumbbell size={20} /></div><strong>{plan.name}</strong><span>{plan.firstName} {plan.lastName}</span><p>{plan.objective || 'Sin objetivo específico'}</p><div>{plan.dayCount} días · {plan.exerciseCount} ejercicios <ChevronRight size={16} /></div></button>{role === 'ADMIN' && <button className="icon danger-icon plan-card-delete" aria-label={`Eliminar rutina ${plan.name}`} title="Eliminar rutina" onClick={() => void deletePlan(plan)}><Trash2 size={17} /></button>}</div>) : <div className="panel plan-empty"><Dumbbell size={32} /><h2>Sin planes todavía</h2><p>Creá el primer plan mensual para un socio.</p><button className="button primary" onClick={() => beginPlan()}>Crear primer plan</button></div>}</section> : tab === 'diets' ? <section className="plan-cards">{diets.length ? diets.map((diet) => <div className="plan-card-wrap" key={diet.id}><button className="panel plan-card" onClick={() => void openDiet(diet.id)}><div className="card-icon"><Salad size={20} /></div><strong>{diet.name}</strong><span>{diet.firstName} {diet.lastName}</span><p>{diet.objective || 'Sin objetivo específico'}</p><div>{diet.dayCount} días · {diet.itemCount} alimentos <ChevronRight size={16} /></div></button>{role === 'ADMIN' && <button className="icon danger-icon plan-card-delete" aria-label={`Eliminar dieta ${diet.name}`} title="Eliminar dieta" onClick={() => void deleteDiet(diet)}><Trash2 size={17} /></button>}</div>) : <div className="panel plan-empty"><Salad size={32} /><h2>Sin dietas todavía</h2><p>Creá el primer plan mensual de alimentación para un socio.</p><button className="button primary" onClick={() => beginDiet()}>Crear primera dieta</button></div>}</section> : tab === 'catalog' ? <section className="panel catalog"><div className="toolbar"><div className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ejercicio…" /></div><span>{exercises.length} ejercicios</span></div>{exercises.filter((e) => `${e.name} ${e.muscleGroup}`.toLocaleLowerCase('es-AR').includes(search.toLocaleLowerCase('es-AR'))).map((exercise) => <div className="catalog-row" key={exercise.id}><div className="card-icon"><Dumbbell size={17} /></div><div><strong>{exercise.name}</strong><small>{exercise.muscleGroup}{exercise.notes ? ` · ${exercise.notes}` : ''}</small></div><button className="icon" aria-label={`Editar ${exercise.name}`} onClick={() => beginExercise(exercise)}><Pencil size={15} /></button>{role==='ADMIN'&&<button className="icon danger-icon" aria-label={`Eliminar ${exercise.name}`} onClick={() => void deleteExercise(exercise)}><Trash2 size={15} /></button>}</div>)}{!exercises.length && <div className="empty">Todavía no hay ejercicios en el catálogo.</div>}</section> : tab === 'foods' ? <FoodCatalog foods={foods} groups={foodGroups} search={foodSearch} onSearch={setFoodSearch} filter={foodGroupFilter} onFilter={setFoodGroupFilter} onEdit={beginFood} onDelete={(food) => void deleteFood(food)} onCreate={() => beginFood()} role={role} /> : tab === 'foodGroups' ? <section className="group-list">{foodGroups.length ? foodGroups.map((group) => <div className="group-row" key={group.id}><div className="card-icon"><Apple size={17} /></div><div><strong>{group.name}</strong><small>{group.foodCount ? `${group.foodCount} alimento${group.foodCount === 1 ? '' : 's'} en el catálogo` : 'Sin alimentos asignados'}</small></div><button className="icon" aria-label={`Editar ${group.name}`} onClick={() => beginFoodGroup(group)}><Pencil size={15} /></button>{role === 'ADMIN' && <button className="icon danger-icon" aria-label={`Eliminar ${group.name}`} onClick={() => void deleteFoodGroup(group)}><Trash2 size={15} /></button>}</div>) : <div className="panel plan-empty"><Apple size={32} /><h2>Sin grupos de alimentos</h2><p>Creá categorías como Proteínas o Carbohidratos.</p><button className="button primary" onClick={() => beginFoodGroup()}>Crear primer grupo</button></div>}</section> : <section className="group-list">{muscleGroups.length ? muscleGroups.map((group) => <div className="group-row" key={group.id}><div className="card-icon"><Target size={17} /></div><div><strong>{group.name}</strong><small>{group.exerciseCount ? `${group.exerciseCount} ejercicio${group.exerciseCount === 1 ? '' : 's'} en el catálogo` : 'Sin ejercicios asignados'}</small></div><button className="icon" aria-label={`Editar ${group.name}`} onClick={() => beginGroup(group)}><Pencil size={15} /></button>{role === 'ADMIN' && <button className="icon danger-icon" aria-label={`Eliminar ${group.name}`} onClick={() => void deleteGroup(group)}><Trash2 size={15} /></button>}</div>) : <div className="panel plan-empty"><Target size={32} /><h2>Sin grupos musculares</h2><p>Creá los grupos que usan tus rutinas, por ejemplo Pecho, Espalda o Piernas.</p><button className="button primary" onClick={() => beginGroup()}>Crear primer grupo</button></div>}</section>}</>}
    <datalist id="exercise-options">{exercises.map((exercise) => <option key={exercise.id} value={exercise.name} />)}</datalist><datalist id="food-options">{foods.map((food) => <option key={food.id} value={food.name} />)}</datalist>
    {exerciseForm && <div className="backdrop" onMouseDown={() => setExerciseForm(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="exercise-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-title"><div><small>CATÁLOGO</small><h2 id="exercise-title">{exerciseForm === 'new' ? 'Nuevo ejercicio' : 'Editar ejercicio'}</h2></div><button className="icon" aria-label="Cerrar" onClick={() => setExerciseForm(null)}><X size={18} /></button></div><form onSubmit={(e) => { e.preventDefault(); void saveExercise() }}><label>Nombre<input required maxLength={120} value={exerciseDraft.name} onChange={(e) => setExerciseDraft({ ...exerciseDraft, name: e.target.value })} /></label><label>Grupo muscular{muscleGroups.length ? <select required value={exerciseDraft.muscleGroup} onChange={(e) => setExerciseDraft({ ...exerciseDraft, muscleGroup: e.target.value })}>{exerciseDraft.muscleGroup && !muscleGroups.some((group) => group.name === exerciseDraft.muscleGroup) && <option value={exerciseDraft.muscleGroup}>{exerciseDraft.muscleGroup}</option>}{muscleGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}</select> : <input required maxLength={80} value={exerciseDraft.muscleGroup} onChange={(e) => setExerciseDraft({ ...exerciseDraft, muscleGroup: e.target.value })} placeholder="Ej: Pecho" />}</label><label>Observaciones<textarea rows={3} maxLength={500} value={exerciseDraft.notes} onChange={(e) => setExerciseDraft({ ...exerciseDraft, notes: e.target.value })} /></label><div className="actions"><button type="button" className="button secondary" onClick={() => setExerciseForm(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar ejercicio'}</button></div></form></div></div>}
    {groupForm && <div className="backdrop" onMouseDown={() => setGroupForm(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="group-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-title"><div><small>GRUPOS MUSCULARES</small><h2 id="group-title">{groupForm === 'new' ? 'Nuevo grupo muscular' : 'Editar grupo muscular'}</h2></div><button className="icon" aria-label="Cerrar" onClick={() => setGroupForm(null)}><X size={18} /></button></div><form onSubmit={(e) => { e.preventDefault(); void saveGroup() }}><label>Nombre del grupo<input required maxLength={80} value={groupDraft} onChange={(e) => setGroupDraft(e.target.value)} placeholder="Ej: Antebrazo" /></label><div className="actions"><button type="button" className="button secondary" onClick={() => setGroupForm(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar grupo'}</button></div></form></div></div>}
    {foodGroupForm && <div className="backdrop" onMouseDown={() => setFoodGroupForm(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="food-group-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><small>GRUPOS DE ALIMENTOS</small><h2 id="food-group-title">{foodGroupForm === 'new' ? 'Nuevo grupo' : 'Editar grupo'}</h2></div><button className="icon" aria-label="Cerrar" onClick={() => setFoodGroupForm(null)}><X size={18} /></button></div><form onSubmit={(event) => { event.preventDefault(); void saveFoodGroup() }}><label>Nombre del grupo<input required maxLength={80} value={foodGroupDraft} onChange={(event) => setFoodGroupDraft(event.target.value)} placeholder="Ej: Proteínas" /></label><div className="actions"><button type="button" className="button secondary" onClick={() => setFoodGroupForm(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar grupo'}</button></div></form></div></div>}
    {foodForm && <div className="backdrop" onMouseDown={() => setFoodForm(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="food-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-title"><div><small>CATÁLOGO DE ALIMENTOS</small><h2 id="food-title">{foodForm === 'new' ? 'Nuevo alimento' : 'Editar alimento'}</h2></div><button className="icon" aria-label="Cerrar" onClick={() => setFoodForm(null)}><X size={18} /></button></div><form onSubmit={(e) => { e.preventDefault(); void saveFood() }}><label>Nombre<input required maxLength={120} value={foodDraft.name} onChange={(e) => setFoodDraft({ ...foodDraft, name: e.target.value })} placeholder="Ej: Pechuga de pollo" /></label><label>Grupo de alimentos<select value={foodDraft.groupId} onChange={(e) => setFoodDraft({ ...foodDraft, groupId: e.target.value })}><option value="">Sin grupo</option>{foodGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><div className="food-macros"><label>Calorías (kcal)<input required type="number" min={0} max={10000} value={foodDraft.calories} onChange={(e) => setFoodDraft({ ...foodDraft, calories: Number(e.target.value) || 0 })} /></label><label>Proteínas (g)<input required type="number" min={0} max={1000} value={foodDraft.protein} onChange={(e) => setFoodDraft({ ...foodDraft, protein: Number(e.target.value) || 0 })} /></label><label>Carbohidratos (g)<input required type="number" min={0} max={1000} value={foodDraft.carbs} onChange={(e) => setFoodDraft({ ...foodDraft, carbs: Number(e.target.value) || 0 })} /></label><label>Grasas (g)<input required type="number" min={0} max={1000} value={foodDraft.fat} onChange={(e) => setFoodDraft({ ...foodDraft, fat: Number(e.target.value) || 0 })} /></label><small>Valores por cada 100 gramos</small></div><label>Observaciones<textarea rows={3} maxLength={500} value={foodDraft.notes} onChange={(e) => setFoodDraft({ ...foodDraft, notes: e.target.value })} /></label><div className="actions"><button type="button" className="button secondary" onClick={() => setFoodForm(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar alimento'}</button></div></form></div></div>}
  </div>
}
