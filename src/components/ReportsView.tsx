import { useMemo, useState } from 'react'
import {
  computePay,
  computePeriodReport,
  getPayPeriod,
  LEGAL_MONTHLY_HOURS,
  shiftPayPeriod,
} from '../lib/calcEngine'
import { exportReportExcel, exportReportPdf } from '../lib/exportReport'
import { formatDateKey } from '../lib/dateUtils'
import type { Planning, Settings } from '../lib/types'

interface Props {
  planning: Planning
  settings: Settings
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const hrs = (n: number) => `${n.toFixed(2)} h`

export default function ReportsView({ planning, settings }: Props) {
  const [period, setPeriod] = useState(() => getPayPeriod(formatDateKey(new Date()), settings.payPeriodStartDay))

  const holidaySet = useMemo(() => new Set(settings.holidays.map((h) => h.date)), [settings.holidays])
  const report = useMemo(
    () => computePeriodReport(planning, holidaySet, period),
    [planning, holidaySet, period],
  )

  const tauxHoraireLegal = settings.salaireBase > 0 ? settings.salaireBase / LEGAL_MONTHLY_HOURS : 0
  const payLegal = computePay(report, tauxHoraireLegal, settings.salaireBase)
  const payBulletin =
    settings.tauxHoraireBulletin != null ? computePay(report, settings.tauxHoraireBulletin, settings.salaireBase) : null

  const rows: { label: string; hours: number; rate: string }[] = [
    { label: 'Heures totales travaillées', hours: report.totalHours, rate: '—' },
    { label: 'Heures supp 41e-46e h/semaine', hours: report.tier1Hours, rate: '+15%' },
    { label: 'Heures supp au-delà 46e h/semaine', hours: report.tier2Hours, rate: '+50%' },
    { label: 'Heures de nuit (21h-5h)', hours: report.nightHours, rate: '+75%' },
    { label: 'Dimanche / férié — jour', hours: report.sundayHolidayDayHours, rate: '+75%' },
    { label: 'Dimanche / férié — nuit', hours: report.sundayHolidayNightHours, rate: '+100%' },
  ]

  const amountsLegal = [
    null,
    payLegal.tier1Amount,
    payLegal.tier2Amount,
    payLegal.nightAmount,
    payLegal.sundayDayAmount,
    payLegal.sundayNightAmount,
  ]
  const amountsBulletin = payBulletin
    ? [null, payBulletin.tier1Amount, payBulletin.tier2Amount, payBulletin.nightAmount, payBulletin.sundayDayAmount, payBulletin.sundayNightAmount]
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setPeriod((p) => shiftPayPeriod(p, -1, settings.payPeriodStartDay))}
          >
            ←
          </button>
          <h2 className="text-lg font-semibold">{report.period.label}</h2>
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setPeriod((p) => shiftPayPeriod(p, 1, settings.payPeriodStartDay))}
          >
            →
          </button>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => exportReportPdf(report, payLegal)}
            className="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-900 text-sm"
          >
            Export PDF
          </button>
          <button
            onClick={() => exportReportExcel(report, payLegal)}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
          >
            Export Excel
          </button>
        </div>
      </div>

      {settings.salaireBase === 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
          Renseigne ton salaire de base dans les Paramètres pour voir les montants en FCFA.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
              <th className="py-2 pr-3">Catégorie</th>
              <th className="py-2 pr-3">Taux</th>
              <th className="py-2 pr-3">Heures</th>
              <th className="py-2 pr-3">Montant (taux légal)</th>
              {payBulletin && <th className="py-2 pr-3">Montant (taux bulletin)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1.5 pr-3">{row.label}</td>
                <td className="py-1.5 pr-3 text-gray-500">{row.rate}</td>
                <td className="py-1.5 pr-3">{hrs(row.hours)}</td>
                <td className="py-1.5 pr-3">{amountsLegal[i] == null ? '—' : `${fcfa.format(Math.round(amountsLegal[i]!))} FCFA`}</td>
                {payBulletin && (
                  <td className="py-1.5 pr-3">
                    {amountsBulletin && amountsBulletin[i] == null ? '—' : `${fcfa.format(Math.round(amountsBulletin![i]!))} FCFA`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <h3 className="font-semibold text-sm text-gray-500">Taux légal ({fcfa.format(Math.round(tauxHoraireLegal))} FCFA/h)</h3>
          <p>Salaire de base : {fcfa.format(Math.round(payLegal.baseAmount))} FCFA</p>
          <p>Suppléments heures supp : {fcfa.format(Math.round(payLegal.totalSupplements))} FCFA</p>
          <p className="text-lg font-semibold">Total : {fcfa.format(Math.round(payLegal.totalPay))} FCFA</p>
        </div>
        {payBulletin && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-1">
            <h3 className="font-semibold text-sm text-gray-500">
              Taux bulletin ({fcfa.format(Math.round(settings.tauxHoraireBulletin!))} FCFA/h)
            </h3>
            <p>Salaire de base : {fcfa.format(Math.round(payBulletin.baseAmount))} FCFA</p>
            <p>Suppléments heures supp : {fcfa.format(Math.round(payBulletin.totalSupplements))} FCFA</p>
            <p className="text-lg font-semibold">Total : {fcfa.format(Math.round(payBulletin.totalPay))} FCFA</p>
            <p className={`text-sm ${payBulletin.totalSupplements - payLegal.totalSupplements < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              Écart vs taux légal : {fcfa.format(Math.round(payBulletin.totalSupplements - payLegal.totalSupplements))} FCFA
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-2">Détail par semaine</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
                <th className="py-1.5 pr-3">Semaine</th>
                <th className="py-1.5 pr-3">Total</th>
                <th className="py-1.5 pr-3">15%</th>
                <th className="py-1.5 pr-3">50%</th>
              </tr>
            </thead>
            <tbody>
              {report.weeks.map((w) => (
                <tr key={w.weekStart} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1 pr-3">
                    {w.weekStart} — {w.weekEnd}
                  </td>
                  <td className="py-1 pr-3">{hrs(w.totalHours)}</td>
                  <td className="py-1 pr-3">{hrs(w.tier1Hours)}</td>
                  <td className="py-1 pr-3">{hrs(w.tier2Hours)}</td>
                </tr>
              ))}
              {report.weeks.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-gray-500">
                    Aucune semaine sur cette période
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Base légale : Code du travail ivoirien (2015) — durée légale 40h/semaine — et Décret n°96-204 du 7 mars 1996
        relatif au travail de nuit. Les heures supp (15%/50%) sont calculées par semaine civile (lundi-dimanche) et
        rattachées à la période de paie du dimanche de clôture de chaque semaine.
      </p>
    </div>
  )
}
