/**
 * Schema diff and per-consumer findings for an analysis, side by side.
 * Selecting a field or consumer cross-highlights the other side.
 */
import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { AnalysisResponse } from '@/types/api'
import { SchemaDiff } from './SchemaDiff'

interface FindingsPanelProps {
  analysis: AnalysisResponse | null
  selectedField?: string | null
  onSelectField?: (field: string | null) => void
  selectedConsumerId?: string | null
  onSelectConsumer?: (consumerId: string) => void
}

export function FindingsPanel({
  analysis,
  selectedField = null,
  onSelectField,
  selectedConsumerId = null,
  onSelectConsumer,
}: FindingsPanelProps) {
  if (!analysis) return null
  const { changeSet, findings } = analysis

  return (
    <Card>
      <CardHeader
        title="Changes and findings"
        description={`${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} across ${new Set(findings.map((f) => f.consumerId)).size} consumers`}
      />
      <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium text-fg-subtle">Schema diff</h3>
          <SchemaDiff
            changeSet={changeSet}
            findings={findings}
            selectedField={selectedField}
            onSelectField={onSelectField}
          />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium text-fg-subtle">Findings by consumer</h3>
          <ul className="space-y-2">
            {findings.map((f) => {
              const highlighted =
                selectedConsumerId === f.consumerId || (selectedField !== null && selectedField === f.field)
              return (
                <li
                  key={`${f.consumerId}-${f.ruleId}-${f.field}`}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-3 py-2.5',
                    highlighted ? 'border-accent bg-accent-tint' : 'border-line'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={f.status} />
                    <button
                      type="button"
                      onClick={() => onSelectConsumer?.(f.consumerId)}
                      className="font-mono text-sm text-accent-fg underline-offset-2 hover:underline"
                    >
                      {f.consumerId}
                    </button>
                    {f.field !== '*' && <span className="font-mono text-sm text-fg-muted">{f.field}</span>}
                    <span className="ml-auto font-mono text-xs text-fg-subtle">{f.ruleId}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-fg-muted">{f.reason}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Card>
  )
}
