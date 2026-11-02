import { useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States'
import { cn } from '@/lib/utils'
import { useConsumerDetail, useConsumers } from '@/services/queries'

interface ConsumerExplorerViewProps {
  onSelectEvent?: (eventType: string) => void
}

export function ConsumerExplorerView({ onSelectEvent }: ConsumerExplorerViewProps) {
  const consumers = useConsumers()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

  const list = consumers.data ?? []
  const selectedId = picked ?? list[0]?.consumerId ?? null
  const detail = useConsumerDetail(selectedId)
  const filtered = list.filter((c) => c.consumerId.toLowerCase().includes(query.trim().toLowerCase()))

  if (consumers.isPending) return <SkeletonRows label="Loading consumer contracts" />
  if (consumers.isError) {
    return <ErrorState title="Could not load consumer contracts" error={consumers.error} onRetry={() => consumers.refetch()} />
  }
  if (list.length === 0) {
    return (
      <EmptyState title="No consumer contracts registered">
        Add files under contracts/consumers/ (local) or run scripts/seed_dynamodb.py (AWS).
      </EmptyState>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <Input
            aria-label="Filter consumers"
            placeholder="Filter consumers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title={`No consumers match "${query}"`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                Clear filter
              </Button>
            }
          />
        ) : (
          <ul aria-label="Consumers" className="space-y-1">
            {filtered.map((c) => {
              const selected = c.consumerId === selectedId
              return (
                <li key={c.consumerId}>
                  <button
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => setPicked(c.consumerId)}
                    className={cn(
                      'w-full rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors duration-150',
                      selected ? 'border-accent bg-accent-tint' : 'border-transparent hover:border-line hover:bg-surface'
                    )}
                  >
                    <p className="font-mono text-sm text-fg">{c.consumerId}</p>{' '}
                    <p className="text-xs text-fg-subtle">
                      {c.eventType} · {c.expectedFieldsCount} fields
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
            <SkeletonRows label="Loading consumer" />
          </div>
        ) : detail.isError ? (
          <div className="p-4">
            <ErrorState title={`Could not load ${selectedId}`} error={detail.error} onRetry={() => detail.refetch()} />
          </div>
        ) : (
          <>
            <CardHeader
              title={<span className="font-mono">{detail.data.consumerId}</span>}
              description={`Reads ${detail.data.eventType}. Changes to fields it does not read never affect it.`}
              actions={
                onSelectEvent && (
                  <Button variant="secondary" size="sm" onClick={() => onSelectEvent(detail.data.eventType)}>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    View {detail.data.eventType}
                  </Button>
                )
              }
            />
            <div tabIndex={0} role="region" aria-label="Expected fields" className="relative overflow-x-auto p-4">
              <table className="w-full min-w-[24rem] text-left text-sm">
                <caption className="sr-only">Fields expected by {detail.data.consumerId}</caption>
                <thead>
                  <tr className="border-b border-line text-xs text-fg-subtle">
                    <th scope="col" className="py-2 pr-4 font-medium">Field</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Expected type</th>
                    <th scope="col" className="py-2 font-medium">Required by consumer</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(detail.data.expectedFields).map((field) => (
                    <tr key={field.name} className="border-b border-line/60">
                      <td className="py-2 pr-4 font-mono text-fg">{field.name}</td>
                      <td className="py-2 pr-4 font-mono text-fg-muted">{field.type}</td>
                      <td className="py-2 text-fg-muted">{field.required ? 'Yes' : 'No (optional)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
