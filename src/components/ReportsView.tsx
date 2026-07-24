import { useMemo, useState } from 'react'
import { computePay, computePeriodReport, getPayPeriod, shiftPayPeriod } from '../lib/calcEngine'
import { exportReportExcel, exportReportPdf } from '../lib/exportReport'
import { formatDateKey } from '../lib/dateUtils'
import type { Planning, Settings } from '../lib/types'

interface Props {
  planning: Planning
  settings: Settings
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const fcfa2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const hrs = (n: number) => `${n.toFixed(2)} h`

export default function ReportsView({ planning, settings }: Props) {
  const [period, setPeriod] = useState(() => getPayPeriod(formatDateKey(new Date()), settings.payPeriodStartDay))

  const holidaySet = useMemo(() => new Set(settings.holidays.map((h) => h.date)), [settings.holidays])
  const report = useMemo(() => computePeriodReport(planning, holidaySet, period), [planning, holidaySet, period])

  const pay = computePay(report, settings.hsBases, settings.salaireBase)
  const hasBases = settings.hsBases.r115 > 0 || settings.hsBases.r150 > 0 || settings.hsBases.r175 > 0 || settings.hsBases.r200 > 0

  const rows = [
    { code: '0820', label: `MONTANT DES HS ${settings.hsRates.r115}%`, base: pay.hs115Rate, hours: report.hs115Hours, amount: pay.hs115Amount },
    { code: '0830', label: `MONTANT DES HS ${settings.hsRates.r150}%`, base: pay.hs150Rate, hours: report.hs150Hours, amount: pay.hs150Amount },
    { code: '0840', label: `MONTANT DES HS ${settings.hsRates.r175}%`, base: pay.hs175Rate, hours: report.hs175Hours, amount: pay.hs175Amount },
    { code: '0850', label: `MONTANT DES HS ${settings.hsRates.r200}%`, base: pay.hs200Rate, hours: report.hs200Hours, amount: pay.hs200Amount },
  ]

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
            onClick={() => exportReportPdf(report, pay)}
            className="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-900 text-sm"
          >
            Export PDF
          </button>
          <button
            onClick={() => exportReportExcel(report, pay)}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
          >
            Export Excel
          </button>
        </div>
      </div>

      {!hasBases && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
          Renseigne les bases horaires par palier dans les Paramètres pour voir les montants en FCFA.
        </p>
      )}

      <div className="text-sm text-gray-500">
        Heures normales (couvertes par le salaire de base) : {hrs(report.normalHours)} — Total travaillé :{' '}
        {hrs(report.totalHours)}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Libellé</th>
              <th className="py-2 pr-3">Base (taux chargé)</th>
              <th className="py-2 pr-3">Heures</th>
              <th className="py-2 pr-3">Montant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1.5 pr-3 text-gray-500">{row.code}</td>
                <td className="py-1.5 pr-3">{row.label}</td>
                <td className="py-1.5 pr-3 text-gray-500">{fcfa2.format(row.base)} FCFA/h</td>
                <td className="py-1.5 pr-3">{hrs(row.hours)}</td>
                <td className="py-1.5 pr-3">{fcfa.format(Math.round(row.amount))} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-1 max-w-sm">
        <p>Salaire de base : {fcfa.format(Math.round(pay.baseAmount))} FCFA</p>
        <p>Total suppléments heures supp : {fcfa.format(Math.round(pay.totalSupplements))} FCFA</p>
        <p className="text-lg font-semibold">Total : {fcfa.format(Math.round(pay.totalPay))} FCFA</p>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Détail par semaine</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
                <th className="py-1.5 pr-3">Semaine</th>
                <th className="py-1.5 pr-3">Total heures</th>
              </tr>
            </thead>
            <tbody>
              {report.weeks.map((w) => (
                <tr key={w.weekStart} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1 pr-3">
                    {w.weekStart} — {w.weekEnd}
                  </td>
                  <td className="py-1 pr-3">{hrs(w.totalHours)}</td>
                </tr>
              ))}
              {report.weeks.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-3 text-center text-gray-500">
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
        relatif au travail de nuit. Chaque heure travaillée est classée sur un seul palier (le plus favorable parmi
        seuil hebdomadaire 40h/46h, nuit 21h-5h, dimanche/férié), à l'image du bulletin de paie.
      </p>
    </div>
  )
}
