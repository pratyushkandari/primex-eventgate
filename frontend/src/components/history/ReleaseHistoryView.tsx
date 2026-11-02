/**
 * Release history: every analysis and publish attempt the gate recorded, with
 * filters, sorting, a record inspector and Markdown/JSON report downloads.
 */

import * as React from 'react'
import { ArrowDown, ArrowUp, Copy, Download, ExternalLink, RefreshCw, Search } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Label, Select } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { useToast } from '@/components/ui/toast-context'
import type { ChangeSelection } from '@/components/workspace/useReviewSession'
import { useMediaQuery } from '@/lib/route'
import { cn, downloadText, formatTimestamp } from '@/lib/utils'
import { describeError, eventGateApi } from '@/services/api'
import { useEventCatalog, useHistory } from '@/services/queries'
import { ENVIRONMENTS, type Decision, type ReleaseRecord, type ReportFormat } from '@/types/api'

interface ReleaseHistoryViewProps {
  onOpenReview?: (change: ChangeSelection) => void
}

type SortKey = 'timestamp' | 'decision'
const PAGE_SIZE = 25
const DECISION_ORDER: Record<Decision, number> = { BLOCK: 0, REVIEW: 1, ALLOW: 2 }

function outcome(record: ReleaseRecord): { label: string; tone: 'success' | 'danger' | 'neutral' } {
  if (record.published) return { label: 'Published', tone: 'success' }
  if (record.attemptedPublish) return { label: record.error?.startsWith('Publication failed') ? 'Publish failed' : 'Prevented', tone: 'danger' }
  return { label: 'Analyzed only', tone: 'neutral' }
}

function matchesSearch(r: ReleaseRecord, q: string) {
  if (!q) return true
  return [
    r.recordId,
    r.eventType,
    r.requestId,
    r.eventId,
    r.eventBridgeEventId,
    r.environment,
    r.decision,
    r.policyReason,
    ...r.affectedConsumers,
  ].some((v) => v?.toLowerCase().includes(q))
}

export function ReleaseHistoryView({ onOpenReview }: ReleaseHistoryViewProps) {
  const history = useHistory()
  const catalog = useEventCatalog()
  const [query, setQuery] = React.useState('')
  const [eventType, setEventType] = React.useState('')
  const [environment, setEnvironment] = React.useState('')
  const [decision, setDecision] = React.useState('')
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({ key: 'timestamp', desc: true })
  const [inspected, setInspected] = React.useState<ReleaseRecord | null>(null)
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  // Render one layout instead of hiding the other with CSS: long histories
  // otherwise double the DOM and dominate render time on phones.
  const wide = useMediaQuery('(min-width: 768px)')

  const records = React.useMemo(() => history.data ?? [], [history.data])
  const eventTypes = React.useMemo(
    () => [...new Set([...(catalog.data ?? []).map((c) => c.eventType), ...records.map((r) => r.eventType)])].sort(),
    [catalog.data, records]
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = records.filter(
      (r) =>
        (!eventType || r.eventType === eventType) &&
        (!environment || r.environment.toLowerCase() === environment) &&
        (!decision || r.decision === decision) &&
        matchesSearch(r, q)
    )
    const dir = sort.desc ? -1 : 1
    return rows.sort((a, b) =>
      sort.key === 'timestamp'
        ? dir * a.timestamp.localeCompare(b.timestamp)
        : dir * (DECISION_ORDER[b.decision] - DECISION_ORDER[a.decision]) || b.timestamp.localeCompare(a.timestamp)
    )
  }, [records, query, eventType, environment, decision, sort])

  const shown = filtered.slice(0, visibleCount)
  const hasFilters = Boolean(query.trim() || eventType || environment || decision)
  const clearFilters = () => {
    setQuery('')
    setEventType('')
    setEnvironment('')
    setDecision('')
  }

  const stats = {
    total: records.length,
    published: records.filter((r) => r.published).length,
    blocked: records.filter((r) => r.decision === 'BLOCK').length,
    review: records.filter((r) => r.decision === 'REVIEW').length,
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }))

  return (
    <div>
      <PageHeader
        title="Release history"
        description="Every analysis and publish attempt, newest first. Records are written by the API and by eventgate check --persist."
        actions={
          <Button variant="secondary" size="sm" onClick={() => history.refetch()} isLoading={history.isFetching}>
            {!history.isFetching && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            Refresh
          </Button>
        }
      />

      <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ['Recorded', stats.total, 'text-fg'],
            ['Published', stats.published, 'text-success'],
            ['Blocked', stats.blocked, 'text-danger'],
            ['Held for review', stats.review, 'text-warning'],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
            <dt className="text-xs text-fg-subtle">{label}</dt>
            <dd className={cn('mt-1 text-2xl font-semibold tabular-nums', color)}>{history.isPending ? '-' : value}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,11rem)_auto] lg:items-end">
        <div>
          <Label htmlFor="history-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <Input
              id="history-search"
              placeholder="ID, event, consumer or reason"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="history-event">Event type</Label>
          <Select id="history-event" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">All events</option>
            {eventTypes.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="history-env">Environment</Label>
          <Select id="history-env" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            <option value="">All environments</option>
            {ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="history-decision">Decision</Label>
          <Select id="history-decision" value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="">All decisions</option>
            <option value="ALLOW">ALLOW</option>
            <option value="REVIEW">REVIEW</option>
            <option value="BLOCK">BLOCK</option>
          </Select>
        </div>
        <Button variant="ghost" size="md" onClick={clearFilters} disabled={!hasFilters}>
          Clear filters
        </Button>
      </div>

      {history.isPending ? (
        <SkeletonRows rows={6} label="Loading release history" />
      ) : history.isError ? (
        <ErrorState
          title="Could not load release history"
          error={history.error}
          hint="Check that the API is reachable, then retry."
          onRetry={() => history.refetch()}
        />
      ) : records.length === 0 ? (
        <EmptyState title="No releases recorded yet">
          Analyze a change on the Review page; every analysis and publish attempt is recorded here.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No records match these filters"
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-fg-subtle" aria-live="polite">
            Showing {shown.length} of {filtered.length} matching records ({records.length} loaded)
          </p>
          {wide ? (
            <HistoryTable records={shown} sort={sort} onSort={toggleSort} onInspect={setInspected} />
          ) : (
            <HistoryCards records={shown} onInspect={setInspected} />
          )}
          {shown.length < filtered.length && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, filtered.length - shown.length)} more
            </Button>
          )}
        </>
      )}

      <RecordInspector record={inspected} onClose={() => setInspected(null)} onOpenReview={onOpenReview} />
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; desc: boolean }
  onSort: (key: SortKey) => void
}) {
  const active = sort.key === sortKey
  const Icon = sort.desc ? ArrowDown : ArrowUp
  return (
    <th scope="col" aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'} className="px-3 py-2 font-medium">
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-fg">
        {label}
        {active && <Icon className="h-3 w-3" aria-hidden="true" />}
      </button>
    </th>
  )
}

function HistoryTable({
  records,
  sort,
  onSort,
  onInspect,
}: {
  records: ReleaseRecord[]
  sort: { key: SortKey; desc: boolean }
  onSort: (key: SortKey) => void
  onInspect: (r: ReleaseRecord) => void
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Release history table"
      className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface"
    >
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">Release history records</caption>
        <thead className="border-b border-line text-xs text-fg-subtle">
          <tr>
            <SortHeader label="Time" sortKey="timestamp" sort={sort} onSort={onSort} />
            <th scope="col" className="px-3 py-2 font-medium">Change</th>
            <th scope="col" className="px-3 py-2 font-medium">Environment</th>
            <th scope="col" className="px-3 py-2 font-medium">Compatibility</th>
            <SortHeader label="Decision" sortKey="decision" sort={sort} onSort={onSort} />
            <th scope="col" className="px-3 py-2 font-medium">Affected consumers</th>
            <th scope="col" className="px-3 py-2 font-medium">Outcome</th>
            <th scope="col" className="px-3 py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const o = outcome(r)
            return (
              <tr key={r.recordId} className="border-b border-line/60 last:border-0 hover:bg-raised/50">
                <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">{formatTimestamp(r.timestamp)}</td>
                <td className="px-3 py-2.5">
                  <span className="text-fg">{r.eventType}</span>{' '}
                  <span className="font-mono text-fg-muted">
                    v{r.currentVersion}→v{r.proposedVersion}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-fg-muted">{r.environment}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge value={r.compatibilityResult} />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge value={r.decision} />
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-fg-muted">
                  {r.affectedConsumers.length ? r.affectedConsumers.join(', ') : <span className="font-sans text-fg-subtle">None</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={o.tone}>{o.label}</Badge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="secondary" size="sm" onClick={() => onInspect(r)}>
                    Inspect <span className="sr-only">record {r.recordId}</span>
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HistoryCards({ records, onInspect }: { records: ReleaseRecord[]; onInspect: (r: ReleaseRecord) => void }) {
  return (
    <ul className="space-y-2" aria-label="Release history records">
      {records.map((r) => {
        const o = outcome(r)
        return (
          <li key={r.recordId} className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-fg">{r.eventType}</span>
              <span className="font-mono text-sm text-fg-muted">
                v{r.currentVersion}→v{r.proposedVersion}
              </span>
              <StatusBadge value={r.decision} className="ml-auto" />
            </div>
            <p className="mt-1 text-xs text-fg-subtle">
              {r.environment} · {formatTimestamp(r.timestamp)} · {o.label}
            </p>
            {r.affectedConsumers.length > 0 && (
              <p className="mt-1 font-mono text-xs text-fg-muted">{r.affectedConsumers.join(', ')}</p>
            )}
            <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => onInspect(r)}>
              Inspect
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

function RecordInspector({
  record,
  onClose,
  onOpenReview,
}: {
  record: ReleaseRecord | null
  onClose: () => void
  onOpenReview?: (change: ChangeSelection) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = React.useState<null | 'copy' | ReportFormat>(null)

  const download = async (format: ReportFormat) => {
    if (!record) return
    setBusy(format)
    try {
      const report = await eventGateApi.getReport(record.recordId, format)
      const ext = format === 'json' ? 'json' : 'md'
      downloadText(
        `eventgate-${record.eventType}-v${record.proposedVersion}-${record.recordId.slice(0, 8)}.${ext}`,
        report.content,
        format === 'json' ? 'application/json' : 'text/markdown'
      )
      toast('Report downloaded', `Saved as .${ext}`, 'success')
    } catch (err) {
      toast('Could not download the report', describeError(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const copyMarkdown = async () => {
    if (!record) return
    setBusy('copy')
    try {
      const report = await eventGateApi.getReport(record.recordId, 'markdown')
      await navigator.clipboard.writeText(report.content)
      toast('Report copied', 'Markdown report copied to the clipboard.', 'success')
    } catch (err) {
      toast('Could not copy the report', describeError(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const ids: Array<[string, string | null | undefined]> = record
    ? [
        ['Record ID', record.recordId],
        ['Analysis ID', record.analysisId],
        ['Request ID', record.requestId],
        ['Event ID', record.eventId],
        ['Bus event ID', record.eventBridgeEventId],
      ]
    : []

  return (
    <Dialog
      open={record !== null}
      onClose={onClose}
      variant="drawer"
      title={record ? `${record.eventType} v${record.currentVersion} → v${record.proposedVersion}` : ''}
      description={record ? `${record.environment} · ${formatTimestamp(record.timestamp)}` : undefined}
      footer={
        record && (
          <>
            <Button variant="secondary" size="sm" onClick={copyMarkdown} isLoading={busy === 'copy'} disabled={busy !== null}>
              {busy !== 'copy' && <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              Copy Markdown
            </Button>
            <Button variant="secondary" size="sm" onClick={() => download('json')} isLoading={busy === 'json'} disabled={busy !== null}>
              {busy !== 'json' && <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={() => download('markdown')} isLoading={busy === 'markdown'} disabled={busy !== null}>
              {busy !== 'markdown' && <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              Markdown
            </Button>
            {onOpenReview && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenReview({
                    eventType: record.eventType,
                    currentVersion: record.currentVersion,
                    proposedVersion: record.proposedVersion,
                  })
                  onClose()
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open in Review
              </Button>
            )}
          </>
        )
      }
    >
      {record && (
        <div className="space-y-6 text-sm">
          <section className="flex flex-wrap items-center gap-2">
            <StatusBadge value={record.compatibilityResult} />
            <StatusBadge value={record.decision} />
            <Badge tone={outcome(record).tone}>{outcome(record).label}</Badge>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-medium text-fg-subtle">Policy</h3>
            <p className="text-fg">{record.policyName}</p>
            <p className="mt-1 text-fg-muted">{record.policyReason}</p>
            {record.error && <p className="mt-2 text-danger">{record.error}</p>}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-medium text-fg-subtle">Identifiers</h3>
            <dl className="divide-y divide-line/70">
              {ids
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label} className="flex items-center gap-2 py-1.5">
                    <dt className="w-28 shrink-0 text-xs text-fg-subtle">{label}</dt>
                    <dd className="min-w-0 flex-1 truncate font-mono text-xs text-fg" title={value ?? ''}>
                      {value}
                    </dd>
                    <CopyButton value={value as string} label={`Copy ${label.toLowerCase()}`} />
                  </div>
                ))}
              {record.publishedAt && (
                <div className="flex items-center gap-2 py-1.5">
                  <dt className="w-28 shrink-0 text-xs text-fg-subtle">Published at</dt>
                  <dd className="text-xs text-fg">{formatTimestamp(record.publishedAt)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium text-fg-subtle">Findings ({record.findingsSummary.length})</h3>
            {record.findingsSummary.length === 0 ? (
              <p className="text-fg-subtle">No consumers were registered for this event.</p>
            ) : (
              <ul className="space-y-2">
                {record.findingsSummary.map((f) => (
                  <li key={`${f.consumerId}-${f.ruleId}-${f.field}`} className="rounded-[var(--radius-control)] border border-line p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={f.status} />
                      <span className="font-mono text-fg">{f.consumerId}</span>
                      {f.field !== '*' && <span className="font-mono text-fg-muted">{f.field}</span>}
                    </div>
                    <p className="mt-1 text-fg-muted">{f.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Dialog>
  )
}
