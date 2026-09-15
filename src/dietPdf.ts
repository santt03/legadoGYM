import type { jsPDF } from 'jspdf'
import { drawFooter, drawIntro, drawPageChrome, drawWeekBanner } from './pdfDesign'
import { preparePdfLogo } from './pdfLogo'

export type PdfDiet = {
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
      meals: Array<{
        name: string
        items: Array<{
          foodName?: string
          quantity: string
          grams: number | null
          notes: string
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
        }>
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

function addMonths(value: string, count: number) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + count, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

function ageAt(birthDate: string | null, at: string) {
  if (!birthDate) return 'No registrada'
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number)
  const [y, m, d] = at.slice(0, 10).split('-').map(Number)
  return `${y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)} años`
}

function clean(value: string | null | undefined) { return value?.trim() || '-' }

function round1(value: number) { return Math.round(value * 10) / 10 }

function itemMacros(item: PdfDiet['weeks'][number]['days'][number]['meals'][number]['items'][number]) {
  if (!item.grams || item.calories == null || item.protein == null || item.carbs == null || item.fat == null) return null
  const k = item.grams / 100
  return {
    kcal: Math.round(item.calories * k),
    protein: round1(item.protein * k),
    carbs: round1(item.carbs * k),
    fat: round1(item.fat * k),
  }
}

function drawTotals(doc: jsPDF, y: number, macros: { kcal: number; protein: number; carbs: number; fat: number }, hasMacros: boolean) {
  const values = hasMacros ? [String(macros.kcal), String(round1(macros.protein)), String(round1(macros.carbs)), String(round1(macros.fat))] : ['-', '-', '-', '-']
  doc.text(values[0], 124, y, { align: 'right' })
  doc.text(values[1], 141, y, { align: 'right' })
  doc.text(values[2], 158, y, { align: 'right' })
  doc.text(values[3], 175, y, { align: 'right' })
}

function drawPage(doc: jsPDF, diet: PdfDiet, logoData?: string, first = false, gymName = 'Legado Gym') {
  drawPageChrome(doc, 'ALIMENTACIÓN', `${diet.firstName} ${diet.lastName}`, diet.name, logoData, first, gymName)
}

function drawWeekHeading(doc: jsPDF, weekNumber: number, startDate: string, continued = false, y = 52) {
  const period = `${formatDate(addMonths(startDate, weekNumber - 1))} - ${formatDate(addDays(addMonths(startDate, weekNumber), -1))}`
  return drawWeekBanner(doc, weekNumber, period, continued, y, 'MES')
}

function drawTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor('#eeeeef')
  doc.rect(16, y, 178, 9, 'F')
  doc.setTextColor(DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.text('ALIMENTO', 19, y + 6)
  doc.text('CANTIDAD', 100, y + 6, { align: 'right' })
  doc.text('KCAL', 124, y + 6, { align: 'right' })
  doc.text('PROT', 141, y + 6, { align: 'right' })
  doc.text('CARBS', 158, y + 6, { align: 'right' })
  doc.text('GRAS', 175, y + 6, { align: 'right' })
  return y + 9
}

export async function buildDietPdf(diet: PdfDiet, logoData?: string, gymName = 'Legado Gym') {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({ title: `${diet.name} - ${diet.firstName} ${diet.lastName}`, subject: 'Plan mensual de alimentación', author: gymName })
  drawPage(doc, diet, logoData, true, gymName)
  const yStart = drawIntro(doc, `${diet.firstName} ${diet.lastName}`, diet.name,
    ageAt(diet.birthDate, diet.startDate), diet.weightKg ? `${diet.weightKg} kg` : 'No registrado',
    formatDate(diet.startDate), formatDate(addDays(addMonths(diet.startDate, diet.weeks.length), -1)), clean(diet.objective || diet.memberObjective))
  let y = drawWeekHeading(doc, 1, diet.startDate, false, yStart)

  for (const [weekIndex, week] of diet.weeks.entries()) {
    if (weekIndex > 0) {
      doc.addPage()
      drawPage(doc, diet, logoData, false, gymName)
      y = drawWeekHeading(doc, week.weekNumber, diet.startDate)
    }
    if (!week.days.length) {
      doc.setTextColor(MUTED)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.text('No hay menús cargados en este mes.', 19, y + 4)
      continue
    }
    for (const day of week.days) {
      const continuePage = (continuedTitle?: string) => {
        doc.addPage()
        drawPage(doc, diet, logoData, false, gymName)
        y = drawWeekHeading(doc, week.weekNumber, diet.startDate, true)
        if (continuedTitle) {
          doc.setTextColor(DARK)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text(`${continuedTitle} (continuación)`, 19, y + 4)
        }
        if (continuedTitle) y = drawTableHeader(doc, y + 8)
      }
      if (y > 228) continuePage()
      doc.setFillColor('#f3f3f5')
      doc.roundedRect(16, y, 178, 13, 1, 1, 'F')
      doc.setFillColor(RED)
      doc.rect(16, y, 2, 11, 'F')
      doc.setTextColor(DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(clean(day.name), 22, y + 5)
      y = drawTableHeader(doc, y + 14)
      if (!day.meals.length) {
        doc.setTextColor(MUTED)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('Sin comidas cargadas en este día.', 20, y + 8)
        y += 15
      }
      const dayTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      let dayHasMacros = false
      for (const meal of day.meals) {
        if (y > 246) continuePage(clean(day.name))
        doc.setTextColor(DARK)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.text(String(meal.name).toUpperCase(), 18, y + 6)
        y += 9
        const mealTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
        let mealHasMacros = false
        if (!meal.items.length) {
          doc.setTextColor(MUTED)
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(8)
          doc.text('Sin alimentos en esta comida.', 20, y + 13)
          y += 18
        }
        for (const [index, item] of meal.items.entries()) {
          const macros = itemMacros(item)
          if (macros) {
            mealHasMacros = true
            dayHasMacros = true
            mealTotals.kcal += macros.kcal; mealTotals.protein += macros.protein
            mealTotals.carbs += macros.carbs; mealTotals.fat += macros.fat
          }
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          const nameLines = doc.splitTextToSize(clean(item.foodName), 58) as string[]
          const qtyLines = doc.splitTextToSize(item.quantity || '-', 17) as string[]
          const noteLines = item.notes?.trim() ? doc.splitTextToSize(`Observaciones: ${item.notes.trim()}`, 171) as string[] : []
          const rowHeight = Math.max(10, nameLines.length * 4 + 3, qtyLines.length * 3.6 + 3) + (noteLines.length ? noteLines.length * 3.8 + 3 : 0)
          if (y + rowHeight > 263) continuePage(clean(day.name))
          if (index % 2 === 0) { doc.setFillColor('#f8f8f9'); doc.rect(16, y, 178, rowHeight, 'F') }
          doc.setTextColor(DARK)
          doc.text(nameLines, 19, y + 5.5)
          doc.text(qtyLines, 100, y + 5.5, { align: 'right' })
          if (macros) {
            doc.setTextColor(DARK)
            doc.text(String(macros.kcal), 124, y + 5.5, { align: 'right' })
            doc.text(String(macros.protein), 141, y + 5.5, { align: 'right' })
            doc.text(String(macros.carbs), 158, y + 5.5, { align: 'right' })
            doc.text(String(macros.fat), 175, y + 5.5, { align: 'right' })
          } else {
            doc.setTextColor(MUTED)
            doc.setFont('helvetica', 'italic')
            doc.text('—', 124, y + 5.5, { align: 'right' })
            doc.text('—', 141, y + 5.5, { align: 'right' })
            doc.text('—', 158, y + 5.5, { align: 'right' })
            doc.text('—', 175, y + 5.5, { align: 'right' })
            doc.setFont('helvetica', 'normal')
          }
          if (noteLines.length) {
            doc.setTextColor(MUTED)
            doc.setFontSize(6.8)
            doc.text(noteLines, 19, y + Math.max(9, nameLines.length * 4) + 0.5)
          }
          doc.setDrawColor(BORDER)
          doc.line(16, y + rowHeight, 194, y + rowHeight)
          y += rowHeight
        }
        if (meal.items.length) {
          if (y > 260) continuePage(clean(day.name))
          doc.setFillColor('#f2f2f3')
          doc.rect(16, y, 178, 8, 'F')
          doc.setTextColor(MUTED)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.text('SUB TOTAL COMIDA', 19, y + 5.5)
          drawTotals(doc, y + 5.5, mealTotals, mealHasMacros)
          y += 8
          dayTotals.kcal += mealTotals.kcal; dayTotals.protein += mealTotals.protein
          dayTotals.carbs += mealTotals.carbs; dayTotals.fat += mealTotals.fat
        }
      }
      if (y > 262) continuePage(clean(day.name))
      doc.setFillColor(RED)
      doc.rect(16, y, 178, 9, 'F')
      doc.setTextColor('#ffffff')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(`TOTAL DEL DÍA`, 19, y + 6.5)
      drawTotals(doc, y + 6.5, dayTotals, dayHasMacros)
      y += 11
    }
    y += 6
  }
  drawFooter(doc, 'ALIMENTACIÓN', gymName)
  return doc
}

export async function createDietPdf(diet: PdfDiet, logoUrl: string, gymName = 'Legado Gym') {
  const logoData = await preparePdfLogo(logoUrl)
  return buildDietPdf(diet, logoData, gymName)
}

export async function downloadDietPdf(diet: PdfDiet, logoUrl: string, gymName = 'Legado Gym') {
  const doc = await createDietPdf(diet, logoUrl, gymName)
  const slug = `${diet.firstName}-${diet.lastName}-${diet.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)
  doc.save(`legado-gym-${slug || 'dieta'}.pdf`)
}
