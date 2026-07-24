// Moteur de calcul des heures supplémentaires selon le Code du travail
// ivoirien (2015) et le Décret n°96-204 du 7 mars 1996 relatif au travail
// de nuit :
//   - durée légale : 40h / semaine
//   - heures supp   : +15% de la 41e à la 46e heure, +50% au-delà
//   - heures de nuit (21h-5h) : +75%
//   - dimanche / jour férié (jour) : +75%
//   - dimanche / jour férié (nuit) : +100%
//
// Chaque heure travaillée est classée dans un seul palier de paiement (le
// plus favorable parmi ceux applicables), à l'image du bulletin de paie
// réel : "MONTANT DES HS 115%", "150%", "175%"... exprimés en taux plein
// (heures × taux horaire × multiplicateur), et non en supplément cumulé.
// Cela évite de compter deux fois la base d'une heure qui serait à la fois
// heure supp hebdomadaire et heure de nuit, par exemple.
import { SHIFTS, shiftDurationHours, toMinutes } from './shiftDefs'
import type { HsBases, Planning } from './types'
import { addDaysKey, compareDateKeys, formatDateKey, isSundayKey, mondayOfWeek, parseDateKey } from './dateUtils'

const NIGHT_START = 21 * 60 // 21h
const NIGHT_END = 5 * 60 // 5h (jour suivant)
const WEEK_TIER1_START = 40 // 41e heure
const WEEK_TIER2_START = 46 // au-delà de la 46e heure

export type HsRate = 0 | 0.15 | 0.5 | 0.75 | 1

export interface HourBuckets {
  normalHours: number // couvert par le salaire de base, pas de majoration
  hs115Hours: number // +15%
  hs150Hours: number // +50%
  hs175Hours: number // +75% (nuit, ou dimanche/férié jour)
  hs200Hours: number // +100% (dimanche/férié nuit)
}

function emptyBuckets(): HourBuckets {
  return { normalHours: 0, hs115Hours: 0, hs150Hours: 0, hs175Hours: 0, hs200Hours: 0 }
}

function addRate(buckets: HourBuckets, rate: HsRate, hours: number) {
  if (hours <= 0) return
  if (rate === 0) buckets.normalHours += hours
  else if (rate === 0.15) buckets.hs115Hours += hours
  else if (rate === 0.5) buckets.hs150Hours += hours
  else if (rate === 0.75) buckets.hs175Hours += hours
  else buckets.hs200Hours += hours
}

/**
 * Découpe un segment (une portion de vacation sur une seule journée
 * calendaire) en sous-intervalles homogènes du point de vue de la
 * majoration applicable, à partir des points de coupure "heure de nuit"
 * (21h/5h) et "seuil hebdomadaire" (40h/46h), puis classe chaque
 * sous-intervalle sur le taux le plus favorable.
 */
function classifySegment(
  date: string,
  startMin: number,
  endMin: number,
  cumStart: number,
  isSpecialDay: boolean,
  byDate: Map<string, HourBuckets>,
): number {
  const duration = (endMin - startMin) / 60
  const cumEnd = cumStart + duration
  if (duration <= 0) return cumEnd

  const cuts = new Set<number>([startMin, endMin])
  for (const boundary of [NIGHT_END, NIGHT_START]) {
    if (boundary > startMin && boundary < endMin) cuts.add(boundary)
  }
  for (const weekBoundary of [WEEK_TIER1_START, WEEK_TIER2_START]) {
    if (weekBoundary > cumStart && weekBoundary < cumEnd) {
      const minuteOffset = startMin + (weekBoundary - cumStart) * 60
      cuts.add(minuteOffset)
    }
  }

  const points = [...cuts].sort((a, b) => a - b)
  let bucket = byDate.get(date)
  if (!bucket) {
    bucket = emptyBuckets()
    byDate.set(date, bucket)
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (b <= a) continue
    const d = (b - a) / 60
    const mid = (a + b) / 2
    const isNight = mid >= NIGHT_START || mid < NIGHT_END
    const cumMid = cumStart + (mid - startMin) / 60
    const tierRate: HsRate = cumMid < WEEK_TIER1_START ? 0 : cumMid < WEEK_TIER2_START ? 0.15 : 0.5
    const specialRate: HsRate = isSpecialDay ? (isNight ? 1 : 0.75) : isNight ? 0.75 : 0
    const rate: HsRate = tierRate > specialRate ? tierRate : specialRate
    addRate(bucket, rate, d)
  }

  return cumEnd
}

export function computeDayBuckets(planning: Planning, holidays: Set<string>): Map<string, HourBuckets> {
  const byDate = new Map<string, HourBuckets>()

  const weeks = new Map<string, string[]>()
  for (const [dateKey, shiftKey] of Object.entries(planning)) {
    if (shiftDurationHours(shiftKey) <= 0) continue
    const wk = mondayOfWeek(dateKey)
    if (!weeks.has(wk)) weeks.set(wk, [])
    weeks.get(wk)!.push(dateKey)
  }

  for (const dateKeys of weeks.values()) {
    dateKeys.sort(compareDateKeys)
    let cum = 0
    for (const dateKey of dateKeys) {
      const def = SHIFTS[planning[dateKey]]
      if (!def.start || !def.end) continue
      const startMin = toMinutes(def.start)
      let endMin = toMinutes(def.end)
      if (def.crossesMidnight) endMin += 1440

      const seg1End = Math.min(endMin, 1440)
      cum = classifySegment(dateKey, startMin, seg1End, cum, isSundayKey(dateKey) || holidays.has(dateKey), byDate)

      if (def.crossesMidnight) {
        const nextDate = addDaysKey(dateKey, 1)
        const seg2End = endMin - 1440
        cum = classifySegment(nextDate, 0, seg2End, cum, isSundayKey(nextDate) || holidays.has(nextDate), byDate)
      }
    }
  }

  return byDate
}

export interface WeekBreakdown {
  weekStart: string
  weekEnd: string
  totalHours: number
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
    result.push({ weekStart, weekEnd: addDaysKey(weekStart, 6), totalHours })
  }
  result.sort((a, b) => compareDateKeys(a.weekStart, b.weekStart))
  return result
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
  normalHours: number
  hs115Hours: number
  hs150Hours: number
  hs175Hours: number
  hs200Hours: number
  weeks: WeekBreakdown[]
}

export function computePeriodReport(planning: Planning, holidays: Set<string>, period: PayPeriod): PeriodReport {
  const dayBuckets = computeDayBuckets(planning, holidays)
  const totals = emptyBuckets()
  for (const [date, buckets] of dayBuckets) {
    if (date < period.start || date > period.end) continue
    totals.normalHours += buckets.normalHours
    totals.hs115Hours += buckets.hs115Hours
    totals.hs150Hours += buckets.hs150Hours
    totals.hs175Hours += buckets.hs175Hours
    totals.hs200Hours += buckets.hs200Hours
  }

  const totalHours = totals.normalHours + totals.hs115Hours + totals.hs150Hours + totals.hs175Hours + totals.hs200Hours

  const allWeeks = computeWeeklyBreakdown(planning)
  const weeksInPeriod = allWeeks.filter((w) => w.weekEnd >= period.start && w.weekStart <= period.end)

  return {
    period,
    totalHours,
    normalHours: totals.normalHours,
    hs115Hours: totals.hs115Hours,
    hs150Hours: totals.hs150Hours,
    hs175Hours: totals.hs175Hours,
    hs200Hours: totals.hs200Hours,
    weeks: weeksInPeriod,
  }
}

// 40h/semaine x 52 semaines / 12 mois : équivalent mensuel de la durée légale.
export const LEGAL_MONTHLY_HOURS = (40 * 52) / 12

export interface PayBreakdown {
  baseAmount: number
  hs115Rate: number
  hs150Rate: number
  hs175Rate: number
  hs200Rate: number
  hs115Amount: number
  hs150Amount: number
  hs175Amount: number
  hs200Amount: number
  totalSupplements: number
  totalPay: number
}

/** hsBases : base horaire chargée (FCFA/h) par palier, telle que lue sur le bulletin de paie. */
export function computePay(report: PeriodReport, hsBases: HsBases, salaireBase: number): PayBreakdown {
  const hs115Amount = report.hs115Hours * hsBases.r115
  const hs150Amount = report.hs150Hours * hsBases.r150
  const hs175Amount = report.hs175Hours * hsBases.r175
  const hs200Amount = report.hs200Hours * hsBases.r200
  const totalSupplements = hs115Amount + hs150Amount + hs175Amount + hs200Amount
  return {
    baseAmount: salaireBase,
    hs115Rate: hsBases.r115,
    hs150Rate: hsBases.r150,
    hs175Rate: hsBases.r175,
    hs200Rate: hsBases.r200,
    hs115Amount,
    hs150Amount,
    hs175Amount,
    hs200Amount,
    totalSupplements,
    totalPay: salaireBase + totalSupplements,
  }
}
