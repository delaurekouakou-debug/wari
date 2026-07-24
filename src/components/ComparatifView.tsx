import { useMemo, useState } from 'react'
import { computePay, computePeriodReport, getPayPeriod, shiftPayPeriod } from '../lib/calcEngine'
import { exportComparatifExcel, exportComparatifPdf } from '../lib/exportReport'
import { formatDateKey } from '../lib/dateUtils'
import type { PaidAmounts, PaidByPeriod, PaidLine, Planning, Settings } from '../lib/types'

interface Props {
  planning: Planning
  settings: Settings
  paidByPeriod: PaidByPeriod
  onChange: (paidByPeriod: PaidByPeriod) => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const hrs = (n: number) => `${n.toFixed(2)} h`
const EMPTY_LINE: PaidLine = { heures: 0, taux: 0 }
const EMPTY_PAID: PaidAmounts = { hs115: EMPTY_LINE, hs150: EMPTY_LINE, hs175: EMPTY_LINE, hs200: EMPTY_LINE }

export default function ComparatifView({ planning, settings, paidByPeriod, onChange }: Props) {
  const [period, setPeriod] = useState(() => getPayPeriod(formatDateKey(new Date()), settings.payPeriodStartDay))

  const holidaySet = useMemo(() => new Set(settings.holidays.map((h) => h.date)), [settings.holidays])
  const report = useMemo(() => computePeriodReport(planning, holidaySet, period), [planning, holidaySet, period])

  const pay = computePay(report, settings.tauxHoraire, settings.salaireBase, settings.hsRates)

  const paid = paidByPeriod[period.start] ?? EMPTY_PAID

  function updatePaidLine(key: keyof PaidAmounts, field: keyof PaidLine, value: number) {
    onChange({
      ...paidByPeriod,
      [period.start]: { ...paid, [key]: { ...paid[key], [field]: value } },
    })
  }

  const rows: {
    code: string
    label: string
    paidKey: keyof PaidAmounts
    heuresDue: number
    baseDue: number
    montantDue: number
  }[] = [
    { code: '0820', label: `HS ${settings.hsRates.r115}%`, paidKey: 'hs115', heuresDue: report.hs115Hours, baseDue: pay.hs115Rate, montantDue: pay.hs115Amount },
    { code: '0830', label: `HS ${settings.hsRates.r150}%`, paidKey: 'hs150', heuresDue: report.hs150Hours, baseDue: pay.hs150Rate, montantDue: pay.hs150Amount },
    { code: '0840', label: `HS ${settings.hsRates.r175}%`, paidKey: 'hs175', heuresDue: report.hs175Hours, baseDue: pay.hs175Rate, montantDue: pay.hs175Amount },
    { code: '0850', label: `HS ${settings.hsRates.r200}%`, paidKey: 'hs200', heuresDue: report.hs200Hours, baseDue: pay.hs200Rate, montantDue: pay.hs200Amount },
  ]

  const totalDue = pay.totalSupplements
  const totalPaid = (['hs115', 'hs150', 'hs175', 'hs200'] as const).reduce(
    (sum, key) => sum + paid[key].heures * paid[key].taux,
    0,
  )
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
        Saisis, pour chaque ligne, le nombre d'heures et le taux horaire chargé (base) tels qu'affichés sur ton
        bulletin de paie — le montant payé est calculé automatiquement (heures × base), comme sur le bulletin.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
              <th className="py-2 pr-3" rowSpan={2}>
                Code
              </th>
              <th className="py-2 pr-3" rowSpan={2}>
                Libellé
              </th>
              <th className="py-2 pr-3 text-center border-l border-gray-300 dark:border-gray-700" colSpan={3}>
                Dû (calculé)
              </th>
              <th className="py-2 pr-3 text-center border-l border-gray-300 dark:border-gray-700 no-print" colSpan={3}>
                Payé (bulletin)
              </th>
              <th className="py-2 pr-3 text-center border-l border-gray-300 dark:border-gray-700 hidden print:table-cell" colSpan={3}>
                Payé
              </th>
              <th className="py-2 pr-3 border-l border-gray-300 dark:border-gray-700" rowSpan={2}>
                Écart
              </th>
            </tr>
            <tr className="border-b border-gray-300 dark:border-gray-700 text-left text-xs text-gray-500">
              <th className="py-1 pr-3 border-l border-gray-300 dark:border-gray-700">Heures (N)</th>
              <th className="py-1 pr-3">Base</th>
              <th className="py-1 pr-3">Montant</th>
              <th className="py-1 pr-3 border-l border-gray-300 dark:border-gray-700">Heures (N)</th>
              <th className="py-1 pr-3">Base</th>
              <th className="py-1 pr-3">Montant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const line = paid[row.paidKey]
              const montantPaye = line.heures * line.taux
              const ecart = montantPaye - row.montantDue
              return (
                <tr key={row.code} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 pr-3 text-gray-500">{row.code}</td>
                  <td className="py-1.5 pr-3">{row.label}</td>
                  <td className="py-1.5 pr-3 border-l border-gray-100 dark:border-gray-800">{hrs(row.heuresDue)}</td>
                  <td className="py-1.5 pr-3">{fcfa.format(Math.round(row.baseDue))}</td>
                  <td className="py-1.5 pr-3">{fcfa.format(Math.round(row.montantDue))}</td>
                  <td className="py-1.5 pr-3 border-l border-gray-100 dark:border-gray-800 no-print">
                    <input
                      type="number"
                      min={0}
                      value={line.heures || ''}
                      onChange={(e) => updatePaidLine(row.paidKey, 'heures', Number(e.target.value) || 0)}
                      className="w-20 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 pr-3 no-print">
                    <input
                      type="number"
                      min={0}
                      value={line.taux || ''}
                      onChange={(e) => updatePaidLine(row.paidKey, 'taux', Number(e.target.value) || 0)}
                      className="w-24 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 pr-3 no-print">{fcfa.format(Math.round(montantPaye))}</td>
                  <td className="py-1.5 pr-3 border-l border-gray-100 dark:border-gray-800 hidden print:table-cell">
                    {hrs(line.heures)}
                  </td>
                  <td className="py-1.5 pr-3 hidden print:table-cell">{fcfa.format(Math.round(line.taux))}</td>
                  <td className="py-1.5 pr-3 hidden print:table-cell">{fcfa.format(Math.round(montantPaye))}</td>
                  <td
                    className={`py-1.5 pr-3 border-l border-gray-100 dark:border-gray-800 font-medium ${ecart < 0 ? 'text-red-600' : ecart > 0 ? 'text-emerald-600' : ''}`}
                  >
                    {fcfa.format(Math.round(ecart))}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400 dark:border-gray-600 font-semibold">
              <td className="py-2 pr-3" colSpan={2}>
                Total
              </td>
              <td className="py-2 pr-3 border-l border-gray-300 dark:border-gray-700" colSpan={2}></td>
              <td className="py-2 pr-3">{fcfa.format(Math.round(totalDue))}</td>
              <td className="py-2 pr-3 border-l border-gray-300 dark:border-gray-700" colSpan={2}></td>
              <td className="py-2 pr-3">{fcfa.format(Math.round(totalPaid))}</td>
              <td
                className={`py-2 pr-3 border-l border-gray-300 dark:border-gray-700 ${totalEcart < 0 ? 'text-red-600' : totalEcart > 0 ? 'text-emerald-600' : ''}`}
              >
                {fcfa.format(Math.round(totalEcart))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {totalEcart < 0 && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          Il te manquerait {fcfa.format(Math.round(-totalEcart))} FCFA sur cette période par rapport au calcul dû.
        </p>
      )}
      {totalEcart > 0 && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-md px-3 py-2">
          Tu as reçu {fcfa.format(Math.round(totalEcart))} FCFA de plus que le calcul dû sur cette période.
        </p>
      )}

      <p className="text-xs text-gray-500">
        Montants en FCFA. Le "Dû" est calculé à partir du taux horaire de base et des majorations réglés dans
        Paramètres. Les valeurs "Payé" sont saisies manuellement depuis ton bulletin et sauvegardées par période.
      </p>
    </div>
  )
}
