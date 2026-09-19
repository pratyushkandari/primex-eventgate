/**
 * ContractsHub — Main hub for Contract Registry and Downstream Consumer Explorer.
 */

import { useState } from 'react'
import { Database, Users } from 'lucide-react'
import { ContractRegistryView } from './ContractRegistryView'
import { ConsumerExplorerView } from './ConsumerExplorerView'

interface ContractsHubProps {
  onOpenReviewScenario?: (eventType: string, currentVer: number, proposedVer: number) => void
}

export function ContractsHub({ onOpenReviewScenario }: ContractsHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<'events' | 'consumers'>('events')

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveSubTab('events')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeSubTab === 'events'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          Event Contracts
        </button>

        <button
          onClick={() => setActiveSubTab('consumers')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeSubTab === 'consumers'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          Consumer Explorer
        </button>
      </div>

      {activeSubTab === 'events' ? (
        <ContractRegistryView onOpenReviewScenario={onOpenReviewScenario} />
      ) : (
        <ConsumerExplorerView
          onSelectEvent={() => {
            setActiveSubTab('events')
          }}
        />
      )}
    </div>
  )
}
