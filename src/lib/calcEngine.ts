// Moteur de calcul des heures supplémentaires selon le Code du travail
// ivoirien (2015) et les décrets n°96-203 (durée du travail) et n°96-204
// (travail de nuit) du 7 mars 1996 :
//   - durée légale : 40h / semaine (régime "semaine civile")
//   - heures supp   : +15% de la 41e à la 46e heure, +50% au-delà
//   - heures de nuit (21h-5h) : +75%
//   - dimanche / jour férié (jour) : +75%
//   - dimanche / jour férié (nuit) : +100%
//
// Régime "cycle de travail" (Décret n°96-203, dispositions sur le travail
// en équipes successives organisé en cycle de rotation dépassant la
// semaine) : seules les heures dépassant la durée moyenne calculée sur le
// cycle complet — plafonnée à 42h/semaine en moyenne — sont des heures
// supplémentaires, plutôt qu'un découpage semaine civile par semaine
// civile qui produirait des résultats erratiques selon l'alignement
// arbitraire du cycle avec le calendrier.
//
// Chaque heure travaillée est classée dans un seul palier de paiement (le
// plus favorable parmi ceux applicables), à l'image du bulletin de paie
// réel : "MONTANT DES HS 115%", "150%", "175%"... exprimés en taux plein
// (heures × taux horaire × multiplicateur), et non en supplément cumulé.
// Cela évite de compter deux fois la base d'une heure qui serait à la fois
// heure supp hebdomadaire/cycle et heure de nuit, par exemple.
import { SHIFTS, shiftDurationHours, toMinutes } from './shiftDefs'
import type { HsBases, OvertimeMode, Planning, ShiftKey } from './types'
import {
  addDaysKey,
  compareDateKeys,
  cycleStartKey,
  formatDateKey,
  isSundayKey,
  mondayOfWeek,
  parseDateKey,
} from './dateUtils'

// Vacations donnant droit à la prime de panier (indemnité de repas pour le
// travail de nuit) : une occurrence par jour où l'une de ces vacations est
// travaillée.
export const PANIER_SHIFT_KEYS: ShiftKey[] = ['M12_NUIT', 'M8_NUIT']

const NIGHT_START = 21 * 60 // 21h
const NIGHT_END = 5 * 60 // 5h (jour suivant)
const TIER_BRACKET_HOURS = 6 // largeur de la tranche à +15% (41e-46e heure), mise à l'échelle de la période

function referencePeriodStart(
  dateKey: string,
  mode: OvertimeMode,
  cycleDays: number,
  cycleAnchor: string,
): string {
  return mode === 'cycle' ? cycleStartKey(dateKey, cycleAnchor, cycleDays) : mondayOfWeek(dateKey)
}

function referencePeriodLength(mode: OvertimeMode, cycleDays: number): number {
  return mode === 'cycle' ? Math.max(1, cycleDays) : 7
}

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
 * (21h/5h) et "seuil de la période de référence" (tier1Start/tier2Start,
 * en heures cumulées depuis le début de la semaine ou du cycle), puis
 * classe chaque sous-intervalle sur le taux le plus favorable.
 */
function classifySegment(
  date: string,
  startMin: number,
  endMin: number,
  cumStart: number,
  isSpecialDay: boolean,
  tier1Start: number,
  tier2Start: number,
  byDate: Map<string, HourBuckets>,
): number {
  const duration = (endMin - startMin) / 60
  const cumEnd = cumStart + duration
  if (duration <= 0) return cumEnd

  const cuts = new Set<number>([startMin, endMin])
  for (const boundary of [NIGHT_END, NIGHT_START]) {
    if (boundary > startMin && boundary < endMin) cuts.add(boundary)
  }
  for (const tierBoundary of [tier1Start, tier2Start]) {
    if (tierBoundary > cumStart && tierBoundary < cumEnd) {
      const minuteOffset = startMin + (tierBoundary - cumStart) * 60
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
    const tierRate: HsRate = cumMid < tier1Start ? 0 : cumMid < tier2Start ? 0.15 : 0.5
    const specialRate: HsRate = isSpecialDay ? (isNight ? 1 : 0.75) : isNight ? 0.75 : 0
    const rate: HsRate = tierRate > specialRate ? tierRate : specialRate
    addRate(bucket, rate, d)
  }

  return cumEnd
}

export function computeDayBuckets(
  planning: Planning,
  holidays: Set<string>,
  mode: OvertimeMode,
  cycleDays: number,
  cycleAnchor: string,
  normalWeeklyHours: number,
): Map<string, HourBuckets> {
  const byDate = new Map<string, HourBuckets>()

  const periodLength = referencePeriodLength(mode, cycleDays)
  const scale = periodLength / 7
  const tier1Start = normalWeeklyHours * scale
  const tier2Start = tier1Start + TIER_BRACKET_HOURS * scale

  const periods = new Map<string, string[]>()
  for (const [dateKey, shiftKey] of Object.entries(planning)) {
    if (shiftDurationHours(shiftKey) <= 0) continue
    const pk = referencePeriodStart(dateKey, mode, cycleDays, cycleAnchor)
    if (!periods.has(pk)) periods.set(pk, [])
    periods.get(pk)!.push(dateKey)
  }

  for (const dateKeys of periods.values()) {
    dateKeys.sort(compareDateKeys)
    let cum = 0
    for (const dateKey of dateKeys) {
      const def = SHIFTS[planning[dateKey]]
      if (!def.start || !def.end) continue
      const startMin = toMinutes(def.start)
      let endMin = toMinutes(def.end)
      if (def.crossesMidnight) endMin += 1440

      const seg1End = Math.min(endMin, 1440)
      cum = classifySegment(
        dateKey,
        startMin,
        seg1End,
        cum,
        isSundayKey(dateKey) || holidays.has(dateKey),
        tier1Start,
        tier2Start,
        byDate,
      )

      if (def.crossesMidnight) {
        const nextDate = addDaysKey(dateKey, 1)
        const seg2End = endMin - 1440
        cum = classifySegment(
          nextDate,
          0,
          seg2End,
          cum,
          isSundayKey(nextDate) || holidays.has(nextDate),
          tier1Start,
          tier2Start,
          byDate,
        )
      }
    }
  }

  return byDate
}

export interface ReferencePeriodBreakdown {
  periodStart: string
  periodEnd: string
  totalHours: number
}

export function computeReferenceBreakdown(
  planning: Planning,
  mode: OvertimeMode,
  cycleDays: number,
  cycleAnchor: string,
): ReferencePeriodBreakdown[] {
  const periodLength = referencePeriodLength(mode, cycleDays)
  const totals = new Map<string, number>()
  for (const [dateKey, shiftKey] of Object.entries(planning)) {
    const hours = shiftDurationHours(shiftKey)
    if (hours <= 0) continue
    const pk = referencePeriodStart(dateKey, mode, cycleDays, cycleAnchor)
    totals.set(pk, (totals.get(pk) ?? 0) + hours)
  }
  const result: ReferencePeriodBreakdown[] = []
  for (const [periodStart, totalHours] of totals) {
    result.push({ periodStart, periodEnd: addDaysKey(periodStart, periodLength - 1), totalHours })
  }
  result.sort((a, b) => compareDateKeys(a.periodStart, b.periodStart))
  return result
}

export interface DayDetail {
  date: string
  shiftLabel: string
  isSpecial: boolean
  isPanier: boolean
  hs115: number
  hs150: number
  hs175: number
  hs200: number
}

/**
 * Détail jour par jour (uniquement les jours générant des heures majorées
 * ou une prime de panier), pour servir de preuve concrète — date par date
 * — dans les échanges avec les RH.
 */
export function computeDayDetails(
  planning: Planning,
  holidays: Set<string>,
  mode: OvertimeMode,
  cycleDays: number,
  cycleAnchor: string,
  normalWeeklyHours: number,
): DayDetail[] {
  const buckets = computeDayBuckets(planning, holidays, mode, cycleDays, cycleAnchor, normalWeeklyHours)
  const details: DayDetail[] = []
  for (const [date, b] of buckets) {
    const shiftKey = planning[date]
    const isPanier = !!shiftKey && PANIER_SHIFT_KEYS.includes(shiftKey)
    const hasHs = b.hs115Hours > 0 || b.hs150Hours > 0 || b.hs175Hours > 0 || b.hs200Hours > 0
    if (!hasHs && !isPanier) continue

    let shiftLabel: string
    if (shiftKey && shiftKey !== 'REPOS') {
      shiftLabel = SHIFTS[shiftKey].label
    } else {
      const prevShift = planning[addDaysKey(date, -1)]
      shiftLabel = prevShift && SHIFTS[prevShift].crossesMidnight ? `${SHIFTS[prevShift].label} (suite)` : '—'
    }

    details.push({
      date,
      shiftLabel,
      isSpecial: isSundayKey(date) || holidays.has(date),
      isPanier,
      hs115: b.hs115Hours,
      hs150: b.hs150Hours,
      hs175: b.hs175Hours,
      hs200: b.hs200Hours,
    })
  }
  details.sort((a, b) => compareDateKeys(a.date, b.date))
  return details
}

export function motifForDay(d: DayDetail): string {
  const reasons: string[] = []
  if (d.hs115 > 0 || d.hs150 > 0) reasons.push('Heures supp (seuil hebdomadaire/cycle dépassé)')
  if (d.hs175 > 0) reasons.push(d.isSpecial ? 'Dimanche/férié (jour)' : 'Nuit (21h-5h)')
  if (d.hs200 > 0) reasons.push('Nuit + dimanche/férié')
  if (d.isPanier) reasons.push('Vacation de nuit (panier)')
  return reasons.join(' · ')
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

export interface OvertimeConfig {
  mode: OvertimeMode
  cycleDays: number
  cycleAnchor: string
  normalWeeklyHours: number
}

export interface PeriodReport {
  period: PayPeriod
  totalHours: number
  normalHours: number
  hs115Hours: number
  hs150Hours: number
  hs175Hours: number
  hs200Hours: number
  panierCount: number
  periods: ReferencePeriodBreakdown[]
}

export function computePeriodReport(
  planning: Planning,
  holidays: Set<string>,
  period: PayPeriod,
  overtime: OvertimeConfig,
): PeriodReport {
  const dayBuckets = computeDayBuckets(
    planning,
    holidays,
    overtime.mode,
    overtime.cycleDays,
    overtime.cycleAnchor,
    overtime.normalWeeklyHours,
  )
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

  const allPeriods = computeReferenceBreakdown(planning, overtime.mode, overtime.cycleDays, overtime.cycleAnchor)
  const periodsInRange = allPeriods.filter((p) => p.periodEnd >= period.start && p.periodStart <= period.end)

  let panierCount = 0
  for (const [dateKey, shiftKey] of Object.entries(planning)) {
    if (dateKey < period.start || dateKey > period.end) continue
    if (PANIER_SHIFT_KEYS.includes(shiftKey)) panierCount++
  }

  return {
    period,
    totalHours,
    normalHours: totals.normalHours,
    hs115Hours: totals.hs115Hours,
    hs150Hours: totals.hs150Hours,
    hs175Hours: totals.hs175Hours,
    hs200Hours: totals.hs200Hours,
    panierCount,
    periods: periodsInRange,
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
  panierAmount: number
  totalSupplements: number
  totalPay: number
}

/**
 * hsBases : base horaire chargée (FCFA/h) par palier, telle que lue sur le
 * bulletin de paie. panierBase : indemnité de panier (FCFA) par vacation de
 * nuit travaillée.
 */
export function computePay(report: PeriodReport, hsBases: HsBases, panierBase: number, salaireBase: number): PayBreakdown {
  const hs115Amount = report.hs115Hours * hsBases.r115
  const hs150Amount = report.hs150Hours * hsBases.r150
  const hs175Amount = report.hs175Hours * hsBases.r175
  const hs200Amount = report.hs200Hours * hsBases.r200
  const panierAmount = report.panierCount * panierBase
  const totalSupplements = hs115Amount + hs150Amount + hs175Amount + hs200Amount + panierAmount
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
    panierAmount,
    totalSupplements,
    totalPay: salaireBase + totalSupplements,
  }
}
