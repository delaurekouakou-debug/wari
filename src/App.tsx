import { useEffect, useState } from 'react'
import PlanningView from './components/PlanningView'
import SettingsView from './components/SettingsView'
import ReportsView from './components/ReportsView'
import ComparatifView from './components/ComparatifView'
import { loadData, saveData } from './lib/storage'
import type { AppData } from './lib/types'

type Tab = 'planning' | 'rapports' | 'comparatif' | 'parametres'

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [tab, setTab] = useState<Tab>('planning')

  useEffect(() => {
    saveData(data)
  }, [data])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Heures Supp — Côte d'Ivoire</h1>
          <nav className="flex gap-1 no-print">
            {(
              [
                ['planning', 'Planning'],
                ['rapports', 'Rapports'],
                ['comparatif', 'Comparatif'],
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
        {tab === 'planning' && (
          <PlanningView planning={data.planning} onChange={(planning) => setData((d) => ({ ...d, planning }))} />
        )}
        {tab === 'rapports' && <ReportsView planning={data.planning} settings={data.settings} />}
        {tab === 'comparatif' && (
          <ComparatifView
            planning={data.planning}
            settings={data.settings}
            paidByPeriod={data.paidByPeriod}
            onChange={(paidByPeriod) => setData((d) => ({ ...d, paidByPeriod }))}
          />
        )}
        {tab === 'parametres' && (
          <SettingsView settings={data.settings} onChange={(settings) => setData((d) => ({ ...d, settings }))} />
        )}
      </main>
    </div>
  )
}
