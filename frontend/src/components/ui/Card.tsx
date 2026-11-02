import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-[var(--radius-card)] border border-line bg-surface', className)}
      {...props}
    />
  )
}

interface CardHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  /** Heading level for the title; defaults to h2. */
  as?: 'h2' | 'h3'
}

export function CardHeader({ title, description, icon, actions, className, as = 'h2' }: CardHeaderProps) {
  const Heading = as
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3',
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-fg-subtle" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          <Heading className="text-sm font-semibold text-fg">{title}</Heading>
          {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}
