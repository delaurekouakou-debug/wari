import { PROGRAMS } from './shiftDefs'
import type { Planning, ProgramKey } from './types'
import { addDaysKey, compareDateKeys } from './dateUtils'

/**
 * Remplit `planning` (en place, retourne une nouvelle copie) de `startDate`
 * à `endDate` inclus, en suivant le cycle du programme choisi. N'importe
 * quel jour peut ensuite être modifié individuellement dans le planning
 * résultant : la génération n'est qu'un pré-remplissage pratique.
 */
export function generatePlanning(
  planning: Planning,
  program: ProgramKey,
  startDate: string,
  endDate: string,
): Planning {
  const cycle = PROGRAMS[program].cycle
  const next: Planning = { ...planning }
  let date = startDate
  let i = 0
  while (compareDateKeys(date, endDate) <= 0) {
    next[date] = cycle[i % cycle.length]
    date = addDaysKey(date, 1)
    i++
  }
  return next
}

export function clearPlanningRange(planning: Planning, startDate: string, endDate: string): Planning {
  const next: Planning = {}
  for (const [date, shift] of Object.entries(planning)) {
    if (date >= startDate && date <= endDate) continue
    next[date] = shift
  }
  return next
}
