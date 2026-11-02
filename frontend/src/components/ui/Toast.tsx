import * as React from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

import { ToastContext, type ShowToast, type ToastType } from './toast-context'

export interface ToastMessage {
  id: number
  title: string
  description?: string
  type: ToastType
}

const MAX_VISIBLE = 3
const DURATION_MS = 5000

/** Provides useToast() to the tree and renders the toast stack. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])
  const nextId = React.useRef(1)
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = React.useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = React.useCallback<ShowToast>(
    (title, description, type = 'info') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, title, description, type }].slice(-MAX_VISIBLE))
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS))
    },
    [dismiss]
  )

  React.useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info }
const ICON_COLORS = { success: 'text-success', error: 'text-danger', info: 'text-accent-fg' }

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type]
        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full items-start gap-3 rounded-[var(--radius-card)] border border-line bg-raised p-3 shadow-[var(--shadow-overlay)] animate-fade-in"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_COLORS[toast.type])} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 break-words text-xs text-fg-muted">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-fg-subtle transition-colors hover:bg-line hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
