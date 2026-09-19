import * as React from 'react'
import { X, Keyboard, ShieldCheck, Terminal, Cpu } from 'lucide-react'

interface ShortcutsHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts and System Reference"
    >
      <div
        className="bg-[#0c121e] border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto font-mono text-slate-200 p-5 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">EventGate Reference & Shortcuts</h2>
              <span className="text-[10px] text-slate-400">Enterprise Release Control Plane</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Keyboard Shortcuts Section */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <Terminal className="h-3.5 w-3.5 text-blue-400" />
            <span>Keyboard Ergonomics</span>
          </div>

          <div className="bg-[#080c14] border border-slate-800 rounded-lg divide-y divide-slate-800/80 text-xs">
            <div className="flex items-center justify-between p-2.5 px-3">
              <span className="text-slate-300 font-sans">Open Command Palette</span>
              <kbd className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[11px] text-slate-300">
                ⌘K / Ctrl+K
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 px-3">
              <span className="text-slate-300 font-sans">Trigger Compatibility Analysis</span>
              <kbd className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[11px] text-slate-300">
                ⌘↵ / Ctrl+Enter
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 px-3">
              <span className="text-slate-300 font-sans">Dismiss modal / drawer / palette</span>
              <kbd className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[11px] text-slate-300">
                Escape
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 px-3">
              <span className="text-slate-300 font-sans">Indent 2 spaces in JSON editor</span>
              <kbd className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[11px] text-slate-300">
                Tab
              </kbd>
            </div>
          </div>
        </div>

        {/* Compatibility Rules Section */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Compatibility Rule Matrix</span>
          </div>

          <div className="bg-[#080c14] border border-slate-800 rounded-lg p-3 space-y-2 text-[11px]">
            <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-800/60">
              <span className="font-bold text-rose-400">EVT001 — Field Type Changed</span>
              <span className="text-slate-300 text-right font-sans">
                Incompatible type mutation (e.g. string → object breaks deserializer)
              </span>
            </div>
            <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-800/60">
              <span className="font-bold text-amber-400">EVT006 — Optional Field Removed</span>
              <span className="text-slate-300 text-right font-sans">
                Field removed while registered downstream consumers depend on it
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-emerald-400">EVT008 — Consumer Unaffected</span>
              <span className="text-slate-300 text-right font-sans">
                Additive backward-compatible modification (safe forward evolution)
              </span>
            </div>
          </div>
        </div>

        {/* Enforcement Path Section */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span>Enforcement Path</span>
          </div>

          <p className="text-xs text-slate-400 font-sans leading-relaxed bg-[#080c14] border border-slate-800 rounded-lg p-3">
            EventGate evaluates release requests before invoking EventBridge. The proposed schema is verified against registered consumer contracts. When a release evaluates to BLOCK, EventGate returns HTTP 409 and does not invoke EventBridge. When evaluated to REVIEW, publication is held pending review.
          </p>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
