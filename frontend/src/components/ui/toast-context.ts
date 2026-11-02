import * as React from 'react'

export type ToastType = 'success' | 'error' | 'info'
export type ShowToast = (title: string, description?: string, type?: ToastType) => void

export const ToastContext = React.createContext<ShowToast | null>(null)

/** Show a toast: useToast()(title, description?, type?). Requires <ToastProvider>. */
export function useToast(): ShowToast {
  const show = React.useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
