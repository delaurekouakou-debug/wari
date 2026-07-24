import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { PROGRAMS, SHIFTS, SHIFT_ORDER } from '../lib/shiftDefs'
import { generatePlanning } from '../lib/planning'
import { formatDateKey } from '../lib/dateUtils'
import type { Planning, ProgramKey, ShiftKey } from '../lib/types'

interface Props {
  planning: Planning
  onChange: (planning: Planning) => void
}

export default function PlanningView({ planning, onChange }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)

  const [genStart, setGenStart] = useState(formatDateKey(new Date()))
  const [genEnd, setGenEnd] = useState(formatDateKey(addMonths(new Date(), 2)))
  const [genProgram, setGenProgram] = useState<ProgramKey>('P12')

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  function setDay(dateKey: string, shift: ShiftKey) {
    onChange({ ...planning, [dateKey]: shift })
    setEditingDate(null)
  }

  function runGenerator() {
    onChange(generatePlanning(planning, genProgram, genStart, genEnd))
    setShowGenerator(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            ←
          </button>
          <h2 className="text-lg font-semibold capitalize w-48 text-center">
            {format(month, 'MMMM yyyy', { locale: fr })}
          </h2>
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            →
          </button>
        </div>
        <button
          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => setShowGenerator((s) => !s)}
        >
          Générer un planning
        </button>
      </div>

      {showGenerator && (
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 grid gap-3 sm:grid-cols-4 items-end bg-gray-50 dark:bg-gray-900">
          <label className="text-sm">
            Du
            <input
              type="date"
              value={genStart}
              onChange={(e) => setGenStart(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Au
            <input
              type="date"
              value={genEnd}
              onChange={(e) => setGenEnd(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Programme
            <select
              value={genProgram}
              onChange={(e) => setGenProgram(e.target.value as ProgramKey)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            >
              {Object.entries(PROGRAMS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={runGenerator}
          >
            Appliquer
          </button>
          <p className="text-xs text-gray-500 sm:col-span-4">
            Remplit les jours de cette plage avec le cycle choisi (jour de début = 1er jour du cycle). Écrase les
            jours déjà saisis sur cette plage ; tu peux ensuite corriger un jour précis en cliquant dessus.
          </p>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-xs text-gray-500">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="text-center font-medium py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = formatDateKey(day)
          const shift = planning[dateKey]
          const def = shift ? SHIFTS[shift] : null
          const inMonth = isSameMonth(day, month)
          const isEditing = editingDate === dateKey
          return (
            <div
              key={dateKey}
              className={`relative min-h-[64px] rounded-md border p-1 text-left cursor-pointer border-gray-200 dark:border-gray-800 ${
                inMonth ? '' : 'opacity-35'
              } ${def ? def.colorClass : 'bg-white dark:bg-gray-900'}`}
              onClick={() => setEditingDate(isEditing ? null : dateKey)}
            >
              <div className="text-[11px] font-medium">{format(day, 'd')}</div>
              <div className="text-xs font-semibold mt-1">{def ? def.short : ''}</div>
              {isEditing && (
                <div
                  className="absolute z-10 top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-1 w-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  {SHIFT_ORDER.map((key) => (
                    <button
                      key={key}
                      className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setDay(dateKey, key)}
                    >
                      {SHIFTS[key].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs pt-2">
        {SHIFT_ORDER.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${SHIFTS[key].colorClass}`} />
            {SHIFTS[key].label}
          </div>
        ))}
      </div>
    </div>
  )
}
