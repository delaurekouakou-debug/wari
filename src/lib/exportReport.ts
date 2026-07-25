import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motifForDay, type DayDetail, type PayBreakdown, type PayPeriod, type PeriodReport } from './calcEngine'
import { parseDateKey } from './dateUtils'
import type { BulletinData, PaidAmounts, Settings } from './types'

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

const PAGE_WIDTH = 190 // largeur utile (A4, marges 10mm de chaque côté)
const PAGE_BOTTOM = 280

/** Écrit un paragraphe avec retour à la ligne automatique, en insérant des sauts de page si besoin. Retourne le Y final. */
function writeParagraph(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5): number {
  const lines: string[] = doc.splitTextToSize(text, maxWidth)
  for (const line of lines) {
    if (y > PAGE_BOTTOM) {
      doc.addPage()
      y = 20
    }
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function legalJustificationBlocks(settings: Settings): { title: string; body: string }[] {
  const { hsRates, overtimeMode, cycleDays, normalWeeklyHours } = settings
  const tier1End = normalWeeklyHours + 6
  const periodLabel = overtimeMode === 'cycle' ? `période de ${cycleDays} jours` : 'semaine civile (lundi-dimanche)'

  return [
    {
      title: `Mode de calcul actif : ${overtimeMode === 'cycle' ? `Cycle de travail (${cycleDays} jours)` : 'Semaine civile (lundi-dimanche)'}`,
      body:
        overtimeMode === 'cycle'
          ? `Travail en équipes successives organisé en cycle de rotation dépassant la semaine : les seuils de majoration (${normalWeeklyHours}h puis +6h) sont calculés sur la durée moyenne du cycle complet de ${cycleDays} jours, et non semaine civile par semaine civile. Décret n°96-203 du 7 mars 1996 relatif à la durée du travail : pour le travail organisé en cycle de rotation dépassant la semaine, seules les heures dépassant la durée moyenne de travail calculée sur le cycle complet — plafonnée à 42h/semaine en moyenne — sont des heures supplémentaires.`
          : `Seuils calculés semaine civile par semaine civile (lundi 00h00 à dimanche 24h00). Si le planning suit un cycle de rotation fixe (ex: 2 jours-2 nuits-2 repos), le Décret n°96-203 prévoit que le calcul se fasse sur la durée moyenne du cycle complet plutôt que semaine par semaine.`,
    },
    {
      title: `HS ${hsRates.r115}%`,
      body: `Heures effectuées entre la ${normalWeeklyHours + 1}e et la ${tier1End}e heure de la ${periodLabel}, au-delà du seuil normal de ${normalWeeklyHours}h. Code du travail ivoirien (loi n°2015-532) et Décret n°96-203 du 7 mars 1996 ; majoration de 15% pour les 6 premières heures supplémentaires.`,
    },
    {
      title: `HS ${hsRates.r150}%`,
      body: `Heures effectuées au-delà de la ${tier1End}e heure de la même période. Même base légale ; majoration de 50% au-delà de la 6e heure supplémentaire.`,
    },
    {
      title: `HS ${hsRates.r175}%`,
      body: `Heures effectuées de nuit (21h-5h), quel que soit le nombre d'heures déjà travaillées, ou heures de jour effectuées un dimanche ou un jour férié. Décret n°96-204 du 7 mars 1996 relatif au travail de nuit (+75%) ; majoration dimanche/férié fixée à +75% pour les heures de jour (Décret n°96-203).`,
    },
    {
      title: `HS ${hsRates.r200}%`,
      body: `Heures effectuées de nuit (21h-5h) un dimanche ou un jour férié. Cumul des deux motifs (nuit + dimanche/férié), retenu au taux de +100%.`,
    },
    {
      title: 'Prime de panier',
      body: `Indemnité versée pour chaque vacation de nuit travaillée (18h-6h30 ou 22h-6h30), en compensation de l'impossibilité de prendre un repas dans des conditions normales pendant les heures de nuit.`,
    },
    {
      title: 'Règle de cumul',
      body: `Quand une heure remplit plusieurs conditions à la fois (ex: heure supp hebdomadaire ET heure de nuit), seul le taux le plus favorable est retenu — pas de cumul des majorations. C'est une hypothèse de calcul à vérifier avec les RH : une lecture cumulative stricte du Code du travail pourrait justifier l'addition des majorations sur ces heures-là.`,
    },
  ]
}

export function exportComparatifPdf(
  report: PeriodReport,
  pay: PayBreakdown,
  paid: PaidAmounts,
  settings: Settings,
  dayDetails: DayDetail[],
) {
  const doc = new jsPDF()

  // Page 1 : tableau comparatif
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

  const ecartY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  const ecart = totalPaid - totalDue
  doc.setFontSize(10)
  doc.text(
    ecart < 0
      ? `Il manquerait ${fcfa(-ecart)} sur cette période par rapport au calcul dû.`
      : ecart > 0
        ? `${fcfa(ecart)} reçus en plus du calcul dû sur cette période.`
        : 'Montant payé conforme au calcul dû.',
    14,
    ecartY,
  )

  // Page 2+ : base légale et justification
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Base légale et justification — pour discussion avec les RH', 14, 16)
  let y = 26
  doc.setFontSize(10)
  for (const block of legalJustificationBlocks(settings)) {
    if (y > PAGE_BOTTOM - 10) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    y = writeParagraph(doc, block.title, 14, y, PAGE_WIDTH, 6)
    doc.setFont('helvetica', 'normal')
    y = writeParagraph(doc, block.body, 14, y, PAGE_WIDTH, 5) + 4
  }

  // Page suivante : détail journalier
  if (dayDetails.length > 0) {
    doc.addPage()
    doc.setFontSize(14)
    doc.text('Détail journalier — preuves par date', 14, 16)
    doc.setFontSize(9)
    doc.text('Uniquement les jours générant des heures majorées ou une prime de panier sur la période.', 14, 22)

    autoTable(doc, {
      startY: 27,
      head: [['Date', 'Jour', 'Vacation', '115%', '150%', '175%', '200%', 'Panier', 'Motif']],
      body: dayDetails.map((d) => [
        d.date,
        format(parseDateKey(d.date), 'EEEE', { locale: fr }),
        d.shiftLabel,
        d.hs115 > 0 ? h(d.hs115) : '—',
        d.hs150 > 0 ? h(d.hs150) : '—',
        d.hs175 > 0 ? h(d.hs175) : '—',
        d.hs200 > 0 ? h(d.hs200) : '—',
        d.isPanier ? '1 vac.' : '—',
        motifForDay(d),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [16, 128, 88] },
      columnStyles: { 8: { cellWidth: 55 } },
    })
  }

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

export interface BulletinTotals {
  gainsFixesTotal: number
  hsTotal: number
  salaireBrut: number
  retenuesStatutairesTotal: number
  salaireAvantRetenues: number
  retenuesDiversesTotal: number
  netAPayer: number
}

interface BulletinHsRow {
  code: string
  label: string
  montant: number
}

export function exportBulletinPdf(
  period: PayPeriod,
  categorie: string,
  bulletin: BulletinData,
  hsRows: BulletinHsRow[],
  totals: BulletinTotals,
) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Bulletin de salaire (estimation)', 14, 16)
  doc.setFontSize(10)
  doc.text(`Période : ${period.label}${categorie ? ` — Catégorie ${categorie}` : ''}`, 14, 23)

  const rows: [string, string, string][] = [
    ...bulletin.gainsFixes.map((l): [string, string, string] => [l.code, l.label, fcfa(l.montant)]),
    ...hsRows.map((r): [string, string, string] => [r.code, r.label, fcfa(r.montant)]),
    ['3000', '=== SALAIRE BRUT', fcfa(totals.salaireBrut)],
    ...bulletin.retenuesStatutaires.map((l): [string, string, string] => [l.code, l.label, `-${fcfa(l.montant)}`]),
    ['6500', '=== SALAIRE AVANT RETENUES', fcfa(totals.salaireAvantRetenues)],
    ...bulletin.retenuesDiverses.map((l): [string, string, string] => [l.code, l.label, `-${fcfa(l.montant)}`]),
    ['9200', 'NET A PAYER (APPOINT)', fcfa(totals.netAPayer)],
  ]

  autoTable(doc, {
    startY: 30,
    head: [['Code', 'Libellé', 'Montant']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 128, 88] },
    didParseCell: (data) => {
      if (data.row.raw && (data.row.raw as string[])[1]?.toString().startsWith('===')) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  doc.save(`bulletin_${period.start}_${period.end}.pdf`)
}

export function exportBulletinExcel(
  period: PayPeriod,
  categorie: string,
  bulletin: BulletinData,
  hsRows: BulletinHsRow[],
  totals: BulletinTotals,
) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Bulletin de salaire (estimation)'],
    ['Période', period.label],
    ['Catégorie', categorie],
    [],
    ['Code', 'Libellé', 'Montant (FCFA)'],
    ...bulletin.gainsFixes.map((l) => [l.code, l.label, Math.round(l.montant)]),
    ...hsRows.map((r) => [r.code, r.label, Math.round(r.montant)]),
    ['3000', '=== SALAIRE BRUT', Math.round(totals.salaireBrut)],
    ...bulletin.retenuesStatutaires.map((l) => [l.code, l.label, -Math.round(l.montant)]),
    ['6500', '=== SALAIRE AVANT RETENUES', Math.round(totals.salaireAvantRetenues)],
    ...bulletin.retenuesDiverses.map((l) => [l.code, l.label, -Math.round(l.montant)]),
    ['9200', 'NET A PAYER (APPOINT)', Math.round(totals.netAPayer)],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Bulletin')
  XLSX.writeFile(wb, `bulletin_${period.start}_${period.end}.xlsx`)
}
