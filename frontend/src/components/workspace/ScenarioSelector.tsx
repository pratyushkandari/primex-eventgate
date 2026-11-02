import { SCENARIO_LIST, type ScenarioId } from '@/data/scenarios'
import { StatusBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface ScenarioSelectorProps {
  selectedScenario: ScenarioId | null
  onSelectScenario: (id: ScenarioId) => void
  disabled?: boolean
}

/** Shortcut buttons that load one of the sample OrderPlaced changes. */
export function ScenarioSelector({ selectedScenario, onSelectScenario, disabled = false }: ScenarioSelectorProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span id="samples-label" className="text-xs font-medium text-fg-subtle">
        Sample changes
      </span>
      <div role="group" aria-labelledby="samples-label" className="flex flex-wrap gap-2">
        {SCENARIO_LIST.map((s) => {
          const selected = selectedScenario === s.id
          return (
            <button
              key={s.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onSelectScenario(s.id)}
              title={s.description}
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-xs transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-accent bg-accent-tint text-fg'
                  : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg'
              )}
            >
              <StatusBadge value={s.compatibility} />{' '}
              <span>{s.action}</span>{' '}
              <span className="font-mono text-fg-subtle">
                v{s.currentVersion}→v{s.proposedVersion}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
