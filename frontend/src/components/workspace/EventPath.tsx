import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Decision } from '@/types/api'

interface EventPathProps {
  decision: Decision | null
  isPublished: boolean
  /** Name of the event bus, or "in-memory publisher" when running locally. */
  busLabel: string
  consumerCount: number
}

type StepState = 'idle' | 'passed' | 'stopped' | 'skipped'

const STATE_STYLES: Record<StepState, string> = {
  idle: 'border-line text-fg-muted',
  passed: 'border-success-line bg-success-tint/40 text-fg',
  stopped: 'border-danger-line bg-danger-tint/40 text-fg',
  skipped: 'border-line border-dashed text-fg-subtle',
}

function Step({ title, detail, state }: { title: string; detail: string; state: StepState }) {
  return (
    <li className={cn('flex-1 rounded-[var(--radius-control)] border px-3 py-2', STATE_STYLES[state])}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-fg-subtle">{detail}</p>
    </li>
  )
}

/** Where the event got to: producer → gate → bus → consumers. */
export function EventPath({ decision, isPublished, busLabel, consumerCount }: EventPathProps) {
  const gate: StepState = !decision ? 'idle' : decision === 'ALLOW' ? 'passed' : 'stopped'
  const downstream: StepState = isPublished ? 'passed' : decision && decision !== 'ALLOW' ? 'skipped' : 'idle'
  const gateDetail = !decision
    ? 'Waiting for analysis'
    : decision === 'ALLOW'
      ? 'Decision ALLOW'
      : `Decision ${decision}: stopped here (HTTP 409)`

  return (
    <section aria-label="Event path" className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-fg">Event path</h2>
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <Step title="Producer" detail="POST /api/v1/events/publish" state={decision ? 'passed' : 'idle'} />
        <ArrowRight className="hidden h-4 w-4 self-center text-fg-subtle md:block" aria-hidden="true" />
        <Step title="EventGate" detail={gateDetail} state={gate} />
        <ArrowRight className="hidden h-4 w-4 self-center text-fg-subtle md:block" aria-hidden="true" />
        <Step
          title="Event bus"
          detail={isPublished ? `Accepted by ${busLabel}` : downstream === 'skipped' ? 'Not called' : busLabel}
          state={downstream}
        />
        <ArrowRight className="hidden h-4 w-4 self-center text-fg-subtle md:block" aria-hidden="true" />
        <Step
          title="Consumers"
          detail={
            isPublished
              ? `Delivered to ${consumerCount} subscribed ${consumerCount === 1 ? 'consumer' : 'consumers'}`
              : downstream === 'skipped'
                ? 'Not reached'
                : `${consumerCount} subscribed`
          }
          state={downstream}
        />
      </ol>
    </section>
  )
}
