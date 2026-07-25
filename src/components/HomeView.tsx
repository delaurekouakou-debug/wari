import { useMemo } from 'react'
import { computePay, computePeriodReport, type PayPeriod } from '../lib/calcEngine'
import { createDefaultBulletin } from '../lib/storage'
import type { BulletinByPeriod, PaidAmounts, PaidByPeriod, PaidLine, Planning, Settings } from '../lib/types'

interface Props {
  planning: Planning
  settings: Settings
  paidByPeriod: PaidByPeriod
  bulletinByPeriod: BulletinByPeriod
  period: PayPeriod
  onShiftPeriod: (delta: number) => void
  onNavigate: (tab: 'rapports' | 'comparatif' | 'bulletin' | 'planning') => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const hrs = (n: number) => `${n.toFixed(2)} h`
const EMPTY_LINE: PaidLine = { heures: 0, taux: 0 }
const EMPTY_PAID: PaidAmounts = {
  hs115: EMPTY_LINE,
  hs150: EMPTY_LINE,
  hs175: EMPTY_LINE,
  hs200: EMPTY_LINE,
  panier: EMPTY_LINE,
}

export default function HomeView({
  planning,
  settings,
  paidByPeriod,
  bulletinByPeriod,
  period,
  onShiftPeriod,
  onNavigate,
}: Props) {
  const holidaySet = useMemo(() => new Set(settings.holidays.map((h) => h.date)), [settings.holidays])
  const { overtimeMode, cycleDays, cycleAnchor, normalWeeklyHours } = settings
  const overtime = useMemo(
    () => ({ mode: overtimeMode, cycleDays, cycleAnchor, normalWeeklyHours }),
    [overtimeMode, cycleDays, cycleAnchor, normalWeeklyHours],
  )
  const report = useMemo(
    () => computePeriodReport(planning, holidaySet, period, overtime),
    [planning, holidaySet, period, overtime],
  )
  const pay = computePay(report, settings.hsBases, settings.panierBase, settings.salaireBase)

  const paid = paidByPeriod[period.start] ?? EMPTY_PAID
  const totalPaid = (['hs115', 'hs150', 'hs175', 'hs200', 'panier'] as const).reduce(
    (sum, key) => sum + paid[key].heures * paid[key].taux,
    0,
  )
  const ecart = totalPaid - pay.totalSupplements
  const hasPaidData = (['hs115', 'hs150', 'hs175', 'hs200', 'panier'] as const).some((k) => paid[k].heures > 0)

  const bulletin = bulletinByPeriod[period.start] ?? createDefaultBulletin()
  const gainsFixesTotal = bulletin.gainsFixes.reduce((s, l) => s + l.montant, 0)
  const salaireBrut = gainsFixesTotal + pay.totalSupplements
  const retenuesStatutairesTotal = bulletin.retenuesStatutaires.reduce((s, l) => s + l.montant, 0)
  const retenuesDiversesTotal = bulletin.retenuesDiverses.reduce((s, l) => s + l.montant, 0)
  const netAPayer = salaireBrut - retenuesStatutairesTotal - retenuesDiversesTotal
  const hasBulletinData = gainsFixesTotal > 0

  const joursTravailles = Object.keys(planning).filter(
    (d) => d >= period.start && d <= period.end && planning[d] !== 'REPOS',
  ).length
  const joursRepos = Object.keys(planning).filter(
    (d) => d >= period.start && d <= period.end && planning[d] === 'REPOS',
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Bienvenue</h2>
        <p className="text-sm text-gray-500">
          Choisis ta période de paie active ci-dessous : elle reste la même dans tous les onglets (Rapports,
          Comparatif, Bulletin), pour éviter de mélanger les résultats de différents mois.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 py-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <button
          className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => onShiftPeriod(-1)}
        >
          ← Mois précédent
        </button>
        <span className="text-xl font-bold">{period.label}</span>
        <button
          className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => onShiftPeriod(1)}
        >
          Mois suivant →
        </button>
      </div>

      <div className="text-sm text-gray-500 text-center">
        {joursTravailles} jour(s) travaillé(s) — {joursRepos} jour(s) de repos sur cette période.{' '}
        <button onClick={() => onNavigate('planning')} className="text-emerald-700 dark:text-emerald-400 hover:underline">
          Voir/modifier le planning
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => onNavigate('rapports')}
          className="text-left rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
        >
          <h3 className="font-semibold text-sm text-gray-500">Rapports</h3>
          <p className="text-2xl font-bold mt-1">{fcfa.format(Math.round(pay.totalPay))} FCFA</p>
          <p className="text-xs text-gray-500 mt-1">
            Total dû sur la période, dont {fcfa.format(Math.round(pay.totalSupplements))} FCFA d'heures supp/panier
            ({hrs(report.totalHours)} travaillées).
          </p>
        </button>

        <button
          onClick={() => onNavigate('comparatif')}
          className="text-left rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
        >
          <h3 className="font-semibold text-sm text-gray-500">Comparatif</h3>
          {hasPaidData ? (
            <>
              <p className={`text-2xl font-bold mt-1 ${ecart < 0 ? 'text-red-600' : ecart > 0 ? 'text-emerald-600' : ''}`}>
                {fcfa.format(Math.round(ecart))} FCFA
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Écart entre montant payé et montant dû sur cette période.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-1">Aucun montant payé saisi pour cette période — clique pour comparer.</p>
          )}
        </button>

        <button
          onClick={() => onNavigate('bulletin')}
          className="text-left rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
        >
          <h3 className="font-semibold text-sm text-gray-500">Bulletin</h3>
          {hasBulletinData ? (
            <>
              <p className="text-2xl font-bold mt-1">{fcfa.format(Math.round(netAPayer))} FCFA</p>
              <p className="text-xs text-gray-500 mt-1">Net à payer estimé pour cette période.</p>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-1">Complète tes gains/retenues pour estimer ton net à payer.</p>
          )}
        </button>
      </div>
    </div>
  )
}
