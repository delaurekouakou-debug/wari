import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { PayBreakdown, PeriodReport } from './calcEngine'
import type { PaidAmounts } from './types'

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`
const fcfa2 = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`
const h = (n: number) => `${n.toFixed(2)} h`

export function exportReportPdf(report: PeriodReport, pay: PayBreakdown) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Rapport heures supplémentaires', 14, 16)
  doc.setFontSize(10)
  doc.text(`Période : ${report.period.label}`, 14, 23)

  autoTable(doc, {
    startY: 30,
    head: [['Code', 'Libellé', 'Base', 'Quantité', 'Montant']],
    body: [
      ['0820', 'MONTANT DES HS 115%', fcfa2(pay.hs115Rate), h(report.hs115Hours), fcfa(pay.hs115Amount)],
      ['0830', 'MONTANT DES HS 150%', fcfa2(pay.hs150Rate), h(report.hs150Hours), fcfa(pay.hs150Amount)],
      ['0840', 'MONTANT DES HS 175%', fcfa2(pay.hs175Rate), h(report.hs175Hours), fcfa(pay.hs175Amount)],
      ['0850', 'MONTANT DES HS 200%', fcfa2(pay.hs200Rate), h(report.hs200Hours), fcfa(pay.hs200Amount)],
      ['1170', 'PRIME DE PANIER', fcfa2(pay.panierAmount > 0 ? pay.panierAmount / report.panierCount : 0), `${report.panierCount} vac.`, fcfa(pay.panierAmount)],
    ],
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
    [],
    ['Code', 'Libellé', 'Base (FCFA)', 'Quantité', 'Montant (FCFA)'],
    ['0820', 'MONTANT DES HS 115%', pay.hs115Rate, report.hs115Hours, Math.round(pay.hs115Amount)],
    ['0830', 'MONTANT DES HS 150%', pay.hs150Rate, report.hs150Hours, Math.round(pay.hs150Amount)],
    ['0840', 'MONTANT DES HS 175%', pay.hs175Rate, report.hs175Hours, Math.round(pay.hs175Amount)],
    ['0850', 'MONTANT DES HS 200%', pay.hs200Rate, report.hs200Hours, Math.round(pay.hs200Amount)],
    ['1170', 'PRIME DE PANIER', '', report.panierCount, Math.round(pay.panierAmount)],
    [],
    ['Salaire de base', '', '', '', Math.round(pay.baseAmount)],
    ['Total suppléments', '', '', '', Math.round(pay.totalSupplements)],
    ['Total à payer', '', '', '', Math.round(pay.totalPay)],
  ])

  const weeksSheet = XLSX.utils.json_to_sheet(
    report.periods.map((p) => ({
      'Période du': p.periodStart,
      au: p.periodEnd,
      'Total heures': p.totalHours,
    })),
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Résumé')
  XLSX.utils.book_append_sheet(wb, weeksSheet, 'Détail semaines')
  XLSX.writeFile(wb, `heures-supp_${report.period.start}_${report.period.end}.xlsx`)
}

function paidMontant(paid: PaidAmounts, key: keyof PaidAmounts): number {
  return paid[key].heures * paid[key].taux
}

interface ComparatifSpec {
  code: string
  label: string
  unit: string
  qtyDue: number
  baseDue: number
  montantDue: number
  paidKey: keyof PaidAmounts
}

function comparatifSpecs(report: PeriodReport, pay: PayBreakdown): ComparatifSpec[] {
  return [
    { code: '0820', label: 'HS 115%', unit: 'h', qtyDue: report.hs115Hours, baseDue: pay.hs115Rate, montantDue: pay.hs115Amount, paidKey: 'hs115' },
    { code: '0830', label: 'HS 150%', unit: 'h', qtyDue: report.hs150Hours, baseDue: pay.hs150Rate, montantDue: pay.hs150Amount, paidKey: 'hs150' },
    { code: '0840', label: 'HS 175%', unit: 'h', qtyDue: report.hs175Hours, baseDue: pay.hs175Rate, montantDue: pay.hs175Amount, paidKey: 'hs175' },
    { code: '0850', label: 'HS 200%', unit: 'h', qtyDue: report.hs200Hours, baseDue: pay.hs200Rate, montantDue: pay.hs200Amount, paidKey: 'hs200' },
    { code: '1170', label: 'PRIME DE PANIER', unit: 'vac.', qtyDue: report.panierCount, baseDue: pay.panierAmount > 0 ? pay.panierAmount / report.panierCount : 0, montantDue: pay.panierAmount, paidKey: 'panier' },
  ]
}

const LEGAL_NOTE =
  "Base légale : Code du travail ivoirien (loi n°2015-532), durée légale 40h/semaine (majorations 15%/50%) ; " +
  "Décret n°96-204 du 7 mars 1996 relatif au travail de nuit (+75%) ; majoration dimanche/férié +75% (jour) / " +
  "+100% (nuit). Un seul palier retenu par heure (le plus favorable), pas de cumul des majorations. Montants " +
  "payés saisis manuellement depuis le bulletin de paie."

export function exportComparatifPdf(report: PeriodReport, pay: PayBreakdown, paid: PaidAmounts) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Comparatif heures supplémentaires — payé vs dû', 14, 16)
  doc.setFontSize(10)
  doc.text(`Période : ${report.period.label}`, 14, 23)

  const specs = comparatifSpecs(report, pay)
  const rows = specs.map((s) => {
    const montantPaye = paidMontant(paid, s.paidKey)
    const qtyLabel = (n: number) => (s.unit === 'h' ? h(n) : `${n} ${s.unit}`)
    return [
      s.code,
      s.label,
      qtyLabel(s.qtyDue),
      fcfa2(s.baseDue),
      fcfa(s.montantDue),
      qtyLabel(paid[s.paidKey].heures),
      fcfa2(paid[s.paidKey].taux),
      fcfa(montantPaye),
      fcfa(montantPaye - s.montantDue),
    ]
  })
  const totalDue = pay.totalSupplements
  const totalPaid = specs.reduce((sum, s) => sum + paidMontant(paid, s.paidKey), 0)

  autoTable(doc, {
    startY: 30,
    head: [['Code', 'Libellé', 'N dû', 'Base dû', 'Montant dû', 'N payé', 'Base payé', 'Montant payé', 'Écart']],
    body: rows,
    foot: [['', 'Total', '', '', fcfa(totalDue), '', '', fcfa(totalPaid), fcfa(totalPaid - totalDue)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 128, 88] },
    footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
  })

  doc.setFontSize(8)
  const afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  const noteLines = doc.splitTextToSize(LEGAL_NOTE, 180)
  doc.text(noteLines, 14, afterTableY)

  doc.save(`comparatif-hs_${report.period.start}_${report.period.end}.pdf`)
}

export function exportComparatifExcel(report: PeriodReport, pay: PayBreakdown, paid: PaidAmounts) {
  const specs = comparatifSpecs(report, pay)
  const totalDue = pay.totalSupplements
  const totalPaid = specs.reduce((sum, s) => sum + paidMontant(paid, s.paidKey), 0)

  const sheet = XLSX.utils.aoa_to_sheet([
    ['Comparatif heures supplémentaires — payé vs dû'],
    ['Période', report.period.label],
    [],
    ['Code', 'Libellé', 'N dû', 'Base dû', 'Montant dû', 'N payé', 'Base payé', 'Montant payé', 'Écart'],
    ...specs.map((s) => {
      const montantPaye = paidMontant(paid, s.paidKey)
      return [
        s.code,
        s.label,
        s.qtyDue,
        s.baseDue,
        Math.round(s.montantDue),
        paid[s.paidKey].heures,
        paid[s.paidKey].taux,
        Math.round(montantPaye),
        Math.round(montantPaye - s.montantDue),
      ]
    }),
    ['', 'Total', '', '', Math.round(totalDue), '', '', Math.round(totalPaid), Math.round(totalPaid - totalDue)],
    [],
    [LEGAL_NOTE],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Comparatif')
  XLSX.writeFile(wb, `comparatif-hs_${report.period.start}_${report.period.end}.xlsx`)
}
