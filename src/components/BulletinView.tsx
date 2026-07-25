import { useMemo } from 'react'
import { computePay, computePeriodReport, type PayPeriod } from '../lib/calcEngine'
import { createDefaultBulletin } from '../lib/storage'
import { exportBulletinExcel, exportBulletinPdf } from '../lib/exportReport'
import type { BulletinByPeriod, BulletinData, BulletinLine, Planning, Settings } from '../lib/types'

interface Props {
  planning: Planning
  settings: Settings
  bulletinByPeriod: BulletinByPeriod
  onChange: (bulletinByPeriod: BulletinByPeriod) => void
  period: PayPeriod
  onShiftPeriod: (delta: number) => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

function lineSum(lines: BulletinLine[]): number {
  return lines.reduce((sum, l) => sum + l.montant, 0)
}

export default function BulletinView({ planning, settings, bulletinByPeriod, onChange, period, onShiftPeriod }: Props) {
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

  const bulletin = useMemo<BulletinData>(
    () => bulletinByPeriod[period.start] ?? createDefaultBulletin(),
    [bulletinByPeriod, period.start],
  )

  function update(section: keyof BulletinData, lines: BulletinLine[]) {
    onChange({ ...bulletinByPeriod, [period.start]: { ...bulletin, [section]: lines } })
  }

  function updateLine(section: keyof BulletinData, id: string, field: 'label' | 'montant', value: string | number) {
    update(
      section,
      bulletin[section].map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    )
  }

  function addLine(section: keyof BulletinData) {
    update(section, [...bulletin[section], { id: crypto.randomUUID(), code: '', label: 'Nouvelle ligne', montant: 0 }])
  }

  function removeLine(section: keyof BulletinData, id: string) {
    update(
      section,
      bulletin[section].filter((l) => l.id !== id),
    )
  }

  const hsRows = [
    { code: '0820', label: `MONTANT DES HS ${settings.hsRates.r115}%`, montant: pay.hs115Amount },
    { code: '0830', label: `MONTANT DES HS ${settings.hsRates.r150}%`, montant: pay.hs150Amount },
    { code: '0840', label: `MONTANT DES HS ${settings.hsRates.r175}%`, montant: pay.hs175Amount },
    { code: '0850', label: `MONTANT DES HS ${settings.hsRates.r200}%`, montant: pay.hs200Amount },
    { code: '1170', label: 'PRIME DE PANIER', montant: pay.panierAmount },
  ]
  const hsTotal = pay.totalSupplements

  const gainsFixesTotal = lineSum(bulletin.gainsFixes)
  const salaireBrut = gainsFixesTotal + hsTotal
  const retenuesStatutairesTotal = lineSum(bulletin.retenuesStatutaires)
  const salaireAvantRetenues = salaireBrut - retenuesStatutairesTotal
  const retenuesDiversesTotal = lineSum(bulletin.retenuesDiverses)
  const netAPayer = salaireAvantRetenues - retenuesDiversesTotal

  function EditableSection({
    title,
    section,
    lines,
  }: {
    title: string
    section: keyof BulletinData
    lines: BulletinLine[]
  }) {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300 dark:border-gray-700 text-left text-xs text-gray-500">
                <th className="py-1 pr-3 w-20">Code</th>
                <th className="py-1 pr-3">Libellé</th>
                <th className="py-1 pr-3 w-40">Montant</th>
                <th className="py-1 pr-3 w-10 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1 pr-3 text-gray-500">{l.code}</td>
                  <td className="py-1 pr-3">
                    <input
                      type="text"
                      value={l.label}
                      onChange={(e) => updateLine(section, l.id, 'label', e.target.value)}
                      className="w-full rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-gray-300 dark:focus:border-gray-700 bg-transparent px-1.5 py-0.5"
                    />
                  </td>
                  <td className="py-1 pr-3">
                    <input
                      type="number"
                      value={l.montant || ''}
                      onChange={(e) => updateLine(section, l.id, 'montant', Number(e.target.value) || 0)}
                      className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1 pr-3 no-print">
                    <button onClick={() => removeLine(section, l.id)} className="text-red-600 hover:underline text-xs">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => addLine(section)}
          className="no-print text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          + Ajouter une ligne
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onShiftPeriod(-1)}
          >
            ←
          </button>
          <h2 className="text-lg font-semibold">{period.label}</h2>
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onShiftPeriod(1)}
          >
            →
          </button>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => exportBulletinPdf(period, settings.categorieProfessionnelle, bulletin, hsRows, {
              gainsFixesTotal,
              hsTotal,
              salaireBrut,
              retenuesStatutairesTotal,
              salaireAvantRetenues,
              retenuesDiversesTotal,
              netAPayer,
            })}
            className="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-900 text-sm"
          >
            Export PDF
          </button>
          <button
            onClick={() => exportBulletinExcel(period, settings.categorieProfessionnelle, bulletin, hsRows, {
              gainsFixesTotal,
              hsTotal,
              salaireBrut,
              retenuesStatutairesTotal,
              salaireAvantRetenues,
              retenuesDiversesTotal,
              netAPayer,
            })}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
          >
            Export Excel
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Catégorie professionnelle : <strong className="text-gray-900 dark:text-gray-100">{settings.categorieProfessionnelle || '—'}</strong>{' '}
        <span className="text-xs">(modifiable dans Paramètres)</span>. Reconstitue ton bulletin de salaire pour
        estimer ce que tu dois recevoir : les gains fixes et retenues sont à saisir/ajuster, les heures supp et la
        prime de panier sont calculées automatiquement pour cette période.
      </p>

      <EditableSection title="Gains fixes" section="gainsFixes" lines={bulletin.gainsFixes} />

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Heures supplémentaires et prime de panier (calculé automatiquement)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300 dark:border-gray-700 text-left text-xs text-gray-500">
                <th className="py-1 pr-3 w-20">Code</th>
                <th className="py-1 pr-3">Libellé</th>
                <th className="py-1 pr-3 w-40">Montant</th>
              </tr>
            </thead>
            <tbody>
              {hsRows.map((r) => (
                <tr key={r.code} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1 pr-3 text-gray-500">{r.code}</td>
                  <td className="py-1 pr-3">{r.label}</td>
                  <td className="py-1 pr-3">{fcfa.format(Math.round(r.montant))} FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 flex justify-between font-semibold text-sm">
        <span>=== SALAIRE BRUT</span>
        <span>{fcfa.format(Math.round(salaireBrut))} FCFA</span>
      </div>

      <EditableSection title="Retenues statutaires (CNPS, assurance maladie, CMU, ITS...)" section="retenuesStatutaires" lines={bulletin.retenuesStatutaires} />

      <div className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 flex justify-between font-semibold text-sm">
        <span>=== SALAIRE AVANT RETENUES</span>
        <span>{fcfa.format(Math.round(salaireAvantRetenues))} FCFA</span>
      </div>

      <EditableSection title="Retenues diverses (cantine, mutuelle, prêts...)" section="retenuesDiverses" lines={bulletin.retenuesDiverses} />

      <div className="rounded-lg border-2 border-emerald-600 dark:border-emerald-500 px-4 py-3 flex justify-between items-center">
        <span className="font-semibold">Net à payer (Appoint)</span>
        <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{fcfa.format(Math.round(netAPayer))} FCFA</span>
      </div>

      <p className="text-xs text-gray-500">
        Estimation basée sur les montants saisis. Les retenues statutaires (CNPS, ITS...) varient selon le salaire
        brut réel : vérifie-les chaque mois sur ton bulletin officiel plutôt que de les considérer figées.
      </p>
    </div>
  )
}
