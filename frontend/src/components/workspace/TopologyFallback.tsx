import type { ConsumerImpact } from '@/lib/findings'

interface TopologyFallbackProps {
  eventLabel: string
  decision: string | null
  impacts: ConsumerImpact[]
  hasAnalysis: boolean
}

/**
 * Text version of the topology graph for screen readers. The graph itself is
 * hidden from assistive technology; keyboard users inspect consumers from the
 * Consumer impact panel, which has the same actions.
 */
export function TopologyFallback({ eventLabel, decision, impacts, hasAnalysis }: TopologyFallbackProps) {
  return (
    <div className="sr-only">
      <p>Producer: {eventLabel}.</p>
      <p>EventGate decision: {decision ?? 'not analyzed yet'}.</p>
      <ul aria-label="Downstream consumers">
        {impacts.map((impact) => {
          const finding = impact.findings.find((f) => f.status !== 'SAFE')
          return (
            <li key={impact.consumerId}>
              {impact.consumerId}: {hasAnalysis ? impact.status : 'not analyzed'}
              {finding && finding.field !== '*' ? `, field ${finding.field}` : ''}
              {finding ? `. ${finding.reason}` : ''}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
