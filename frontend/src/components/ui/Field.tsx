import * as React from 'react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full rounded-[var(--radius-control)] border border-line bg-canvas px-2.5 text-sm text-fg ' +
  'placeholder:text-fg-subtle transition-colors duration-150 hover:border-line-strong ' +
  'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger-line'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1 block text-xs font-medium text-fg-muted', className)} {...props} />
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(CONTROL, 'h-9', className)} {...props} />
  )
)
Input.displayName = 'Input'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(CONTROL, 'h-9 cursor-pointer pr-8', className)} {...props} />
  )
)
Select.displayName = 'Select'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(CONTROL, 'py-2 font-mono text-xs leading-5', className)} {...props} />
))
Textarea.displayName = 'Textarea'

/** Helper or error text under a control; errors are announced by screen readers. */
export function FieldMessage({
  id,
  error,
  children,
}: {
  id?: string
  error?: boolean
  children: React.ReactNode
}) {
  return (
    <p
      id={id}
      role={error ? 'alert' : undefined}
      className={cn('mt-1 text-xs', error ? 'text-danger' : 'text-fg-subtle')}
    >
      {children}
    </p>
  )
}
