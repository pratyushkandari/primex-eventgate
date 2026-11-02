import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/utils'
import { countByStatus, type ConsumerImpact } from '@/lib/findings'

type Filter = 'ALL' | 'AFFECTED' | 'SAFE'

interface ConsumerImpactPanelProps {
  impacts: ConsumerImpact[]
  hasAnalysis: boolean
  selectedConsumerId?: string | null
  selectedField?: string | null
  onSelectConsumer: (id: string) => void
}

export function ConsumerImpactPanel({
  impacts,
  hasAnalysis,
  selectedConsumerId = null,
  selectedField = null,
  onSelectConsumer,
}: ConsumerImpactPanelProps) {
  const [filter, setFilter] = React.useState<Filter>('ALL')
  const counts = countByStatus(impacts)
  const visible = impacts.filter((i) =>
    filter === 'ALL' ? true : filter === 'SAFE' ? i.status === 'SAFE' : i.status !== 'SAFE'
  )

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Consumer impact"
        description={
          hasAnalysis
            ? `${counts.break + counts.risk} of ${counts.total} consumers affected`
            : `${counts.total} registered consumers`
        }
        actions={
          <Segmented
            label="Filter consumers"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: `All ${counts.total}` },
              { value: 'AFFECTED', label: `Affected ${counts.break + counts.risk}` },
              { value: 'SAFE', label: `Safe ${counts.safe}` },
            ]}
          />
        }
      />
      <div className="flex-1 p-3">
        {impacts.length === 0 ? (
          <EmptyState title="No registered consumers">
            Nothing subscribes to this event, so compatibility cannot be confirmed and the policy returns
            REVIEW.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="No consumers match this filter" />
        ) : (
          <ul className="space-y-2">
            {visible.map((impact) => {
              const worst = impact.findings.find((f) => f.status !== 'SAFE')
              const matchesField = Boolean(selectedField && impact.findings.some((f) => f.field === selectedField))
              return (
                <li key={impact.consumerId}>
                  <button
                    type="button"
                    onClick={() => onSelectConsumer(impact.consumerId)}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors duration-150',
                      selectedConsumerId === impact.consumerId
                        ? 'border-accent bg-accent-tint'
                        : matchesField
                          ? 'border-warning-line bg-warning-tint/50'
                          : 'border-line hover:border-line-strong hover:bg-raised'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm text-fg">{impact.consumerId}</span>{' '}
                        {hasAnalysis && <StatusBadge value={impact.status} />}
                      </div>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        {!hasAnalysis
                          ? 'Not analyzed yet'
                          : worst
                            ? worst.field === '*'
                              ? worst.reason
                              : `${worst.field}: ${worst.ruleId.split('_').slice(1).join(' ').toLowerCase()}`
                            : 'Not affected by this change'}
                      </p>
                    </div>
                    <ChevronRight
                      className="mt-1 h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
