export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysKey(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

export function isSundayKey(key: string): boolean {
  return parseDateKey(key).getDay() === 0
}

/** Lundi de la semaine ISO contenant la date donnée. */
export function mondayOfWeek(key: string): string {
  const date = parseDateKey(key)
  const day = date.getDay() // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return formatDateKey(date)
}

export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Date de début du cycle de `cycleDays` jours (ancré sur `anchorKey`) qui
 * contient `dateKey`. Fonctionne aussi pour les dates antérieures à
 * l'ancre (pavage régulier dans les deux sens).
 */
export function cycleStartKey(dateKey: string, anchorKey: string, cycleDays: number): string {
  const date = parseDateKey(dateKey)
  const anchor = parseDateKey(anchorKey)
  const diffDays = Math.round((date.getTime() - anchor.getTime()) / MS_PER_DAY)
  const cycleIndex = Math.floor(diffDays / cycleDays)
  return addDaysKey(anchorKey, cycleIndex * cycleDays)
}
