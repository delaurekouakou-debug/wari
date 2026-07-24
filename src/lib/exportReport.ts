import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { PayBreakdown, PeriodReport } from './calcEngine'
import type { PaidAmounts } from './types'

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`
const h = (n: number) => `${n.toFixed(2)} h`

function reportRows(report: PeriodReport, pay: PayBreakdown): [string, string, string, string][] {
  return [
    ['0820', 'MONTANT DES HS 115%', h(report.hs115Hours), fcfa(pay.hs115Amount)],
    ['0830', 'MONTANT DES HS 150%', h(report.hs150Hours), fcfa(pay.hs150Amount)],
    ['0840', 'MONTANT DES HS 175%', h(report.hs175Hours), fcfa(pay.hs175Amount)],
    ['0850', 'MONTANT DES HS 200%', h(report.hs200Hours), fcfa(pay.hs200Amount)],
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
    head: [['Code', 'Libellé', 'Heures', 'Montant']],
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
    ['Code', 'Libellé', 'Heures', 'Montant (FCFA)'],
    ['0820', 'MONTANT DES HS 115%', report.hs115Hours, Math.round(pay.hs115Amount)],
    ['0830', 'MONTANT DES HS 150%', report.hs150Hours, Math.round(pay.hs150Amount)],
    ['0840', 'MONTANT DES HS 175%', report.hs175Hours, Math.round(pay.hs175Amount)],
    ['0850', 'MONTANT DES HS 200%', report.hs200Hours, Math.round(pay.hs200Amount)],
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
    })),
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Résumé')
  XLSX.utils.book_append_sheet(wb, weeksSheet, 'Détail semaines')
  XLSX.writeFile(wb, `heures-supp_${report.period.start}_${report.period.end}.xlsx`)
}

export function exportComparatifPdf(report: PeriodReport, pay: PayBreakdown, paid: PaidAmounts) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Comparatif heures supplémentaires — payé vs dû', 14, 16)
  doc.setFontSize(10)
  doc.text(`Période : ${report.period.label}`, 14, 23)
  doc.text(`Taux horaire légal : ${fcfa(pay.tauxHoraire)}/h`, 14, 29)

  const rows: [string, string, string, string, string][] = [
    ['0820', 'MONTANT DES HS 115%', fcfa(pay.hs115Amount), fcfa(paid.hs115), fcfa(paid.hs115 - pay.hs115Amount)],
    ['0830', 'MONTANT DES HS 150%', fcfa(pay.hs150Amount), fcfa(paid.hs150), fcfa(paid.hs150 - pay.hs150Amount)],
    ['0840', 'MONTANT DES HS 175%', fcfa(pay.hs175Amount), fcfa(paid.hs175), fcfa(paid.hs175 - pay.hs175Amount)],
    ['0850', 'MONTANT DES HS 200%', fcfa(pay.hs200Amount), fcfa(paid.hs200), fcfa(paid.hs200 - pay.hs200Amount)],
  ]
  const totalDu = pay.totalSupplements
  const totalPaye = paid.hs115 + paid.hs150 + paid.hs175 + paid.hs200

  autoTable(doc, {
    startY: 34,
    head: [['Code', 'Libellé', 'Montant dû', 'Montant payé', 'Écart']],
    body: rows,
    foot: [['', 'Total', fcfa(totalDu), fcfa(totalPaye), fcfa(totalPaye - totalDu)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 128, 88] },
    footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
  })

  doc.setFontSize(8)
  const afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.text(
    'Base légale : Code du travail ivoirien (2015) et Décret n°96-204 du 7 mars 1996 (travail de nuit). Montants payés saisis manuellement depuis le bulletin de paie.',
    14,
    afterTableY,
  )

  doc.save(`comparatif-hs_${report.period.start}_${report.period.end}.pdf`)
}

export function exportComparatifExcel(report: PeriodReport, pay: PayBreakdown, paid: PaidAmounts) {
  const totalDu = pay.totalSupplements
  const totalPaye = paid.hs115 + paid.hs150 + paid.hs175 + paid.hs200
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Comparatif heures supplémentaires — payé vs dû'],
    ['Période', report.period.label],
    ['Taux horaire légal (FCFA/h)', Math.round(pay.tauxHoraire)],
    [],
    ['Code', 'Libellé', 'Montant dû', 'Montant payé', 'Écart'],
    ['0820', 'MONTANT DES HS 115%', Math.round(pay.hs115Amount), Math.round(paid.hs115), Math.round(paid.hs115 - pay.hs115Amount)],
    ['0830', 'MONTANT DES HS 150%', Math.round(pay.hs150Amount), Math.round(paid.hs150), Math.round(paid.hs150 - pay.hs150Amount)],
    ['0840', 'MONTANT DES HS 175%', Math.round(pay.hs175Amount), Math.round(paid.hs175), Math.round(paid.hs175 - pay.hs175Amount)],
    ['0850', 'MONTANT DES HS 200%', Math.round(pay.hs200Amount), Math.round(paid.hs200), Math.round(paid.hs200 - pay.hs200Amount)],
    ['', 'Total', Math.round(totalDu), Math.round(totalPaye), Math.round(totalPaye - totalDu)],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Comparatif')
  XLSX.writeFile(wb, `comparatif-hs_${report.period.start}_${report.period.end}.xlsx`)
}
