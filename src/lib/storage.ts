import type { AppData, Holiday, Settings } from './types'

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
  payPeriodStartDay: 16,
}

const EMPTY_PAID_LINE = { heures: 0, taux: 0 }

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { planning: {}, settings: DEFAULT_SETTINGS, paidByPeriod: {}, version: 1 }
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
      version: 1,
    }
  } catch {
    return { planning: {}, settings: DEFAULT_SETTINGS, paidByPeriod: {}, version: 1 }
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
