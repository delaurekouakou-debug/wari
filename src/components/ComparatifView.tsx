import { useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { computeDayDetails, computePay, computePeriodReport, motifForDay, type PayPeriod } from '../lib/calcEngine'
import { exportComparatifExcel, exportComparatifPdf } from '../lib/exportReport'
import { parseDateKey } from '../lib/dateUtils'
import type { PaidAmounts, PaidByPeriod, PaidLine, Planning, Settings } from '../lib/types'

interface Props {
  planning: Planning
  settings: Settings
  paidByPeriod: PaidByPeriod
  onChange: (paidByPeriod: PaidByPeriod) => void
  period: PayPeriod
  onShiftPeriod: (delta: number) => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const fcfa2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const hrs = (n: number) => `${n.toFixed(2)} h`
const EMPTY_LINE: PaidLine = { heures: 0, taux: 0 }
const EMPTY_PAID: PaidAmounts = {
  hs115: EMPTY_LINE,
  hs150: EMPTY_LINE,
  hs175: EMPTY_LINE,
  hs200: EMPTY_LINE,
  panier: EMPTY_LINE,
}

export default function ComparatifView({ planning, settings, paidByPeriod, onChange, period, onShiftPeriod }: Props) {
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
    qtyDue: number
    unit: string
    baseDue: number
    montantDue: number
  }[] = [
    { code: '0820', label: `HS ${settings.hsRates.r115}%`, paidKey: 'hs115', qtyDue: report.hs115Hours, unit: 'h', baseDue: pay.hs115Rate, montantDue: pay.hs115Amount },
    { code: '0830', label: `HS ${settings.hsRates.r150}%`, paidKey: 'hs150', qtyDue: report.hs150Hours, unit: 'h', baseDue: pay.hs150Rate, montantDue: pay.hs150Amount },
    { code: '0840', label: `HS ${settings.hsRates.r175}%`, paidKey: 'hs175', qtyDue: report.hs175Hours, unit: 'h', baseDue: pay.hs175Rate, montantDue: pay.hs175Amount },
    { code: '0850', label: `HS ${settings.hsRates.r200}%`, paidKey: 'hs200', qtyDue: report.hs200Hours, unit: 'h', baseDue: pay.hs200Rate, montantDue: pay.hs200Amount },
    { code: '1170', label: 'PRIME DE PANIER', paidKey: 'panier', qtyDue: report.panierCount, unit: 'vac.', baseDue: settings.panierBase, montantDue: pay.panierAmount },
  ]

  const totalDue = pay.totalSupplements
  const totalPaid = (['hs115', 'hs150', 'hs175', 'hs200', 'panier'] as const).reduce(
    (sum, key) => sum + paid[key].heures * paid[key].taux,
    0,
  )
  const totalEcart = totalPaid - totalDue

  const dayDetails = useMemo(() => {
    const all = computeDayDetails(planning, holidaySet, overtime.mode, overtime.cycleDays, overtime.cycleAnchor, overtime.normalWeeklyHours)
    return all.filter((d) => d.date >= period.start && d.date <= period.end)
  }, [planning, holidaySet, period, overtime])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onShiftPeriod(-1)}
          >
            ←
          </button>
          <h2 className="text-lg font-semibold">{report.period.label}</h2>
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onShiftPeriod(1)}
          >
            →
          </button>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => exportComparatifPdf(report, pay, paid, settings, dayDetails)}
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
        Saisis, pour chaque ligne, la quantité (heures ou vacations) et le taux/base tels qu'affichés sur ton
        bulletin de paie — le montant payé est calculé automatiquement (quantité × base), comme sur le bulletin.
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
              <th className="py-1 pr-3 border-l border-gray-300 dark:border-gray-700">N</th>
              <th className="py-1 pr-3">Base</th>
              <th className="py-1 pr-3">Montant</th>
              <th className="py-1 pr-3 border-l border-gray-300 dark:border-gray-700">N</th>
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
                  <td className="py-1.5 pr-3 border-l border-gray-100 dark:border-gray-800">
                    {row.unit === 'h' ? hrs(row.qtyDue) : `${row.qtyDue} ${row.unit}`}
                  </td>
                  <td className="py-1.5 pr-3">{fcfa2.format(row.baseDue)}</td>
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
                      step="0.01"
                      value={line.taux || ''}
                      onChange={(e) => updatePaidLine(row.paidKey, 'taux', Number(e.target.value) || 0)}
                      className="w-24 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 pr-3 no-print">{fcfa.format(Math.round(montantPaye))}</td>
                  <td className="py-1.5 pr-3 border-l border-gray-100 dark:border-gray-800 hidden print:table-cell">
                    {row.unit === 'h' ? hrs(line.heures) : `${line.heures} ${row.unit}`}
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

      <section className="space-y-3 no-print">
        <h3 className="font-semibold">Base légale et justification — pour discussion avec les RH</h3>
        <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950 p-3 text-sm space-y-1">
          <p className="font-medium">
            Mode de calcul actif : {settings.overtimeMode === 'cycle' ? `Cycle de travail (${settings.cycleDays} jours)` : 'Semaine civile (lundi-dimanche)'}
          </p>
          {settings.overtimeMode === 'cycle' ? (
            <p className="text-gray-600 dark:text-gray-400">
              Travail en équipes successives organisé en cycle de rotation dépassant la semaine : les seuils de
              majoration ({settings.normalWeeklyHours}h puis +6h) sont calculés sur la durée moyenne du cycle complet
              de {settings.cycleDays} jours, et non semaine civile par semaine civile.{' '}
              <span className="text-gray-500">
                Décret n°96-203 du 7 mars 1996 relatif à la durée du travail : pour le travail organisé en cycle de
                rotation dépassant la semaine, seules les heures dépassant la durée moyenne de travail calculée sur
                le cycle complet — plafonnée à 42h/semaine en moyenne — sont des heures supplémentaires.
              </span>
            </p>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              Seuils calculés semaine civile par semaine civile (lundi 00h00 à dimanche 24h00).{' '}
              <span className="text-gray-500">
                Si ton planning suit un cycle de rotation fixe (ex: 2 jours-2 nuits-2 repos), le Décret n°96-203
                prévoit que le calcul se fasse sur la durée moyenne du cycle complet plutôt que semaine par semaine —
                active le mode "Cycle de travail" dans Paramètres si c'est ton cas.
              </span>
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1">
            <p className="font-medium">HS {settings.hsRates.r115}%</p>
            <p className="text-gray-600 dark:text-gray-400">
              Heures effectuées entre la {settings.normalWeeklyHours + 1}e et la {settings.normalWeeklyHours + 6}e
              heure de la {settings.overtimeMode === 'cycle' ? `période de ${settings.cycleDays} jours` : 'semaine civile (lundi-dimanche)'},
              au-delà du seuil normal de {settings.normalWeeklyHours}h.{' '}
              <span className="text-gray-500">Code du travail ivoirien (loi n°2015-532) et Décret n°96-203 du 7 mars
              1996 ; majoration de 15% pour les 6 premières heures supplémentaires.</span>
            </p>
          </div>
          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1">
            <p className="font-medium">HS {settings.hsRates.r150}%</p>
            <p className="text-gray-600 dark:text-gray-400">
              Heures effectuées au-delà de la {settings.normalWeeklyHours + 6}e heure de la même période.{' '}
              <span className="text-gray-500">Même base légale ; majoration de 50% au-delà de la 6e heure
              supplémentaire.</span>
            </p>
          </div>
          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1">
            <p className="font-medium">HS {settings.hsRates.r175}%</p>
            <p className="text-gray-600 dark:text-gray-400">
              Heures effectuées de nuit (21h-5h), quel que soit le nombre d'heures déjà travaillées dans la semaine,
              ou heures de jour effectuées un dimanche ou un jour férié.{' '}
              <span className="text-gray-500">Décret n°96-204 du 7 mars 1996 relatif au travail de nuit (+75%) ;
              majoration dimanche/férié fixée à +75% pour les heures de jour (Décret n°96-203).</span>
            </p>
          </div>
          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1">
            <p className="font-medium">HS {settings.hsRates.r200}%</p>
            <p className="text-gray-600 dark:text-gray-400">
              Heures effectuées de nuit (21h-5h) un dimanche ou un jour férié.{' '}
              <span className="text-gray-500">Cumul des deux motifs (nuit + dimanche/férié), retenu au taux de
              +100%.</span>
            </p>
          </div>
          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1 sm:col-span-2">
            <p className="font-medium">Prime de panier</p>
            <p className="text-gray-600 dark:text-gray-400">
              Indemnité versée pour chaque vacation de nuit travaillée (18h-6h30 ou 22h-6h30), en compensation de
              l'impossibilité de prendre un repas dans des conditions normales pendant les heures de nuit.
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Règle de calcul retenue : quand une heure remplit plusieurs conditions à la fois (ex: heure supp
          hebdomadaire ET heure de nuit), seul le taux le plus favorable est retenu — pas de cumul des majorations.
          C'est une hypothèse de calcul à vérifier avec les RH : une lecture cumulative stricte du Code du travail
          pourrait justifier l'addition des majorations sur ces heures-là.
        </p>
      </section>

      {dayDetails.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold">Détail journalier — preuves par date</h3>
          <p className="text-xs text-gray-500">
            Uniquement les jours générant des heures majorées ou une prime de panier sur la période.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5 pr-3">Jour</th>
                  <th className="py-1.5 pr-3">Vacation</th>
                  <th className="py-1.5 pr-3">115%</th>
                  <th className="py-1.5 pr-3">150%</th>
                  <th className="py-1.5 pr-3">175%</th>
                  <th className="py-1.5 pr-3">200%</th>
                  <th className="py-1.5 pr-3">Panier</th>
                  <th className="py-1.5 pr-3">Motif</th>
                </tr>
              </thead>
              <tbody>
                {dayDetails.map((d) => (
                  <tr key={d.date} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-1 pr-3 whitespace-nowrap">{d.date}</td>
                    <td className="py-1 pr-3 capitalize">{format(parseDateKey(d.date), 'EEEE', { locale: fr })}</td>
                    <td className="py-1 pr-3">{d.shiftLabel}</td>
                    <td className="py-1 pr-3">{d.hs115 > 0 ? hrs(d.hs115) : '—'}</td>
                    <td className="py-1 pr-3">{d.hs150 > 0 ? hrs(d.hs150) : '—'}</td>
                    <td className="py-1 pr-3">{d.hs175 > 0 ? hrs(d.hs175) : '—'}</td>
                    <td className="py-1 pr-3">{d.hs200 > 0 ? hrs(d.hs200) : '—'}</td>
                    <td className="py-1 pr-3">{d.isPanier ? '1 vac.' : '—'}</td>
                    <td className="py-1 pr-3 text-gray-600 dark:text-gray-400">{motifForDay(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-gray-500">
        Montants en FCFA. Le "Dû" est calculé à partir des bases et majorations réglées dans Paramètres. Les valeurs
        "Payé" sont saisies manuellement depuis ton bulletin et sauvegardées par période.
      </p>
    </div>
  )
}
