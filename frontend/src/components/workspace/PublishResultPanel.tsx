import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { CopyButton } from '@/components/ui/CopyButton'
import type { PublishResponse } from '@/types/api'
import type { PublishFailure } from './useReviewSession'

interface PublishResultPanelProps {
  publishResult: PublishResponse | null
  publishError: PublishFailure | null
  /** Where events go, e.g. "EventBridge bus primex-eventgate-dev-bus" or "the local in-memory publisher". */
  destination: string
}

const FAILURE_HELP: Record<number, { title: string; hint: string }> = {
  400: {
    title: 'Publish request rejected',
    hint: 'The analysis no longer matches the selected change. Run the analysis again, then publish.',
  },
  409: {
    title: 'Publication prevented',
    hint: 'The gate decision is no longer ALLOW. Run the analysis again to see why.',
  },
  422: {
    title: 'Payload does not match the proposed contract',
    hint: 'Fix the payload so every required field is present with the declared type.',
  },
  503: {
    title: 'Event bus unavailable',
    hint: 'The decision was ALLOW but the event bus did not accept the event. The attempt is recorded in History; try again shortly.',
  },
}

function IdRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex min-w-0 items-center gap-2 py-1.5">
      <dt className="w-32 shrink-0 text-xs text-fg-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-xs text-fg" title={value}>
        {value}
      </dd>
      <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
    </div>
  )
}

export function PublishResultPanel({ publishResult, publishError, destination }: PublishResultPanelProps) {
  if (publishError) {
    const help = FAILURE_HELP[publishError.status] ?? {
      title: 'Publish failed',
      hint: publishError.status === 0 ? 'Check that the API is reachable, then try again.' : 'Try again.',
    }
    return (
      <section
        role="alert"
        className="flex gap-3 rounded-[var(--radius-card)] border border-danger-line bg-danger-tint/60 p-4"
      >
        <AlertCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-fg">
            {help.title}
            {publishError.status > 0 && <span className="ml-2 font-mono text-xs text-fg-subtle">HTTP {publishError.status}</span>}
          </p>
          <p className="mt-1 break-words text-fg-muted">{publishError.message}</p>
          <p className="mt-1 text-fg-subtle">{help.hint}</p>
        </div>
      </section>
    )
  }

  if (!publishResult) return null

  return (
    <section
      aria-label="Publish result"
      className="rounded-[var(--radius-card)] border border-success-line bg-success-tint/40 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-fg">
        <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
        Published to {destination}
      </p>
      <dl className="mt-2 divide-y divide-line/70">
        <IdRow label="Event ID" value={publishResult.eventId} />
        <IdRow label="Bus event ID" value={publishResult.eventBridgeEventId} />
        <IdRow label="Analysis ID" value={publishResult.analysis.analysisId} />
        <IdRow label="Request ID" value={publishResult.analysis.requestId} />
      </dl>
    </section>
  )
}
