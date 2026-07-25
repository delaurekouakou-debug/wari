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

// "semaine" : seuil hebdomadaire calculé semaine civile par semaine civile
// (lundi-dimanche) — régime de droit commun.
// "cycle" : pour le travail en équipes successives organisé en cycle de
// rotation dépassant la semaine, seules les heures dépassant la durée
// moyenne calculée sur le cycle complet sont des heures supp (Décret
// n°96-203 du 7 mars 1996, art. relatif aux cycles de travail).
export type OvertimeMode = 'semaine' | 'cycle'

export interface Settings {
  salaireBase: number // FCFA / mois
  hsRates: HsRates
  hsBases: HsBases
  panierBase: number // FCFA par vacation de nuit (indemnité de panier)
  holidays: Holiday[]
  payPeriodStartDay: number // jour du mois où démarre la période de paie (ex: 17)
  overtimeMode: OvertimeMode
  cycleDays: number // longueur du cycle de rotation en jours (ex: 6 ou 8)
  cycleAnchor: string // date (YYYY-MM-DD) marquant le début d'un cycle de référence
  normalWeeklyHours: number // seuil hebdomadaire moyen normal avant majoration (40 en semaine civile, jusqu'à 42 en cycle continu)
  categorieProfessionnelle: string // ex: "M4", informatif (affiché sur le bulletin)
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

// Une ligne libre du bulletin (gain ou retenue) : code bulletin (informatif),
// libellé, montant modifiable directement.
export interface BulletinLine {
  id: string
  code: string
  label: string
  montant: number
}

// Bulletin de salaire mensuel reconstitué pour une période : les gains fixes
// et retenues sont éditables librement (montants copiés depuis le vrai
// bulletin), les heures supp / prime de panier sont injectées
// automatiquement depuis le moteur de calcul (non stockées ici).
export interface BulletinData {
  gainsFixes: BulletinLine[]
  retenuesStatutaires: BulletinLine[]
  retenuesDiverses: BulletinLine[]
}

export type BulletinByPeriod = Record<string, BulletinData> // clé = period.start (YYYY-MM-DD)

export interface AppData {
  planning: Planning
  settings: Settings
  paidByPeriod: PaidByPeriod
  bulletinByPeriod: BulletinByPeriod
  version: 1
}
