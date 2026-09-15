import type { jsPDF } from 'jspdf'
import { drawFooter, drawIntro, drawPageChrome, drawWeekBanner } from './pdfDesign'
import { preparePdfLogo } from './pdfLogo'

export type PdfPlan = {
  id: string
  name: string
  objective: string
  startDate: string
  firstName: string
  lastName: string
  birthDate: string | null
  weightKg: string | number | null
  memberObjective: string
  weeks: Array<{
    weekNumber: number
    days: Array<{
      name: string
      muscleGroup: string
      exercises: Array<{
        exerciseName?: string
        sets: number
        reps: string
        load: string
        restSeconds: number | null
        notes: string
      }>
    }>
  }>
}

const RED = '#dc3036'
const DARK = '#171719'
const MUTED = '#68686d'
const BORDER = '#d8d8da'

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function addDays(value: string, count: number) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + count))
  return date.toISOString().slice(0, 10)
}

function ageAt(birthDate: string | null, at: string) {
  if (!birthDate) return 'No registrada'
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number)
  const [y, m, d] = at.slice(0, 10).split('-').map(Number)
  return `${y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)} años`
}

function clean(value: string | null | undefined) { return value?.trim() || '-' }

function drawPage(doc: jsPDF, plan: PdfPlan, logoData?: string, first = false, gymName = 'Legado Gym') {
  drawPageChrome(doc, 'ENTRENAMIENTO', `${plan.firstName} ${plan.lastName}`, plan.name, logoData, first, gymName)
}

function drawWeekHeading(doc: jsPDF, weekNumber: number, startDate: string, continued = false, y = 52) {
  const period = `${formatDate(addDays(startDate, (weekNumber - 1) * 7))} - ${formatDate(addDays(startDate, weekNumber * 7 - 1))}`
  return drawWeekBanner(doc, weekNumber, period, continued, y)
}

function drawTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor('#eeeeef')
  doc.rect(16, y, 178, 9, 'F')
  doc.setTextColor(DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.text('EJERCICIO', 19, y + 6)
  doc.text('SERIES', 81, y + 6)
  doc.text('REPS', 99, y + 6)
  doc.text('CARGA', 122, y + 6)
  doc.text('DESCANSO', 152, y + 6)
  return y + 9
}

export async function buildPlanPdf(plan: PdfPlan, logoData?: string, gymName = 'Legado Gym') {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({ title: `${plan.name} - ${plan.firstName} ${plan.lastName}`, subject: 'Plan de entrenamiento de cuatro semanas', author: gymName })
  drawPage(doc, plan, logoData, true, gymName)
  const yStart = drawIntro(doc, `${plan.firstName} ${plan.lastName}`, plan.name,
    ageAt(plan.birthDate, plan.startDate), plan.weightKg ? `${plan.weightKg} kg` : 'No registrado',
    formatDate(plan.startDate), formatDate(addDays(plan.startDate, 27)), clean(plan.objective || plan.memberObjective))
  let y = drawWeekHeading(doc, 1, plan.startDate, false, yStart)

  for (const [weekIndex, week] of plan.weeks.entries()) {
    if (weekIndex > 0) {
      doc.addPage()
      drawPage(doc, plan, logoData, false, gymName)
      y = drawWeekHeading(doc, week.weekNumber, plan.startDate)
    }
    if (!week.days.length) {
      doc.setTextColor(MUTED)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.text('No hay días de entrenamiento cargados en esta semana.', 19, y + 4)
      continue
    }
    for (const [dayIndex, day] of week.days.entries()) {
      const continuePage = () => {
        doc.addPage()
        drawPage(doc, plan, logoData, false, gymName)
        y = drawWeekHeading(doc, week.weekNumber, plan.startDate, true)
      }
      if (y > 236) continuePage()
      doc.setFillColor('#f3f3f5')
      doc.roundedRect(16, y, 178, 13, 1, 1, 'F')
      doc.setFillColor(RED)
      doc.rect(16, y, 2, 11, 'F')
      doc.setTextColor(DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(clean(day.name), 22, y + 5)
      doc.setTextColor(MUTED)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(clean(day.muscleGroup), 22, y + 10, { maxWidth: 165 })
      y = drawTableHeader(doc, y + 14)
      if (!day.exercises.length) {
        doc.setTextColor(MUTED)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('Sin ejercicios cargados.', 20, y + 8)
        y += 15
      }
      for (const [index, item] of day.exercises.entries()) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const nameLines = doc.splitTextToSize(clean(item.exerciseName), 56) as string[]
        const noteLines = item.notes?.trim() ? doc.splitTextToSize(`Observaciones: ${item.notes.trim()}`, 171) as string[] : []
        const rowHeight = Math.max(11, nameLines.length * 4 + 4) + (noteLines.length ? noteLines.length * 3.8 + 3 : 0)
        if (y + rowHeight > 263) {
          continuePage()
          doc.setTextColor(MUTED)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.text(`${day.name} (continuación)`, 18, y + 4)
          y = drawTableHeader(doc, y + 8)
        }
        if (index % 2 === 0) { doc.setFillColor('#f8f8f9'); doc.rect(16, y, 178, rowHeight, 'F') }
        doc.setTextColor(DARK)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(nameLines, 19, y + 7)
        doc.text(String(item.sets), 81, y + 7)
        doc.text(clean(item.reps), 99, y + 7, { maxWidth: 18 })
        doc.text(clean(item.load), 122, y + 7, { maxWidth: 25 })
        doc.text(item.restSeconds === null ? '-' : `${item.restSeconds} s`, 152, y + 7)
        if (noteLines.length) {
          doc.setTextColor(MUTED)
          doc.setFontSize(7)
          doc.text(noteLines, 19, y + Math.max(11, nameLines.length * 4 + 4) + 1)
        }
        doc.setDrawColor(BORDER)
        doc.line(16, y + rowHeight, 194, y + rowHeight)
        y += rowHeight
      }
      y += dayIndex === week.days.length - 1 ? 0 : 8
    }
  }
  drawFooter(doc, 'ENTRENAMIENTO', gymName)
  return doc
}

export async function createPlanPdf(plan: PdfPlan, logoUrl: string, gymName = 'Legado Gym') {
  const logoData = await preparePdfLogo(logoUrl)
  return buildPlanPdf(plan, logoData, gymName)
}

export async function downloadPlanPdf(plan: PdfPlan, logoUrl: string, gymName = 'Legado Gym') {
  const doc = await createPlanPdf(plan, logoUrl, gymName)
  const slug = `${plan.firstName}-${plan.lastName}-${plan.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)
  doc.save(`legado-gym-${slug || 'plan'}.pdf`)
}
