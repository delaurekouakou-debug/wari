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
  tauxHoraireBulletin: null,
  holidays: DEFAULT_HOLIDAYS,
  payPeriodStartDay: 16,
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { planning: {}, settings: DEFAULT_SETTINGS, version: 1 }
    const parsed = JSON.parse(raw) as AppData
    return {
      planning: parsed.planning ?? {},
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      version: 1,
    }
  } catch {
    return { planning: {}, settings: DEFAULT_SETTINGS, version: 1 }
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
