import { useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { cn } from '@/lib/utils'
import { useEventCatalog, useEventDetail } from '@/services/queries'
import type { ChangeSelection } from '@/components/workspace/useReviewSession'

interface ContractRegistryViewProps {
  selectedEventType: string | null
  onSelectEventType: (eventType: string) => void
  onOpenReview: (change: ChangeSelection) => void
}

export function ContractRegistryView({ selectedEventType, onSelectEventType, onOpenReview }: ContractRegistryViewProps) {
  const catalog = useEventCatalog()
  const [query, setQuery] = useState('')
  const [pickedVersion, setPickedVersion] = useState<number | null>(null)

  const events = catalog.data ?? []
  const activeEvent = selectedEventType ?? events[0]?.eventType ?? null
  const detail = useEventDetail(activeEvent)
  const filtered = events.filter((e) => e.eventType.toLowerCase().includes(query.trim().toLowerCase()))

  if (catalog.isPending) return <SkeletonRows label="Loading event contracts" />
  if (catalog.isError) {
    return <ErrorState title="Could not load event contracts" error={catalog.error} onRetry={() => catalog.refetch()} />
  }
  if (events.length === 0) {
    return (
      <EmptyState title="No event contracts registered">
        Add files under contracts/events/ (local) or run scripts/seed_dynamodb.py (AWS).
      </EmptyState>
    )
  }

  const versions = detail.data?.versions ?? []
  const version = pickedVersion !== null && versions.includes(pickedVersion) ? pickedVersion : detail.data?.latestVersion
  const contract = detail.data?.contracts.find((c) => c.version === version)
  const previous = versions.filter((v) => v < (version ?? 0)).at(-1)
  const usage = (field: string) =>
    detail.data?.consumers.filter((c) => field in c.expectedFields).map((c) => c.consumerId) ?? []

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <Input
            aria-label="Filter event types"
            placeholder="Filter event types"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title={`No event types match "${query}"`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                Clear filter
              </Button>
            }
          />
        ) : (
          <ul aria-label="Event types" className="space-y-1">
            {filtered.map((e) => {
              const selected = e.eventType === activeEvent
              return (
                <li key={e.eventType}>
                  <button
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => {
                      onSelectEventType(e.eventType)
                      setPickedVersion(null)
                    }}
                    className={cn(
                      'w-full rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors duration-150',
                      selected ? 'border-accent bg-accent-tint' : 'border-transparent hover:border-line hover:bg-surface'
                    )}
                  >
                    <p className="text-sm font-medium text-fg">{e.eventType}</p>{' '}
                    <p className="text-xs text-fg-subtle">
                      {e.versionCount} versions · latest v{e.latestVersion} · {e.consumerCount}{' '}
                      {e.consumerCount === 1 ? 'consumer' : 'consumers'}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Card>
        {detail.isPending ? (
          <div className="p-4">
            <SkeletonRows label="Loading contract" />
          </div>
        ) : detail.isError ? (
          <div className="p-4">
            <ErrorState title={`Could not load ${activeEvent}`} error={detail.error} onRetry={() => detail.refetch()} />
          </div>
        ) : (
          <>
            <CardHeader
              title={activeEvent}
              description={`${versions.length} versions · ${detail.data.consumers.length} subscribed consumers`}
              actions={
                previous !== undefined &&
                version !== undefined && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onOpenReview({ eventType: activeEvent as string, currentVersion: previous, proposedVersion: version })
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Review v{previous} → v{version}
                  </Button>
                )
              }
            />
            <div className="space-y-5 p-4">
              <div role="group" aria-label="Contract version" className="flex flex-wrap gap-1.5">
                {versions.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={v === version}
                    onClick={() => setPickedVersion(v)}
                    className={cn(
                      'rounded-[var(--radius-control)] border px-2.5 py-1 font-mono text-xs transition-colors duration-150',
                      v === version ? 'border-accent bg-accent-tint text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                    )}
                  >
                    v{v}
                    {v === detail.data.latestVersion && <span className="ml-1 font-sans text-fg-subtle"> latest</span>}
                  </button>
                ))}
              </div>

              {contract && (
                <div tabIndex={0} role="region" aria-label="Contract fields" className="relative overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <caption className="sr-only">Fields of {activeEvent} v{version}</caption>
                    <thead>
                      <tr className="border-b border-line text-xs text-fg-subtle">
                        <th scope="col" className="py-2 pr-4 font-medium">Field</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Type</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Required</th>
                        <th scope="col" className="py-2 font-medium">Read by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(contract.fields).map((field) => {
                        const readers = usage(field.name)
                        return (
                          <tr key={field.name} className="border-b border-line/60">
                            <td className="py-2 pr-4 font-mono text-fg">{field.name}</td>
                            <td className="py-2 pr-4 font-mono text-fg-muted">{field.type}</td>
                            <td className="py-2 pr-4 text-fg-muted">{field.required ? 'Yes' : 'No'}</td>
                            <td className="py-2 text-fg-muted">
                              {readers.length === 0 ? (
                                <span className="text-fg-subtle">No consumers</span>
                              ) : (
                                <span className="font-mono text-xs">{readers.join(', ')}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-medium text-fg-subtle">Subscribed consumers</h3>
                {detail.data.consumers.length === 0 ? (
                  <p className="text-sm text-fg-subtle">No consumers subscribe to this event.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {detail.data.consumers.map((c) => (
                      <li key={c.consumerId}>
                        <Badge>
                          <span className="font-mono">{c.consumerId}</span>
                          <span className="text-fg-subtle">· {Object.keys(c.expectedFields).length} fields</span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
