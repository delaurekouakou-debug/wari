import { useMemo, useState } from 'react'
import { computePay, computePeriodReport, getPayPeriod, LEGAL_MONTHLY_HOURS, shiftPayPeriod } from '../lib/calcEngine'
import { exportComparatifExcel, exportComparatifPdf } from '../lib/exportReport'
import { formatDateKey } from '../lib/dateUtils'
import type { PaidAmounts, PaidByPeriod, Planning, Settings } from '../lib/types'

interface Props {
  planning: Planning
  settings: Settings
  paidByPeriod: PaidByPeriod
  onChange: (paidByPeriod: PaidByPeriod) => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const hrs = (n: number) => `${n.toFixed(2)} h`
const EMPTY_PAID: PaidAmounts = { hs115: 0, hs150: 0, hs175: 0, hs200: 0 }

export default function ComparatifView({ planning, settings, paidByPeriod, onChange }: Props) {
  const [period, setPeriod] = useState(() => getPayPeriod(formatDateKey(new Date()), settings.payPeriodStartDay))

  const holidaySet = useMemo(() => new Set(settings.holidays.map((h) => h.date)), [settings.holidays])
  const report = useMemo(() => computePeriodReport(planning, holidaySet, period), [planning, holidaySet, period])

  const tauxHoraire = settings.salaireBase > 0 ? settings.salaireBase / LEGAL_MONTHLY_HOURS : 0
  const pay = computePay(report, tauxHoraire, settings.salaireBase)

  const paid = paidByPeriod[period.start] ?? EMPTY_PAID

  function updatePaid(key: keyof PaidAmounts, value: number) {
    onChange({ ...paidByPeriod, [period.start]: { ...paid, [key]: value } })
  }

  const rows: { code: string; label: string; hoursDue: number; due: number; paidKey: keyof PaidAmounts }[] = [
    { code: '0820', label: 'MONTANT DES HS 115%', hoursDue: report.hs115Hours, due: pay.hs115Amount, paidKey: 'hs115' },
    { code: '0830', label: 'MONTANT DES HS 150%', hoursDue: report.hs150Hours, due: pay.hs150Amount, paidKey: 'hs150' },
    { code: '0840', label: 'MONTANT DES HS 175%', hoursDue: report.hs175Hours, due: pay.hs175Amount, paidKey: 'hs175' },
    { code: '0850', label: 'MONTANT DES HS 200%', hoursDue: report.hs200Hours, due: pay.hs200Amount, paidKey: 'hs200' },
  ]

  const totalDue = pay.totalSupplements
  const totalPaid = paid.hs115 + paid.hs150 + paid.hs175 + paid.hs200
  const totalEcart = totalPaid - totalDue

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
            onClick={() => exportComparatifPdf(report, pay, paid)}
            className="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-900 text-sm"
          >
            Export PDF
          </button>
          <button
            onClick={() => exportComparatifExcel(report, pay, paid)}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
          >
            Export Excel
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Saisis les montants indiqués sur ton bulletin de paie pour cette période (lignes "MONTANT DES HS..."). Le
        montant dû est calculé automatiquement selon le Code du travail ivoirien.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Libellé</th>
              <th className="py-2 pr-3">Heures dues</th>
              <th className="py-2 pr-3">Montant dû</th>
              <th className="py-2 pr-3 no-print">Montant payé (bulletin)</th>
              <th className="py-2 pr-3 hidden print:table-cell">Montant payé</th>
              <th className="py-2 pr-3">Écart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const paidValue = paid[row.paidKey]
              const ecart = paidValue - row.due
              return (
                <tr key={row.code} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 pr-3 text-gray-500">{row.code}</td>
                  <td className="py-1.5 pr-3">{row.label}</td>
                  <td className="py-1.5 pr-3">{hrs(row.hoursDue)}</td>
                  <td className="py-1.5 pr-3">{fcfa.format(Math.round(row.due))} FCFA</td>
                  <td className="py-1.5 pr-3 no-print">
                    <input
                      type="number"
                      min={0}
                      value={paidValue || ''}
                      onChange={(e) => updatePaid(row.paidKey, Number(e.target.value) || 0)}
                      className="w-32 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 pr-3 hidden print:table-cell">{fcfa.format(Math.round(paidValue))} FCFA</td>
                  <td className={`py-1.5 pr-3 font-medium ${ecart < 0 ? 'text-red-600' : ecart > 0 ? 'text-emerald-600' : ''}`}>
                    {fcfa.format(Math.round(ecart))} FCFA
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400 dark:border-gray-600 font-semibold">
              <td className="py-2 pr-3" colSpan={3}>
                Total
              </td>
              <td className="py-2 pr-3">{fcfa.format(Math.round(totalDue))} FCFA</td>
              <td className="py-2 pr-3">{fcfa.format(Math.round(totalPaid))} FCFA</td>
              <td className={`py-2 pr-3 ${totalEcart < 0 ? 'text-red-600' : totalEcart > 0 ? 'text-emerald-600' : ''}`}>
                {fcfa.format(Math.round(totalEcart))} FCFA
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {totalEcart < 0 && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          Il te manquerait {fcfa.format(Math.round(-totalEcart))} FCFA sur cette période par rapport au calcul légal.
        </p>
      )}
      {totalEcart > 0 && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-md px-3 py-2">
          Tu as reçu {fcfa.format(Math.round(totalEcart))} FCFA de plus que le calcul légal sur cette période.
        </p>
      )}

      <p className="text-xs text-gray-500">
        Le montant dû est calculé avec le taux horaire légal ({fcfa.format(Math.round(tauxHoraire))} FCFA/h, dérivé
        du salaire de base réglé dans Paramètres). Les montants payés sont saisis manuellement et sauvegardés par
        période.
      </p>
    </div>
  )
}
