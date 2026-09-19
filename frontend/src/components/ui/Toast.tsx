import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  type?: 'success' | 'error' | 'info'
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start justify-between p-3 rounded-lg border shadow-xl backdrop-blur-md transition-all font-mono text-xs ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <div className="font-semibold text-xs leading-none">{toast.title}</div>
              {toast.description && (
                <div className="text-[11px] text-slate-400 mt-1 font-sans leading-tight">
                  {toast.description}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-slate-200 ml-2 p-0.5 rounded hover:bg-slate-800/60 transition-colors cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
