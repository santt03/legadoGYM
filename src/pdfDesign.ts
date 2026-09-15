import type { jsPDF } from 'jspdf'

const RED = '#dc3036'
const DARK = '#171719'
const MUTED = '#68686d'
const BORDER = '#d8d8da'

export function fitText(doc: jsPDF, value: string, width: number) {
  let text = value.trim()
  while (text.length > 1 && doc.getTextWidth(text) > width) text = text.slice(0, -1)
  return text === value.trim() ? text : `${text.trimEnd()}...`
}

export function drawPageChrome(doc: jsPDF, kind: 'ENTRENAMIENTO' | 'ALIMENTACIÓN', person: string, planName: string, logoData?: string, first = false, gymName = 'Legado Gym') {
  doc.setFillColor(DARK)
  doc.rect(0, 0, 210, 43, 'F')
  doc.setFillColor(RED)
  doc.rect(0, 0, 5, 43, 'F')
  if (logoData) doc.addImage(logoData, 'PNG', 16, 10, 27, 27)
  else {
    doc.setFillColor('#303033')
    doc.roundedRect(16, 10, 27, 27, 2, 2, 'F')
    doc.setTextColor('#ffffff')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('LG', 29.5, 27, { align: 'center' })
  }
  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(fitText(doc, gymName.toUpperCase(), 95), 49, 21)
  doc.setTextColor('#ff777b')
  doc.setFontSize(8)
  doc.text(`PLAN DE ${kind}`, 49, 29)
  if (!first) {
    doc.setTextColor('#d0d0d2')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(fitText(doc, `${person}  /  ${planName}`, 72), 194, 25, { align: 'right' })
  }
}

export function drawIntro(doc: jsPDF, person: string, planName: string, age: string, weight: string, start: string, end: string, objective: string) {
  doc.setFillColor('#f4f4f6')
  doc.roundedRect(16, 50, 178, 35, 2, 2, 'F')
  doc.setTextColor(RED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('SOCIO', 21, 57)
  doc.text('PLAN', 110, 57)
  doc.setTextColor(DARK)
  doc.setFontSize(12)
  doc.text(fitText(doc, person, 82), 21, 65)
  doc.setFontSize(10)
  doc.text(fitText(doc, planName, 77), 110, 65)
  doc.setDrawColor(BORDER)
  doc.line(21, 69, 189, 69)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(`EDAD  ${age}`, 21, 77)
  doc.text(`PESO  ${weight}`, 63, 77)
  doc.text(`INICIO  ${start}`, 109, 77)
  doc.text(`FIN  ${end}`, 157, 77)
  const lines = doc.splitTextToSize(objective, 168) as string[]
  const objectiveHeight = Math.max(15, 7 + lines.length * 4)
  doc.setFillColor('#fff6f6')
  doc.roundedRect(16, 90, 178, objectiveHeight, 2, 2, 'F')
  doc.setFillColor(RED)
  doc.rect(16, 90, 2, objectiveHeight, 'F')
  doc.setTextColor(RED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('OBJETIVO', 21, 96)
  doc.setTextColor(DARK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(lines, 21, 102)
  return 90 + objectiveHeight + 6
}

export function drawWeekBanner(doc: jsPDF, weekNumber: number, period: string, continued = false, y = 52, unit = 'SEMANA') {
  doc.setFillColor(DARK)
  doc.roundedRect(16, y, 178, 16, 2, 2, 'F')
  doc.setFillColor(RED)
  doc.roundedRect(16, y, 20, 16, 2, 2, 'F')
  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(String(weekNumber).padStart(2, '0'), 26, y + 10.5, { align: 'center' })
  doc.setFontSize(10)
  doc.text(continued ? `${unit} / CONTINUACIÓN` : `${unit} DE TRABAJO`, 42, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(period, 188, y + 10, { align: 'right' })
  return y + 24
}

export function drawFooter(doc: jsPDF, kind: 'ENTRENAMIENTO' | 'ALIMENTACIÓN', gymName = 'Legado Gym') {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(BORDER)
    doc.line(16, 278, 194, 278)
    doc.setTextColor(MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`${gymName.toUpperCase()}  /  PLAN DE ${kind}`, 16, 284)
    doc.setTextColor(RED)
    doc.setFont('helvetica', 'bold')
    doc.text(`${page} / ${pages}`, 194, 284, { align: 'right' })
  }
}
