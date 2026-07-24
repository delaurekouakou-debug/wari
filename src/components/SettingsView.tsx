import { useState } from 'react'
import type { Holiday, HsBases, HsRates, Settings } from '../lib/types'
import { LEGAL_MONTHLY_HOURS } from '../lib/calcEngine'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const fcfa0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

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

  function updateBase<K extends keyof HsBases>(key: K, value: number) {
    onChange({ ...settings, hsBases: { ...settings.hsBases, [key]: value } })
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
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Majorations heures supplémentaires</h2>
        <p className="text-xs text-gray-500">
          Pour chaque palier : le pourcentage (référence légale, éditable) et la <strong>base</strong> — le taux
          horaire chargé en FCFA/h réellement utilisé pour calculer les montants dus, à recopier depuis ton bulletin
          de paie (colonne "Base" en face de chaque ligne "MONTANT DES HS...").
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              ['r115', "41e-46e h/semaine"],
              ['r150', 'au-delà de la 46e h/semaine'],
              ['r175', 'nuit ou dimanche/férié jour'],
              ['r200', 'dimanche/férié nuit'],
            ] as [keyof HsRates & keyof HsBases, string][]
          ).map(([key, description]) => {
            const suggestedBase = tauxHoraireSuggere > 0 ? (tauxHoraireSuggere * settings.hsRates[key]) / 100 : 0
            return (
              <div key={key} className="rounded-md border border-gray-200 dark:border-gray-800 p-3 space-y-2">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <input
                    type="number"
                    min={0}
                    value={settings.hsRates[key]}
                    onChange={(e) => updateRate(key, Number(e.target.value) || 0)}
                    className="w-16 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1"
                  />
                  <span>% — {description}</span>
                </div>
                <label className="block text-xs text-gray-500">
                  Base (FCFA/h)
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={settings.hsBases[key] || ''}
                      onChange={(e) => updateBase(key, Number(e.target.value) || 0)}
                      className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
                      placeholder="ex: 2838.46"
                    />
                    {suggestedBase > 0 && (
                      <button
                        type="button"
                        onClick={() => updateBase(key, Math.round(suggestedBase * 100) / 100)}
                        className="shrink-0 px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs"
                        title={`Suggestion depuis le salaire de base : ${fcfa.format(suggestedBase)} FCFA/h`}
                      >
                        Suggéré: {fcfa0.format(suggestedBase)}
                      </button>
                    )}
                  </div>
                </label>
              </div>
            )
          })}
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
