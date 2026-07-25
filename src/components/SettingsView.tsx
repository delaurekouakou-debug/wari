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
        <label className="block text-sm max-w-xs">
          Catégorie professionnelle
          <input
            type="text"
            value={settings.categorieProfessionnelle}
            onChange={(e) => update('categorieProfessionnelle', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
            placeholder="ex: M4"
          />
          <span className="text-xs text-gray-500">Informatif, affiché sur l'onglet Bulletin.</span>
        </label>
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
        <h2 className="text-lg font-semibold">Méthode de calcul des heures supplémentaires</h2>
        <p className="text-xs text-gray-500">
          Décret n°96-203 du 7 mars 1996 : le travail en équipes successives organisé en cycle de rotation dépassant
          la semaine (ex: 2 jours-2 nuits-2 repos) peut être calculé sur la durée moyenne du cycle complet — plutôt
          que semaine civile par semaine civile, ce qui évite des résultats erratiques selon l'alignement arbitraire
          du cycle avec le calendrier.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="overtimeMode"
              checked={settings.overtimeMode === 'semaine'}
              onChange={() => update('overtimeMode', 'semaine')}
            />
            Semaine civile (lundi-dimanche)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="overtimeMode"
              checked={settings.overtimeMode === 'cycle'}
              onChange={() => update('overtimeMode', 'cycle')}
            />
            Cycle de travail
          </label>
        </div>
        {settings.overtimeMode === 'cycle' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
            <label className="text-sm">
              Longueur du cycle (jours)
              <input
                type="number"
                min={1}
                value={settings.cycleDays}
                onChange={(e) => update('cycleDays', Number(e.target.value) || 1)}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
              />
              <span className="block text-xs text-gray-500 mt-1">6 pour le programme 12h, 8 pour le programme 8h.</span>
            </label>
            <label className="text-sm">
              Date de référence (début d'un cycle)
              <input
                type="date"
                value={settings.cycleAnchor}
                onChange={(e) => update('cycleAnchor', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
              />
            </label>
            <label className="text-sm">
              Seuil normal (h/semaine équivalent)
              <input
                type="number"
                min={1}
                value={settings.normalWeeklyHours}
                onChange={(e) => update('normalWeeklyHours', Number(e.target.value) || 1)}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
              />
              <span className="block text-xs text-gray-500 mt-1">40 en général, jusqu'à 42 pour le cycle continu (Décret n°96-203).</span>
            </label>
          </div>
        )}
        {settings.overtimeMode === 'semaine' && (
          <label className="block text-sm max-w-xs">
            Seuil normal (h/semaine)
            <input
              type="number"
              min={1}
              value={settings.normalWeeklyHours}
              onChange={(e) => update('normalWeeklyHours', Number(e.target.value) || 1)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
            />
          </label>
        )}
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
              ['r115', `${settings.normalWeeklyHours + 1}e-${settings.normalWeeklyHours + 6}e h`],
              ['r150', `au-delà de la ${settings.normalWeeklyHours + 6}e h`],
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
        <h2 className="text-lg font-semibold">Prime de panier</h2>
        <p className="text-xs text-gray-500">
          Indemnité versée pour chaque vacation de nuit travaillée (18h-6h30 ou 22h-6h30), compensant
          l'impossibilité de prendre un repas dans des conditions normales.
        </p>
        <label className="block text-sm max-w-xs">
          Base (FCFA par vacation de nuit)
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.panierBase || ''}
            onChange={(e) => update('panierBase', Number(e.target.value) || 0)}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
            placeholder="ex: 1298"
          />
        </label>
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
