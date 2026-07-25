import { useEffect, useState } from 'react'
import HomeView from './components/HomeView'
import PlanningView from './components/PlanningView'
import SettingsView from './components/SettingsView'
import ReportsView from './components/ReportsView'
import ComparatifView from './components/ComparatifView'
import BulletinView from './components/BulletinView'
import { loadData, saveData } from './lib/storage'
import { getPayPeriod, shiftPayPeriod, type PayPeriod } from './lib/calcEngine'
import { formatDateKey } from './lib/dateUtils'
import type { AppData } from './lib/types'

type Tab = 'accueil' | 'planning' | 'rapports' | 'comparatif' | 'bulletin' | 'parametres'

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [tab, setTab] = useState<Tab>('accueil')
  const [period, setPeriod] = useState<PayPeriod>(() =>
    getPayPeriod(formatDateKey(new Date()), data.settings.payPeriodStartDay),
  )

  useEffect(() => {
    saveData(data)
  }, [data])

  // Si le jour de début de période change dans Paramètres, recale la
  // période active dessus pour rester cohérent.
  useEffect(() => {
    setPeriod((p) => getPayPeriod(p.start, data.settings.payPeriodStartDay))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.settings.payPeriodStartDay])

  function shiftPeriod(delta: number) {
    setPeriod((p) => shiftPayPeriod(p, delta, data.settings.payPeriodStartDay))
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold">Heures Supp — Côte d'Ivoire</h1>
          <nav className="flex gap-1 no-print flex-wrap">
            {(
              [
                ['accueil', 'Accueil'],
                ['planning', 'Planning'],
                ['rapports', 'Rapports'],
                ['comparatif', 'Comparatif'],
                ['bulletin', 'Bulletin'],
                ['parametres', 'Paramètres'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  tab === key
                    ? 'bg-emerald-600 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'accueil' && (
          <HomeView
            planning={data.planning}
            settings={data.settings}
            paidByPeriod={data.paidByPeriod}
            bulletinByPeriod={data.bulletinByPeriod}
            period={period}
            onShiftPeriod={shiftPeriod}
            onNavigate={(t) => setTab(t)}
          />
        )}
        {tab === 'planning' && (
          <PlanningView planning={data.planning} onChange={(planning) => setData((d) => ({ ...d, planning }))} />
        )}
        {tab === 'rapports' && (
          <ReportsView planning={data.planning} settings={data.settings} period={period} onShiftPeriod={shiftPeriod} />
        )}
        {tab === 'comparatif' && (
          <ComparatifView
            planning={data.planning}
            settings={data.settings}
            paidByPeriod={data.paidByPeriod}
            onChange={(paidByPeriod) => setData((d) => ({ ...d, paidByPeriod }))}
            period={period}
            onShiftPeriod={shiftPeriod}
          />
        )}
        {tab === 'bulletin' && (
          <BulletinView
            planning={data.planning}
            settings={data.settings}
            bulletinByPeriod={data.bulletinByPeriod}
            onChange={(bulletinByPeriod) => setData((d) => ({ ...d, bulletinByPeriod }))}
            period={period}
            onShiftPeriod={shiftPeriod}
          />
        )}
        {tab === 'parametres' && (
          <SettingsView settings={data.settings} onChange={(settings) => setData((d) => ({ ...d, settings }))} />
        )}
      </main>
    </div>
  )
}
