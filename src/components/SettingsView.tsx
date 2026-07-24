import { useState } from 'react'
import type { Holiday, HsRates, Settings } from '../lib/types'
import { LEGAL_MONTHLY_HOURS } from '../lib/calcEngine'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export default function SettingsView({ settings, onChange }: Props) {
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayLabel, setNewHolidayLabel] = useState('')

  const tauxHoraireSuggere = settings.salaireBase > 0 ? settings.salaireBase / LEGAL_MONTHLY_HOURS : 0

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    onChange({ ...settings, [key]: value })
  }

  function updateRate<K extends keyof HsRates>(key: K, value: number) {
    onChange({ ...settings, hsRates: { ...settings.hsRates, [key]: value } })
  }

  function addHoliday() {
    if (!newHolidayDate) return
    const holiday: Holiday = { date: newHolidayDate, label: newHolidayLabel || 'Férié' }
    const holidays = [...settings.holidays, holiday].sort((a, b) => a.date.localeCompare(b.date))
    update('holidays', holidays)
    setNewHolidayDate('')
    setNewHolidayLabel('')
  }

  function removeHoliday(date: string) {
    update(
      'holidays',
      settings.holidays.filter((h) => h.date !== date),
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rémunération</h2>
        <label className="block text-sm">
          Salaire de base mensuel (FCFA)
          <input
            type="number"
            min={0}
            value={settings.salaireBase || ''}
            onChange={(e) => update('salaireBase', Number(e.target.value) || 0)}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
            placeholder="ex: 150000"
          />
          <span className="text-xs text-gray-500">
            Sert à calculer le taux horaire légal ({LEGAL_MONTHLY_HOURS.toFixed(2)}h/mois, équivalent 40h/semaine).
          </span>
        </label>
        <label className="block text-sm">
          Taux horaire de base (FCFA/h) — utilisé pour tous les calculs de montants dus
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={0}
              value={settings.tauxHoraire || ''}
              onChange={(e) => update('tauxHoraire', Number(e.target.value) || 0)}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
              placeholder="ex: 865"
            />
            <button
              type="button"
              onClick={() => update('tauxHoraire', Math.round(tauxHoraireSuggere))}
              disabled={tauxHoraireSuggere === 0}
              className="shrink-0 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm disabled:opacity-40"
            >
              Utiliser {tauxHoraireSuggere > 0 ? `${fcfa.format(Math.round(tauxHoraireSuggere))} FCFA/h` : 'le calcul'}
            </button>
          </div>
          <span className="text-xs text-gray-500">
            Valeur suggérée = salaire de base ÷ {LEGAL_MONTHLY_HOURS.toFixed(2)}h/mois (équivalent 40h/semaine). Modifie
            librement si ton entreprise applique un autre taux.
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Majorations heures supplémentaires</h2>
        <p className="text-xs text-gray-500">
          Multiplicateurs appliqués au taux horaire de base pour chaque palier (100 = taux plein sans majoration).
          Valeurs légales par défaut : 115% (41e-46e h/semaine), 150% (au-delà 46e h), 175% (nuit ou dimanche/férié
          jour), 200% (dimanche/férié nuit).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              ['r115', 'HS 115%'],
              ['r150', 'HS 150%'],
              ['r175', 'HS 175%'],
              ['r200', 'HS 200%'],
            ] as [keyof HsRates, string][]
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={settings.hsRates[key]}
                  onChange={(e) => updateRate(key, Number(e.target.value) || 0)}
                  className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
                />
                <span className="text-gray-500">%</span>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Pour comparer avec les montants réellement payés sur ton bulletin, utilise l'onglet Comparatif.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Période de paie</h2>
        <label className="block text-sm">
          Jour de début de la période de paie
          <input
            type="number"
            min={1}
            max={28}
            value={settings.payPeriodStartDay}
            onChange={(e) => update('payPeriodStartDay', Number(e.target.value) || 1)}
            className="mt-1 w-32 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
          />
          <span className="block text-xs text-gray-500 mt-1">
            Ex: 16 → la période va du 16 du mois au 15 du mois suivant. Ajuste si ton entreprise utilise une autre
            date.
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Jours fériés</h2>
        <p className="text-xs text-gray-500">
          Les fériés à date fixe sont préremplis. Les fêtes mobiles (Pâques, Ascension, Pentecôte, Aïd el-Fitr,
          Tabaski, Maouloud...) changent chaque année : ajoute-les manuellement ci-dessous.
        </p>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-md">
          {settings.holidays.map((h) => (
            <li key={h.date} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span>
                {h.date} — {h.label}
              </span>
              <button onClick={() => removeHoliday(h.date)} className="text-red-600 hover:underline text-xs">
                Retirer
              </button>
            </li>
          ))}
          {settings.holidays.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Aucun férié</li>}
        </ul>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            Date
            <input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Libellé
            <input
              type="text"
              value={newHolidayLabel}
              onChange={(e) => setNewHolidayLabel(e.target.value)}
              placeholder="ex: Aïd el-Fitr"
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            />
          </label>
          <button
            onClick={addHoliday}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
          >
            Ajouter
          </button>
        </div>
      </section>
    </div>
  )
}
