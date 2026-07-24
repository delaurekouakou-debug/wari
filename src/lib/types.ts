// Identifie chaque type de vacation possible.
export type ShiftKey =
  | 'M12_JOUR'
  | 'M12_NUIT'
  | 'M8_MATIN'
  | 'M8_APREM'
  | 'M8_NUIT'
  | 'REPOS'

export interface ShiftDef {
  key: ShiftKey
  label: string
  short: string
  /** Heure de début au format HH:mm, null pour repos */
  start: string | null
  /** Heure de fin au format HH:mm, null pour repos */
  end: string | null
  /** true si la vacation se termine le lendemain */
  crossesMidnight: boolean
  colorClass: string
}

export type ProgramKey = 'P12' | 'P8'

// Le planning est une simple table date (YYYY-MM-DD) -> vacation.
// C'est la source de vérité : la génération par cycle ne fait que la
// pré-remplir, l'utilisateur peut ensuite modifier n'importe quel jour.
export type Planning = Record<string, ShiftKey>

export interface Holiday {
  date: string // YYYY-MM-DD
  label: string
}

export interface Settings {
  salaireBase: number // FCFA / mois
  tauxHoraireBulletin: number | null // FCFA / heure, saisi depuis le bulletin de paie, pour comparatif
  holidays: Holiday[]
  payPeriodStartDay: number // jour du mois où démarre la période de paie (ex: 16)
}

export interface AppData {
  planning: Planning
  settings: Settings
  version: 1
}
