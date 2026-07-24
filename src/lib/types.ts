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

// Pourcentages de majoration par palier, affichés comme référence et pour
// suggérer une base à partir du salaire. Éditables au cas où la loi ou la
// convention collective change.
export interface HsRates {
  r115: number
  r150: number
  r175: number
  r200: number
}

// Bases horaires chargées (FCFA/h) réellement utilisées pour calculer les
// montants dus, une par palier — comme les colonnes "Base" du bulletin de
// paie (ex: 2838,46 pour HS 115%).
export interface HsBases {
  r115: number
  r150: number
  r175: number
  r200: number
}

export interface Settings {
  salaireBase: number // FCFA / mois
  hsRates: HsRates
  hsBases: HsBases
  panierBase: number // FCFA par vacation de nuit (indemnité de panier)
  holidays: Holiday[]
  payPeriodStartDay: number // jour du mois où démarre la période de paie (ex: 16)
}

// Une ligne "Nombre × Base = Montant", comme sur le bulletin de paie. Pour
// les paliers HS, "heures" est un nombre d'heures ; pour la prime de
// panier, "heures" représente un nombre de vacations de nuit.
export interface PaidLine {
  heures: number
  taux: number // FCFA / unité, taux chargé tel qu'affiché sur le bulletin
}

// Montants réellement payés (lus sur le bulletin de paie) pour une période,
// saisis manuellement pour le comparatif payé / dû.
export interface PaidAmounts {
  hs115: PaidLine
  hs150: PaidLine
  hs175: PaidLine
  hs200: PaidLine
  panier: PaidLine
}

export type PaidByPeriod = Record<string, PaidAmounts> // clé = period.start (YYYY-MM-DD)

export interface AppData {
  planning: Planning
  settings: Settings
  paidByPeriod: PaidByPeriod
  version: 1
}
