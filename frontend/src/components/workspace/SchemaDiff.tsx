/**
 * Field-level diff between the current and proposed contract, one row per
 * change. Selecting a row highlights the consumers that read that field.
 */
import { EmptyState } from '@/components/ui/States'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { ChangeSet, ConsumerFinding } from '@/types/api'

interface SchemaDiffProps {
  changeSet: ChangeSet
  findings?: ConsumerFinding[]
  selectedField?: string | null
  onSelectField?: (field: string | null) => void
}

interface DiffRow {
  field: string
  kind: 'added' | 'removed' | 'type' | 'requiredness'
  detail: string
}

const MARKERS = { added: '+', removed: '−', type: '~', requiredness: '~' }
const MARKER_COLORS = {
  added: 'text-success',
  removed: 'text-danger',
  type: 'text-warning',
  requiredness: 'text-warning',
}

function rowsFor(changeSet: ChangeSet): DiffRow[] {
  return [
    ...changeSet.addedFields.map((field) => ({ field, kind: 'added' as const, detail: 'added' })),
    ...changeSet.removedFields.map((field) => ({ field, kind: 'removed' as const, detail: 'removed' })),
    ...changeSet.typeChanges.map((tc) => ({
      field: tc.field,
      kind: 'type' as const,
      detail: `${tc.fromType} → ${tc.toType}`,
    })),
    ...changeSet.requirednessChanges.map((rc) => ({
      field: rc.field,
      kind: 'requiredness' as const,
      detail: `${rc.fromRequired ? 'required' : 'optional'} → ${rc.toRequired ? 'required' : 'optional'}`,
    })),
  ]
}

export function SchemaDiff({ changeSet, findings = [], selectedField = null, onSelectField }: SchemaDiffProps) {
  const rows = rowsFor(changeSet)
  if (rows.length === 0) {
    return <EmptyState title="No schema changes">The two versions declare identical fields.</EmptyState>
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-control)] border border-line font-mono text-sm">
      {rows.map((row) => {
        const affected = findings.filter((f) => f.field === row.field && f.status !== 'SAFE')
        const selected = selectedField === row.field
        return (
          <li key={`${row.kind}-${row.field}`}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectField?.(selected ? null : row.field)}
              className={cn(
                'flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left transition-colors duration-150',
                selected ? 'bg-accent-tint' : 'hover:bg-raised'
              )}
            >
              <span className={cn('w-3 text-center font-bold', MARKER_COLORS[row.kind])} aria-hidden="true">
                {MARKERS[row.kind]}
              </span>
              <span className={cn('text-fg', row.kind === 'removed' && 'line-through decoration-danger/60')}>
                {row.field}
              </span>{' '}
              <span className="font-sans text-xs text-fg-subtle">{row.detail}</span>
              {affected.length > 0 && (
                <Badge tone={affected.some((f) => f.status === 'BREAK') ? 'danger' : 'warning'} className="ml-auto font-sans">
                  affects {affected.map((f) => f.consumerId).join(', ')}
                </Badge>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
