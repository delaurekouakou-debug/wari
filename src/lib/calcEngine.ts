// Moteur de calcul des heures supplémentaires selon le Code du travail
// ivoirien (2015) et le Décret n°96-204 du 7 mars 1996 relatif au travail
// de nuit :
//   - durée légale : 40h / semaine
//   - heures supp   : +15% de la 41e à la 46e heure, +50% au-delà
//   - heures de nuit (21h-5h) : +75%
//   - dimanche / jour férié (jour) : +75%
//   - dimanche / jour férié (nuit) : +100%
//
// Hypothèse d'attribution : une vacation est rattachée à la semaine (lundi
// à dimanche) de sa date de début pour le calcul du seuil de 40h, et une
// semaine est rattachée à la période de paie qui contient son dimanche.
import { SHIFTS, shiftDurationHours, toMinutes } from './shiftDefs'
import type { Planning } from './types'
import { addDaysKey, compareDateKeys, formatDateKey, isSundayKey, mondayOfWeek, parseDateKey } from './dateUtils'

const NIGHT_EVENING_START = 21 * 60
const NIGHT_EVENING_END = 24 * 60
const NIGHT_MORNING_START = 0
const NIGHT_MORNING_END = 5 * 60

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

export interface WeekBreakdown {
  weekStart: string
  weekEnd: string
  totalHours: number
  tier1Hours: number // 15% (41e-46e heure)
  tier2Hours: number // 50% (au-delà de la 46e)
}

export function computeWeeklyBreakdown(planning: Planning): WeekBreakdown[] {
  const totals = new Map<string, number>()
  for (const [dateKey, shiftKey] of Object.entries(planning)) {
    const hours = shiftDurationHours(shiftKey)
    if (hours <= 0) continue
    const wk = mondayOfWeek(dateKey)
    totals.set(wk, (totals.get(wk) ?? 0) + hours)
  }
  const result: WeekBreakdown[] = []
  for (const [weekStart, totalHours] of totals) {
    const tier1Hours = Math.min(Math.max(totalHours - 40, 0), 6)
    const tier2Hours = Math.max(totalHours - 46, 0)
    result.push({ weekStart, weekEnd: addDaysKey(weekStart, 6), totalHours, tier1Hours, tier2Hours })
  }
  result.sort((a, b) => compareDateKeys(a.weekStart, b.weekStart))
  return result
}

export interface DayCategoryHours {
  date: string
  nightHours: number // nuit hors dimanche/férié -> +75%
  sundayHolidayDayHours: number // jour, dimanche/férié -> +75%
  sundayHolidayNightHours: number // nuit, dimanche/férié -> +100%
  normalHours: number // ni nuit ni dimanche/férié
}

export function computeDayCategories(planning: Planning, holidays: Set<string>): DayCategoryHours[] {
  const byDate = new Map<string, DayCategoryHours>()
  const ensure = (date: string) => {
    let v = byDate.get(date)
    if (!v) {
      v = { date, nightHours: 0, sundayHolidayDayHours: 0, sundayHolidayNightHours: 0, normalHours: 0 }
      byDate.set(date, v)
    }
    return v
  }

  for (const [dateKey, shiftKey] of Object.entries(planning)) {
    const def = SHIFTS[shiftKey]
    if (!def.start || !def.end) continue
    const startMin = toMinutes(def.start)
    let endMin = toMinutes(def.end)
    if (def.crossesMidnight) endMin += 1440

    const segments = [{ date: dateKey, startMin, endMin: Math.min(endMin, 1440) }]
    if (def.crossesMidnight) {
      segments.push({ date: addDaysKey(dateKey, 1), startMin: 0, endMin: endMin - 1440 })
    }

    for (const seg of segments) {
      const duration = (seg.endMin - seg.startMin) / 60
      if (duration <= 0) continue
      const nightMin =
        overlapMinutes(seg.startMin, seg.endMin, NIGHT_EVENING_START, NIGHT_EVENING_END) +
        overlapMinutes(seg.startMin, seg.endMin, NIGHT_MORNING_START, NIGHT_MORNING_END)
      const nightH = nightMin / 60
      const nonNightH = duration - nightH
      const special = isSundayKey(seg.date) || holidays.has(seg.date)

      const bucket = ensure(seg.date)
      if (special) {
        bucket.sundayHolidayNightHours += nightH
        bucket.sundayHolidayDayHours += nonNightH
      } else {
        bucket.nightHours += nightH
        bucket.normalHours += nonNightH
      }
    }
  }

  return [...byDate.values()].sort((a, b) => compareDateKeys(a.date, b.date))
}

export interface PayPeriod {
  start: string
  end: string
  label: string
}

export function getPayPeriod(dateKey: string, startDay: number): PayPeriod {
  const date = parseDateKey(dateKey)
  let periodStart = new Date(date.getFullYear(), date.getMonth(), startDay)
  if (date.getDate() < startDay) {
    periodStart = new Date(date.getFullYear(), date.getMonth() - 1, startDay)
  }
  const periodEndExclusive = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, startDay)
  const periodEnd = new Date(periodEndExclusive)
  periodEnd.setDate(periodEnd.getDate() - 1)
  const start = formatDateKey(periodStart)
  const end = formatDateKey(periodEnd)
  return { start, end, label: `${start} au ${end}` }
}

export function shiftPayPeriod(period: PayPeriod, deltaMonths: number, startDay: number): PayPeriod {
  const mid = parseDateKey(period.start)
  mid.setMonth(mid.getMonth() + deltaMonths)
  return getPayPeriod(formatDateKey(mid), startDay)
}

export interface PeriodReport {
  period: PayPeriod
  totalHours: number
  tier1Hours: number
  tier2Hours: number
  nightHours: number
  sundayHolidayDayHours: number
  sundayHolidayNightHours: number
  weeks: WeekBreakdown[]
  days: DayCategoryHours[]
}

export function computePeriodReport(planning: Planning, holidays: Set<string>, period: PayPeriod): PeriodReport {
  const allWeeks = computeWeeklyBreakdown(planning)
  const weeksInPeriod = allWeeks.filter((w) => w.weekEnd >= period.start && w.weekEnd <= period.end)

  const allDayCats = computeDayCategories(planning, holidays)
  const daysInPeriod = allDayCats.filter((d) => d.date >= period.start && d.date <= period.end)

  const totalHoursWorked = Object.entries(planning)
    .filter(([date]) => date >= period.start && date <= period.end)
    .reduce((sum, [, shiftKey]) => sum + shiftDurationHours(shiftKey), 0)

  const tier1Hours = weeksInPeriod.reduce((s, w) => s + w.tier1Hours, 0)
  const tier2Hours = weeksInPeriod.reduce((s, w) => s + w.tier2Hours, 0)
  const nightHours = daysInPeriod.reduce((s, d) => s + d.nightHours, 0)
  const sundayHolidayDayHours = daysInPeriod.reduce((s, d) => s + d.sundayHolidayDayHours, 0)
  const sundayHolidayNightHours = daysInPeriod.reduce((s, d) => s + d.sundayHolidayNightHours, 0)

  return {
    period,
    totalHours: totalHoursWorked,
    tier1Hours,
    tier2Hours,
    nightHours,
    sundayHolidayDayHours,
    sundayHolidayNightHours,
    weeks: weeksInPeriod,
    days: daysInPeriod,
  }
}

// 40h/semaine x 52 semaines / 12 mois : équivalent mensuel de la durée légale.
export const LEGAL_MONTHLY_HOURS = (40 * 52) / 12

export interface PayBreakdown {
  tauxHoraire: number
  baseAmount: number
  tier1Amount: number
  tier2Amount: number
  nightAmount: number
  sundayDayAmount: number
  sundayNightAmount: number
  totalSupplements: number
  totalPay: number
}

/**
 * tier1/tier2 sont payées intégralement (taux + majoration) car ce sont des
 * heures travaillées en plus des heures normales couvertes par le salaire
 * de base. Les primes nuit/dimanche/férié sont des suppléments (majoration
 * seule) car la base de ces heures est déjà réglée soit par le salaire de
 * base, soit par le paiement intégral des heures supp ci-dessus.
 */
export function computePay(report: PeriodReport, tauxHoraire: number, salaireBase: number): PayBreakdown {
  const tier1Amount = report.tier1Hours * tauxHoraire * 1.15
  const tier2Amount = report.tier2Hours * tauxHoraire * 1.5
  const nightAmount = report.nightHours * tauxHoraire * 0.75
  const sundayDayAmount = report.sundayHolidayDayHours * tauxHoraire * 0.75
  const sundayNightAmount = report.sundayHolidayNightHours * tauxHoraire * 1.0
  const totalSupplements = tier1Amount + tier2Amount + nightAmount + sundayDayAmount + sundayNightAmount
  return {
    tauxHoraire,
    baseAmount: salaireBase,
    tier1Amount,
    tier2Amount,
    nightAmount,
    sundayDayAmount,
    sundayNightAmount,
    totalSupplements,
    totalPay: salaireBase + totalSupplements,
  }
}
