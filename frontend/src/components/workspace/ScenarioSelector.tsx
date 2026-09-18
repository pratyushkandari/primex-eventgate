import { DEMO_SCENARIOS, type DemoScenario } from '@/data/scenarios'
import { Badge } from '@/components/ui/Badge'
import { GitCompare } from 'lucide-react'

interface ScenarioSelectorProps {
  selectedScenario: DemoScenario['id']
  onSelectScenario: (scenario: DemoScenario) => void
  disabled?: boolean
}

export function ScenarioSelector({
  selectedScenario,
  onSelectScenario,
  disabled = false,
}: ScenarioSelectorProps) {
  return (
    <section className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 px-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
      <div className="flex items-center space-x-2">
        <GitCompare className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-200 uppercase font-mono tracking-wider">
            Try a change
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Pre-configured contract transitions
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {(Object.keys(DEMO_SCENARIOS) as Array<DemoScenario['id']>).map((key) => {
          const scenario = DEMO_SCENARIOS[key]
          const isSelected = selectedScenario === key

          const badgeVariant =
            key === 'safe' ? 'safe' : key === 'breaking' ? 'break' : 'risk'

          return (
            <button
              key={scenario.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectScenario(scenario)}
              className={`flex items-center space-x-2 px-2.5 py-1.5 rounded border text-xs transition-all cursor-pointer select-none font-mono ${
                isSelected
                  ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <Badge variant={badgeVariant} size="sm">
                {scenario.label}
              </Badge>
              <span className="text-[11px] text-slate-300 font-sans">
                {scenario.action}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {scenario.transition}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
