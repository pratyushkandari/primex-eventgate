import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'allow'
    | 'block'
    | 'review'
    | 'safe'
    | 'break'
    | 'risk'
    | 'neutral'
    | 'outline'
  size?: 'sm' | 'md'
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-mono font-medium rounded-full'

  const variants = {
    default: 'bg-slate-800 text-slate-200 border border-slate-700',
    allow: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    safe: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    block: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    break: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    review: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    risk: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    neutral: 'bg-slate-800/80 text-slate-400 border border-slate-700/60',
    outline: 'bg-transparent text-slate-300 border border-slate-700',
  }

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  )
}
