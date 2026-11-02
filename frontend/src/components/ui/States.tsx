import * as React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center gap-2 text-sm text-fg-subtle', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded bg-raised', className)} />
}

/** Placeholder rows shown while a list or table loads. */
export function SkeletonRows({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center',
        className
      )}
    >
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="max-w-md text-sm text-fg-subtle">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Error panel that says what failed, why, and offers a retry. */
export function ErrorState({
  title,
  error,
  hint,
  onRetry,
  className,
}: {
  title: string
  error?: unknown
  hint?: string
  onRetry?: () => void
  className?: string
}) {
  const message = error instanceof Error ? error.message : undefined
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-card)] border border-danger-line bg-danger-tint/60 p-4 sm:flex-row sm:items-start',
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-fg">{title}</p>
        {message && <p className="mt-1 break-words text-fg-muted">{message}</p>}
        {hint && <p className="mt-1 text-fg-subtle">{hint}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
