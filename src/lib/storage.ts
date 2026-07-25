import type { AppData, BulletinData, Holiday, Settings } from './types'
import { formatDateKey } from './dateUtils'

const STORAGE_KEY = 'overtime-ci:data'

// Jours fériés fixes en Côte d'Ivoire. Les fêtes mobiles (Pâques,
// Ascension, Pentecôte, Aïd el-Fitr, Tabaski, Maouloud...) changent chaque
// année : à ajouter manuellement dans les paramètres.
export const DEFAULT_HOLIDAYS: Holiday[] = [
  { date: `${new Date().getFullYear()}-01-01`, label: "Jour de l'An" },
  { date: `${new Date().getFullYear()}-05-01`, label: 'Fête du Travail' },
  { date: `${new Date().getFullYear()}-08-06`, label: "Fête de l'Indépendance" },
  { date: `${new Date().getFullYear()}-08-15`, label: 'Assomption' },
  { date: `${new Date().getFullYear()}-11-01`, label: 'Toussaint' },
  { date: `${new Date().getFullYear()}-11-15`, label: 'Journée nationale de la Paix' },
  { date: `${new Date().getFullYear()}-12-25`, label: 'Noël' },
]

export const DEFAULT_SETTINGS: Settings = {
  salaireBase: 0,
  hsRates: { r115: 115, r150: 150, r175: 175, r200: 200 },
  // Bases horaires chargées (FCFA/h) telles que lues sur le bulletin de paie.
  hsBases: { r115: 2838.46, r150: 3702.34, r175: 4319.4, r200: 4936.46 },
  panierBase: 1298,
  holidays: DEFAULT_HOLIDAYS,
  payPeriodStartDay: 17,
  // Décret n°96-203 du 7 mars 1996 : travail en équipes successives organisé
  // en cycle de rotation dépassant la semaine -> seules les heures
  // dépassant la durée moyenne calculée sur le cycle complet sont des
  // heures supp. cycleDays/cycleAnchor sont à ajuster au cycle réel.
  overtimeMode: 'cycle',
  cycleDays: 6,
  cycleAnchor: formatDateKey(new Date()),
  normalWeeklyHours: 40,
  categorieProfessionnelle: 'M4',
}

const EMPTY_PAID_LINE = { heures: 0, taux: 0 }

function id(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `l${Math.random().toString(36).slice(2)}`
}

/** Modèle de bulletin pré-rempli avec les libellés/codes usuels, montants à 0 (à ajuster). */
export function createDefaultBulletin(): BulletinData {
  return {
    gainsFixes: [
      { id: id(), code: '0310', label: 'SALAIRE DE BASE', montant: 0 },
      { id: id(), code: '0450', label: 'SURSALAIRE', montant: 0 },
      { id: id(), code: '0545', label: 'ANCIENNETE', montant: 0 },
      { id: id(), code: '1053', label: 'IDT DE LOGEMENT', montant: 0 },
      { id: id(), code: '1210', label: 'IDT DE TRANSPORT', montant: 0 },
    ],
    retenuesStatutaires: [
      { id: id(), code: '4010', label: 'CNPS RETRAITE', montant: 0 },
      { id: id(), code: '4074', label: 'ASSURANCE MALADIE', montant: 0 },
      { id: id(), code: '4085', label: 'COTISATION CMU', montant: 0 },
      { id: id(), code: '4217', label: 'ITS A PAYER', montant: 0 },
    ],
    retenuesDiverses: [
      { id: id(), code: '6522', label: 'RETENUE CANTINE', montant: 0 },
      { id: id(), code: '6557', label: 'RETENUE MUTUELLE', montant: 0 },
      { id: id(), code: '6572', label: 'RETENUE CANAL', montant: 0 },
      { id: id(), code: '7181', label: 'PRET SCOLAIRE', montant: 0 },
    ],
  }
}

function normalizeBulletin(data: Partial<BulletinData> | undefined): BulletinData {
  if (!data) return createDefaultBulletin()
  return {
    gainsFixes: data.gainsFixes ?? [],
    retenuesStatutaires: data.retenuesStatutaires ?? [],
    retenuesDiverses: data.retenuesDiverses ?? [],
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { planning: {}, settings: DEFAULT_SETTINGS, paidByPeriod: {}, bulletinByPeriod: {}, version: 1 }
    const parsed = JSON.parse(raw) as AppData
    return {
      planning: parsed.planning ?? {},
      settings: {
        ...DEFAULT_SETTINGS,
        ...parsed.settings,
        hsRates: { ...DEFAULT_SETTINGS.hsRates, ...parsed.settings?.hsRates },
        hsBases: { ...DEFAULT_SETTINGS.hsBases, ...parsed.settings?.hsBases },
      },
      paidByPeriod: Object.fromEntries(
        Object.entries(parsed.paidByPeriod ?? {}).map(([period, amounts]) => [
          period,
          {
            hs115: { ...EMPTY_PAID_LINE, ...amounts?.hs115 },
            hs150: { ...EMPTY_PAID_LINE, ...amounts?.hs150 },
            hs175: { ...EMPTY_PAID_LINE, ...amounts?.hs175 },
            hs200: { ...EMPTY_PAID_LINE, ...amounts?.hs200 },
            panier: { ...EMPTY_PAID_LINE, ...amounts?.panier },
          },
        ]),
      ),
      bulletinByPeriod: Object.fromEntries(
        Object.entries(parsed.bulletinByPeriod ?? {}).map(([period, data]) => [period, normalizeBulletin(data)]),
      ),
      version: 1,
    }
  } catch {
    return { planning: {}, settings: DEFAULT_SETTINGS, paidByPeriod: {}, bulletinByPeriod: {}, version: 1 }
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
