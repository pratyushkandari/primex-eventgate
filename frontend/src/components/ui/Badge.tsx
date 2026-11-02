import * as React from 'react'
import { cn, toneFor, type Tone } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

const TONES: Record<Tone, string> = {
  neutral: 'bg-raised text-fg-muted border-line',
  accent: 'bg-accent-tint text-accent-fg border-accent-strong/40',
  success: 'bg-success-tint text-success border-success-line',
  warning: 'bg-warning-tint text-warning border-warning-line',
  danger: 'bg-danger-tint text-danger border-danger-line',
}

export function Badge({ className, tone = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium leading-4 border whitespace-nowrap',
        TONES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/** Badge colored by an ALLOW/REVIEW/BLOCK, SAFE/RISK/BREAK or LOW/MEDIUM/HIGH value. */
export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge tone={toneFor(value)} className={cn('font-mono tracking-wide', className)}>
      {value}
    </Badge>
  )
}
