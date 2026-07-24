import type { ProgramKey, ShiftDef, ShiftKey } from './types'

export const SHIFTS: Record<ShiftKey, ShiftDef> = {
  M12_JOUR: {
    key: 'M12_JOUR',
    label: '6h30 - 18h00 (12h jour)',
    short: '12J',
    start: '06:30',
    end: '18:00',
    crossesMidnight: false,
    colorClass: 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100',
  },
  M12_NUIT: {
    key: 'M12_NUIT',
    label: '18h00 - 6h30 (12h nuit)',
    short: '12N',
    start: '18:00',
    end: '06:30',
    crossesMidnight: true,
    colorClass: 'bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100',
  },
  M8_MATIN: {
    key: 'M8_MATIN',
    label: '6h30 - 14h00 (matin)',
    short: '8M',
    start: '06:30',
    end: '14:00',
    crossesMidnight: false,
    colorClass: 'bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-100',
  },
  M8_APREM: {
    key: 'M8_APREM',
    label: '14h00 - 22h00 (après-midi)',
    short: '8A',
    start: '14:00',
    end: '22:00',
    crossesMidnight: false,
    colorClass: 'bg-orange-200 dark:bg-orange-900 text-orange-900 dark:text-orange-100',
  },
  M8_NUIT: {
    key: 'M8_NUIT',
    label: '22h00 - 6h30 (nuit)',
    short: '8N',
    start: '22:00',
    end: '06:30',
    crossesMidnight: true,
    colorClass: 'bg-violet-200 dark:bg-violet-900 text-violet-900 dark:text-violet-100',
  },
  REPOS: {
    key: 'REPOS',
    label: 'Repos',
    short: 'R',
    start: null,
    end: null,
    crossesMidnight: false,
    colorClass: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  },
}

export const SHIFT_ORDER: ShiftKey[] = [
  'M12_JOUR',
  'M12_NUIT',
  'M8_MATIN',
  'M8_APREM',
  'M8_NUIT',
  'REPOS',
]

// Cycles par défaut utilisés par le générateur de planning.
export const PROGRAMS: Record<ProgramKey, { label: string; cycle: ShiftKey[] }> = {
  P12: {
    label: 'Programme 12h (6j)',
    cycle: ['M12_JOUR', 'M12_JOUR', 'M12_NUIT', 'M12_NUIT', 'REPOS', 'REPOS'],
  },
  P8: {
    label: 'Programme 8h (8j)',
    cycle: [
      'M8_MATIN',
      'M8_MATIN',
      'M8_APREM',
      'M8_APREM',
      'M8_NUIT',
      'M8_NUIT',
      'REPOS',
      'REPOS',
    ],
  },
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Durée d'une vacation en heures (0 pour repos). */
export function shiftDurationHours(key: ShiftKey): number {
  const def = SHIFTS[key]
  if (!def.start || !def.end) return 0
  const start = toMinutes(def.start)
  let end = toMinutes(def.end)
  if (def.crossesMidnight) end += 24 * 60
  return (end - start) / 60
}
