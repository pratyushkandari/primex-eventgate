/**
 * Review page: choose a contract change and payload, analyze it against every
 * registered consumer, inspect the findings, and publish when the gate allows it.
 */

import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { StatusBadge } from '@/components/ui/Badge'
import { ErrorState, Spinner } from '@/components/ui/States'
import { useToast } from '@/components/ui/toast-context'
import { consumerImpacts } from '@/lib/findings'
import { formatTimestamp } from '@/lib/utils'
import { useEventCatalog } from '@/services/queries'
import type { Environment } from '@/types/api'
import { ConsumerDrawer } from './ConsumerDrawer'
import { ConsumerImpactPanel } from './ConsumerImpactPanel'
import { DecisionHero } from './DecisionHero'
import { EventInputPanel } from './EventInputPanel'
import { EventPath } from './EventPath'
import { FindingsPanel } from './FindingsPanel'
import { PublishResultPanel } from './PublishResultPanel'
import { ReportExportModal } from './ReportExportModal'
import { ReviewContextBar } from './ReviewContextBar'
import { ScenarioSelector } from './ScenarioSelector'
import type { ReviewSession } from './useReviewSession'

const DependencyTopology = React.lazy(() =>
  import('./DependencyTopology').then((m) => ({ default: m.DependencyTopology }))
)

interface ReviewWorkspaceProps {
  session: ReviewSession
  environment: Environment
  publisherBackendType?: string
  eventBridgeBus: string | null
  onAnalyze: () => void | Promise<void>
}

export function ReviewWorkspace({
  session,
  environment,
  publisherBackendType,
  eventBridgeBus,
  onAnalyze,
}: ReviewWorkspaceProps) {
  const toast = useToast()
  const catalog = useEventCatalog()
  const [exportOpen, setExportOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const { selection, analysis, eventDetail } = session
  const subscribers = React.useMemo(() => eventDetail?.consumers ?? [], [eventDetail])
  const impacts = React.useMemo(
    () => consumerImpacts(subscribers.map((c) => c.consumerId), analysis?.findings ?? []),
    [subscribers, analysis]
  )
  const selectedImpact = impacts.find((i) => i.consumerId === session.selectedConsumerId) ?? null

  const destination =
    publisherBackendType === 'eventbridge' && eventBridgeBus
      ? `EventBridge bus ${eventBridgeBus}`
      : publisherBackendType === 'local'
        ? 'the local in-memory publisher'
        : 'the event bus'
  const busLabel =
    publisherBackendType === 'local' ? 'in-memory publisher' : eventBridgeBus ?? 'EventBridge'

  const doPublish = async () => {
    setConfirmOpen(false)
    const result = await session.publish()
    if (result?.published) toast('Event published', `Event ID ${result.eventId}`, 'success')
  }

  const requestPublish = () => {
    if (environment === 'production') setConfirmOpen(true)
    else void doPublish()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Review a contract change</h1>
          <p className="text-sm text-fg-subtle">
            Checks the proposed version against every consumer of {selection.eventType} and applies the{' '}
            {environment} release policy.
          </p>
        </div>
        <ScenarioSelector
          selectedScenario={session.scenarioId}
          onSelectScenario={session.selectScenario}
          disabled={session.isAnalyzing || session.isPublishing}
        />
      </div>

      {catalog.isError && (
        <ErrorState
          title="Could not load the event catalog"
          error={catalog.error}
          hint="The selected sample change can still be analyzed if the API is reachable."
          onRetry={() => catalog.refetch()}
        />
      )}
      {session.analysisError && (
        <ErrorState
          title="Analysis failed"
          error={new Error(session.analysisError)}
          hint="Check that the selected versions exist and the API is reachable, then try again."
          onRetry={() => void onAnalyze()}
        />
      )}

      {analysis && (
        <ReviewContextBar
          analysis={analysis}
          impacts={impacts}
          onSelectConsumer={session.selectConsumer}
          onExportReport={() => setExportOpen(true)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <EventInputPanel
          selection={selection}
          catalog={catalog.data ?? []}
          versions={eventDetail?.versions ?? []}
          payloadText={session.payloadText}
          jsonError={session.jsonError}
          isAnalyzing={session.isAnalyzing}
          onSelectionChange={session.openChange}
          onPayloadTextChange={session.editPayload}
          onFormatPayload={session.formatPayload}
          onResetPayload={session.resetPayload}
          onAnalyze={() => void onAnalyze()}
        />
        <DecisionHero
          analysis={analysis}
          isAnalyzing={session.isAnalyzing}
          isPublishing={session.isPublishing}
          hasJsonError={Boolean(session.jsonError)}
          destination={destination}
          onPublish={requestPublish}
        />
        <div className="md:col-span-2 xl:col-span-1">
          {session.eventDetailQuery.isPending ? (
            <Spinner label="Loading consumers" className="rounded-[var(--radius-card)] border border-line p-4" />
          ) : (
            <ConsumerImpactPanel
              impacts={impacts}
              hasAnalysis={Boolean(analysis)}
              selectedConsumerId={session.selectedConsumerId}
              selectedField={session.selectedField}
              onSelectConsumer={session.selectConsumer}
            />
          )}
        </div>
      </div>

      <PublishResultPanel
        publishResult={session.publishResult}
        publishError={session.publishError}
        destination={destination}
      />

      <FindingsPanel
        analysis={analysis}
        selectedField={session.selectedField}
        onSelectField={session.selectField}
        selectedConsumerId={session.selectedConsumerId}
        onSelectConsumer={session.selectConsumer}
      />

      <div className="hidden md:block">
        <React.Suspense fallback={<Spinner label="Loading dependency graph" className="p-4" />}>
          <DependencyTopology
            eventType={selection.eventType}
            currentVersion={selection.currentVersion}
            proposedVersion={selection.proposedVersion}
            decision={analysis?.decision ?? null}
            impacts={impacts}
            hasAnalysis={Boolean(analysis)}
            selectedConsumerId={session.selectedConsumerId}
            onSelectConsumer={session.selectConsumer}
          />
        </React.Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EventPath
          decision={analysis?.decision ?? null}
          isPublished={Boolean(session.publishResult?.published)}
          busLabel={busLabel}
          consumerCount={subscribers.length}
        />
        {session.recent.length > 0 && (
          <section aria-label="Recent reviews" className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Recent reviews</h2>
            <p className="text-xs text-fg-subtle">This browser tab only. Release history keeps every analysis.</p>
            <ul className="mt-3 divide-y divide-line">
              {session.recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <span className="text-fg">{r.eventType}</span>
                  <span className="font-mono text-fg-muted">
                    v{r.currentVersion} → v{r.proposedVersion}
                  </span>
                  <span className="text-fg-subtle">{r.environment}</span>
                  <StatusBadge value={r.decision} />
                  <span className="ml-auto text-xs text-fg-subtle">{formatTimestamp(r.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ConsumerDrawer
        impact={selectedImpact}
        contract={subscribers.find((c) => c.consumerId === session.selectedConsumerId)}
        hasAnalysis={Boolean(analysis)}
        onClose={() => session.selectConsumer(null)}
      />
      <ReportExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} analysis={analysis} />
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Publish to production?"
        description={`The event is sent to ${destination} and delivered to ${subscribers.length} subscribed consumers. This cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={() => void doPublish()}>
              Publish event
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          {selection.eventType} v{selection.currentVersion} → v{selection.proposedVersion}, decision ALLOW.
        </p>
      </Dialog>
    </div>
  )
}
