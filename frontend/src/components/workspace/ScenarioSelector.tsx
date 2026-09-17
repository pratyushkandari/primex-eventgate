import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DEMO_SCENARIOS, type DemoScenario } from '@/data/scenarios'

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
    <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Interactive Demo Scenarios</h2>
          <p className="text-xs text-slate-400">
            Select a contract transition scenario to populate real repository inputs
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(DEMO_SCENARIOS) as Array<DemoScenario['id']>).map((key) => {
          const scenario = DEMO_SCENARIOS[key]
          const isSelected = selectedScenario === key
          return (
            <Button
              key={scenario.id}
              variant={isSelected ? 'primary' : 'outline'}
              size="sm"
              disabled={disabled}
              onClick={() => onSelectScenario(scenario)}
              className="text-xs font-mono"
            >
              {scenario.label}
            </Button>
          )
        })}
      </div>
    </section>
  )
}
