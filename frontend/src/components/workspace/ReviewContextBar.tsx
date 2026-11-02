import { FileText } from 'lucide-react'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { countByStatus, type ConsumerImpact } from '@/lib/findings'
import type { AnalysisResponse } from '@/types/api'

interface ReviewContextBarProps {
  analysis: AnalysisResponse
  impacts: ConsumerImpact[]
  onSelectConsumer: (consumerId: string) => void
  onExportReport: () => void
}

/** One-line summary of the analyzed change with a per-consumer status bar. */
export function ReviewContextBar({ analysis, impacts, onSelectConsumer, onExportReport }: ReviewContextBarProps) {
  const counts = countByStatus(impacts)
  const total = Math.max(counts.total, 1)
  const firstAffected = impacts.find((i) => i.status !== 'SAFE')

  return (
    <section
      aria-label="Review summary"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 lg:flex-row lg:items-center"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-fg">{analysis.eventType}</span>
        <span className="font-mono text-fg-muted">
          v{analysis.currentVersion} → v{analysis.proposedVersion}
        </span>
        <Badge>{analysis.environment}</Badge>
        <StatusBadge value={analysis.decision} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:px-4">
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-raised"
          role="img"
          aria-label={`${counts.safe} safe, ${counts.risk} at risk, ${counts.break} broken`}
        >
          <div className="bg-success" style={{ width: `${(counts.safe / total) * 100}%` }} />
          <div className="bg-warning" style={{ width: `${(counts.risk / total) * 100}%` }} />
          <div className="bg-danger" style={{ width: `${(counts.break / total) * 100}%` }} />
        </div>
        <p className="text-xs text-fg-subtle">
          {counts.safe} safe · {counts.risk} at risk · {counts.break} broken
          {firstAffected && (
            <>
              {' · first affected: '}
              <button
                type="button"
                onClick={() => onSelectConsumer(firstAffected.consumerId)}
                className="font-mono text-accent-fg underline-offset-2 hover:underline"
              >
                {firstAffected.consumerId}
              </button>
            </>
          )}
        </p>
      </div>

      <Button variant="secondary" size="sm" onClick={onExportReport}>
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Export report
      </Button>
    </section>
  )
}
