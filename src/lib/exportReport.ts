import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { PayBreakdown, PeriodReport } from './calcEngine'

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`
const h = (n: number) => `${n.toFixed(2)} h`

function reportRows(report: PeriodReport, pay: PayBreakdown): [string, string, string][] {
  return [
    ['Heures totales travaillées', h(report.totalHours), ''],
    ['Heures supp 15% (41e-46e h/semaine)', h(report.tier1Hours), fcfa(pay.tier1Amount)],
    ['Heures supp 50% (au-delà 46e h/semaine)', h(report.tier2Hours), fcfa(pay.tier2Amount)],
    ['Heures de nuit (21h-5h, +75%)', h(report.nightHours), fcfa(pay.nightAmount)],
    ['Dimanche / férié jour (+75%)', h(report.sundayHolidayDayHours), fcfa(pay.sundayDayAmount)],
    ['Dimanche / férié nuit (+100%)', h(report.sundayHolidayNightHours), fcfa(pay.sundayNightAmount)],
  ]
}

export function exportReportPdf(report: PeriodReport, pay: PayBreakdown) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Rapport heures supplémentaires', 14, 16)
  doc.setFontSize(10)
  doc.text(`Période : ${report.period.label}`, 14, 23)
  doc.text(`Taux horaire utilisé : ${fcfa(pay.tauxHoraire)}/h`, 14, 29)

  autoTable(doc, {
    startY: 34,
    head: [['Catégorie', 'Heures', 'Montant']],
    body: reportRows(report, pay),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 128, 88] },
  })

  const afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(11)
  doc.text(`Salaire de base : ${fcfa(pay.baseAmount)}`, 14, afterTableY)
  doc.text(`Total suppléments heures supp : ${fcfa(pay.totalSupplements)}`, 14, afterTableY + 6)
  doc.setFontSize(12)
  doc.text(`Total à payer : ${fcfa(pay.totalPay)}`, 14, afterTableY + 14)

  doc.setFontSize(8)
  doc.text(
    'Base légale : Code du travail ivoirien (2015) et Décret n°96-204 du 7 mars 1996 (travail de nuit).',
    14,
    afterTableY + 24,
  )

  doc.save(`heures-supp_${report.period.start}_${report.period.end}.pdf`)
}

export function exportReportExcel(report: PeriodReport, pay: PayBreakdown) {
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Rapport heures supplémentaires'],
    ['Période', report.period.label],
    ['Taux horaire utilisé (FCFA/h)', Math.round(pay.tauxHoraire)],
    [],
    ['Catégorie', 'Heures', 'Montant (FCFA)'],
    ['Heures totales travaillées', report.totalHours, ''],
    ['Heures supp 15% (41e-46e h/semaine)', report.tier1Hours, Math.round(pay.tier1Amount)],
    ['Heures supp 50% (au-delà 46e h/semaine)', report.tier2Hours, Math.round(pay.tier2Amount)],
    ['Heures de nuit (+75%)', report.nightHours, Math.round(pay.nightAmount)],
    ['Dimanche/férié jour (+75%)', report.sundayHolidayDayHours, Math.round(pay.sundayDayAmount)],
    ['Dimanche/férié nuit (+100%)', report.sundayHolidayNightHours, Math.round(pay.sundayNightAmount)],
    [],
    ['Salaire de base', '', Math.round(pay.baseAmount)],
    ['Total suppléments', '', Math.round(pay.totalSupplements)],
    ['Total à payer', '', Math.round(pay.totalPay)],
  ])

  const weeksSheet = XLSX.utils.json_to_sheet(
    report.weeks.map((w) => ({
      'Semaine du': w.weekStart,
      au: w.weekEnd,
      'Total heures': w.totalHours,
      'Heures 15%': w.tier1Hours,
      'Heures 50%': w.tier2Hours,
    })),
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Résumé')
  XLSX.utils.book_append_sheet(wb, weeksSheet, 'Détail semaines')
  XLSX.writeFile(wb, `heures-supp_${report.period.start}_${report.period.end}.xlsx`)
}
