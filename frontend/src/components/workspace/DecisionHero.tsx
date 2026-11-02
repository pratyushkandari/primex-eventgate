import { AlertTriangle, CheckCircle2, OctagonX, Send } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/States'
import { cn, toneFor } from '@/lib/utils'
import type { AnalysisResponse, Decision } from '@/types/api'

interface DecisionHeroProps {
  analysis: AnalysisResponse | null
  isAnalyzing: boolean
  isPublishing: boolean
  hasJsonError?: boolean
  /** Where an ALLOWed event goes, e.g. "EventBridge bus primex-eventgate-dev-bus". */
  destination?: string
  onPublish: () => void
}

const HEADLINES: Record<Decision, string> = {
  ALLOW: 'Safe to publish',
  REVIEW: 'Held for review',
  BLOCK: 'Blocked',
}

const ICONS = { ALLOW: CheckCircle2, REVIEW: AlertTriangle, BLOCK: OctagonX }

const TONE_STYLES = {
  success: 'border-success-line bg-success-tint text-success',
  warning: 'border-warning-line bg-warning-tint text-warning',
  danger: 'border-danger-line bg-danger-tint text-danger',
  neutral: 'border-line bg-raised text-fg',
  accent: 'border-line bg-raised text-fg',
}

export function DecisionHero({
  analysis,
  isAnalyzing,
  isPublishing,
  hasJsonError = false,
  destination,
  onPublish,
}: DecisionHeroProps) {
  return (
    <Card className="flex h-full flex-col" aria-live="polite" aria-busy={isAnalyzing}>
      <CardHeader title="Release decision" description="Compatibility result and the policy outcome for this environment." />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {isAnalyzing ? (
          <div className="space-y-3" role="status" aria-label="Analyzing compatibility">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : !analysis ? (
          <div className="flex flex-1 flex-col justify-center rounded-[var(--radius-card)] border border-dashed border-line p-5 text-sm">
            <p className="font-medium text-fg">No analysis yet</p>
            <p className="mt-1 text-fg-subtle">
              {hasJsonError
                ? 'Fix the payload JSON, then run the analysis.'
                : 'Run "Analyze compatibility" to check this change against every registered consumer.'}
            </p>
          </div>
        ) : (
          <DecisionDetail analysis={analysis} />
        )}

        <div className="mt-auto">
          {analysis?.decision === 'ALLOW' ? (
            <>
              <Button
                variant="success"
                onClick={onPublish}
                disabled={hasJsonError || isPublishing}
                isLoading={isPublishing}
                className="w-full"
              >
                {!isPublishing && <Send className="h-4 w-4" aria-hidden="true" />}
                Publish event
              </Button>
              {destination && <p className="mt-1.5 text-center text-xs text-fg-subtle">Sends to {destination}</p>}
            </>
          ) : (
            <>
              <Button variant="secondary" disabled className="w-full">
                {analysis ? 'Publishing not allowed' : 'Publish event'}
              </Button>
              <p className="mt-1.5 text-center text-xs text-fg-subtle">
                {analysis
                  ? `The gate returns HTTP 409 for ${analysis.decision}; nothing reaches the event bus.`
                  : 'Publishing unlocks after an ALLOW decision.'}
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

function DecisionDetail({ analysis }: { analysis: AnalysisResponse }) {
  const tone = toneFor(analysis.decision)
  const Icon = ICONS[analysis.decision]
  const primary = analysis.findings.find((f) => f.status === 'BREAK') ?? analysis.findings.find((f) => f.status === 'RISK')

  return (
    <div className="space-y-3">
      <div className={cn('rounded-[var(--radius-card)] border p-4', TONE_STYLES[tone])}>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-lg font-semibold">{HEADLINES[analysis.decision]}</p>
          <StatusBadge value={analysis.decision} className="ml-auto" />
        </div>
        <p className="mt-2 text-sm text-fg">{analysis.summary}</p>
        {primary && (
          <p className="mt-2 text-sm text-fg-muted">
            <span className="font-mono text-fg">{primary.consumerId}</span>
            {primary.field !== '*' && (
              <>
                {' '}reads <span className="font-mono text-fg">{primary.field}</span>
                {primary.expectedType && primary.proposedType && (
                  <> ({primary.expectedType} → {primary.proposedType})</>
                )}
              </>
            )}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-[var(--radius-control)] border border-line p-3">
          <dt className="text-xs text-fg-subtle">Compatibility</dt>
          <dd className="mt-1 flex items-center gap-2">
            <StatusBadge value={analysis.compatibilityResult} />
            <span className="text-xs text-fg-subtle">severity {analysis.severity}</span>
          </dd>
        </div>
        <div className="rounded-[var(--radius-control)] border border-line p-3">
          <dt className="text-xs text-fg-subtle">Policy ({analysis.environment})</dt>
          <dd className="mt-1 flex items-center gap-2">
            <StatusBadge value={analysis.decision} />
            <span className="truncate text-xs text-fg-subtle" title={analysis.policyName}>
              {analysis.policyName}
            </span>
          </dd>
        </div>
      </dl>

      {analysis.policyReason && <p className="text-sm text-fg-muted">{analysis.policyReason}</p>}
      {analysis.warnings.map((w) => (
        <p
          key={w}
          className="rounded-[var(--radius-control)] border border-warning-line bg-warning-tint px-3 py-2 text-sm text-warning"
        >
          {w}
        </p>
      ))}
    </div>
  )
}
