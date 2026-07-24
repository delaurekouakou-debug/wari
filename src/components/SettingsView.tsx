import { useState } from 'react'
import type { Holiday, Settings } from '../lib/types'
import { LEGAL_MONTHLY_HOURS } from '../lib/calcEngine'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export default function SettingsView({ settings, onChange }: Props) {
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayLabel, setNewHolidayLabel] = useState('')

  const tauxHoraireLegal = settings.salaireBase > 0 ? settings.salaireBase / LEGAL_MONTHLY_HOURS : 0

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    onChange({ ...settings, [key]: value })
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
        <div className="text-sm rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2">
          Taux horaire légal calculé : <strong>{fcfa.format(Math.round(tauxHoraireLegal))} FCFA/h</strong>
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
