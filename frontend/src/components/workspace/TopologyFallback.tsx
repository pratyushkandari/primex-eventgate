/**
 * TopologyFallback — Accessible semantic representation of the dependency topology.
 * Hidden from visual users, visible to screen readers.
 */

import type { AnalysisResponse, ConsumerStatus } from '@/types/api'

interface TopologyFallbackProps {
  analysis: AnalysisResponse | null
  consumers: Array<{ id: string; name: string }>
  onSelectConsumer?: (consumerId: string) => void
}

export function TopologyFallback({ analysis, consumers, onSelectConsumer }: TopologyFallbackProps) {
  const getStatus = (consumerId: string): ConsumerStatus => {
    if (!analysis) return 'SAFE'
    const finding = analysis.findings.find((f) => f.consumerId === consumerId)
    return finding ? finding.status : 'SAFE'
  }

  return (
    <div className="sr-only" aria-label="Dependency topology accessible representation">
      <div role="list" aria-label="Event processing topology">
        <div role="listitem">
          Producer: {analysis?.eventType || 'OrderPlaced'} v{analysis?.currentVersion ?? 1} →
          v{analysis?.proposedVersion ?? 2}
        </div>
        <div role="listitem">
          EventGate Release Gate — Decision:{' '}
          {analysis?.decision || 'Awaiting analysis'}
        </div>
        <div role="list" aria-label="Downstream consumers">
          {consumers.map((c) => {
            const status = getStatus(c.id)
            const finding = analysis?.findings.find((f) => f.consumerId === c.id)
            return (
              <div key={c.id} role="listitem">
                <button
                  type="button"
                  onClick={() => onSelectConsumer?.(c.id)}
                >
                  {c.name} ({c.id}): {status}
                  {finding && finding.field !== '*' && ` — field: ${finding.field}`}
                  {finding?.reason && ` — ${finding.reason}`}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
