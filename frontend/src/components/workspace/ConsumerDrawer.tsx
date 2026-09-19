import * as React from 'react'
import { X, ShieldAlert, ShieldCheck, ShieldQuestion, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { ConsumerFinding } from '@/types/api'

interface ConsumerDrawerProps {
  consumerId: string | null
  consumerRole?: string
  finding?: ConsumerFinding
  onClose: () => void
}

export function ConsumerDrawer({
  consumerId,
  consumerRole,
  finding,
  onClose,
}: ConsumerDrawerProps) {
  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!consumerId) return null

  const status = finding?.status ?? 'SAFE'
  const isBreak = status === 'BREAK'
  const isRisk = status === 'RISK'

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Consumer Inspector - ${consumerId}`}
    >
      <div
        className="w-full max-w-md bg-[#0c121e] border-l border-slate-700/80 shadow-2xl h-full flex flex-col font-mono text-slate-200 overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 bg-[#080c14] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-1.5 rounded border ${
                isBreak
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                  : isRisk
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
              }`}
            >
              {isBreak ? (
                <ShieldAlert className="h-4 w-4" />
              ) : isRisk ? (
                <ShieldQuestion className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Consumer Inspector
              </span>
              <h3 className="text-sm font-bold text-slate-100">{consumerId}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 space-y-5 flex-1">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between ${
              isBreak
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                : isRisk
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div>
              <span className="text-[10px] uppercase tracking-wider opacity-80 block font-sans">
                Evaluated Compatibility Status
              </span>
              <span className="text-base font-bold font-mono">
                {status === 'BREAK'
                  ? 'BREAKING INCOMPATIBILITY'
                  : status === 'RISK'
                  ? 'POTENTIAL CONSUMER RISK'
                  : 'FULLY COMPATIBLE'}
              </span>
            </div>
            <Badge variant={status.toLowerCase() as 'break' | 'risk' | 'safe'} size="md">
              {status}
            </Badge>
          </div>

          {/* Consumer Metadata */}
          <div className="space-y-2 text-xs">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
              Registered Service Metadata
            </span>
            <div className="bg-[#090d16] border border-slate-800 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">Identifier:</span>
                <span className="text-slate-200 font-mono font-semibold">{consumerId}</span>
              </div>
              {consumerRole && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans">Role:</span>
                  <span className="text-slate-300 font-sans">{consumerRole}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">Registry:</span>
                <span className="text-slate-300">Amazon DynamoDB</span>
              </div>
            </div>
          </div>

          {/* Evaluated Rule & Impact */}
          {finding && (
            <div className="space-y-2 text-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Deterministic Rule Evaluation
              </span>
              <div className="bg-[#090d16] border border-slate-800 rounded p-3 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400 font-sans">Triggered Rule:</span>
                  <span className="text-blue-400 font-mono font-semibold">{finding.ruleId}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400 font-sans">Severity:</span>
                  <span
                    className={`font-semibold ${
                      finding.severity === 'HIGH'
                        ? 'text-rose-400'
                        : finding.severity === 'MEDIUM'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {finding.severity}
                  </span>
                </div>

                {finding.field !== '*' && (
                  <div className="space-y-1.5 pb-2 border-b border-slate-800/80">
                    <span className="text-slate-400 font-sans block">Affected Field:</span>
                    <div className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded">
                      <span className="text-slate-200 font-bold">{finding.field}</span>
                      {finding.expectedType && finding.proposedType && (
                        <div className="flex items-center space-x-1.5 text-[11px]">
                          <span className="text-slate-400 line-through">{finding.expectedType}</span>
                          <ArrowRight className="h-3 w-3 text-slate-500" />
                          <span className="text-rose-300 font-bold">{finding.proposedType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-slate-400 font-sans block">Why it matters:</span>
                  <p className="text-slate-300 font-sans text-xs leading-relaxed bg-slate-900/50 p-2 rounded">
                    {finding.reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Operational Consequence */}
          <div className="space-y-2 text-xs">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
              Enforcement
            </span>
            <div className="bg-[#090d16] border border-slate-800 rounded p-3 text-xs leading-relaxed text-slate-300 font-sans">
              {isBreak ? (
                <p>
                  <strong className="text-rose-400 font-mono">Publication prevented.</strong> EventGate returns HTTP 409 before calling EventBridge PutEvents.
                </p>
              ) : isRisk ? (
                <p>
                  <strong className="text-amber-400 font-mono">Publication held pending review.</strong> EventGate holds publication before EventBridge PutEvents pending review.
                </p>
              ) : (
                <p>
                  <strong className="text-emerald-400 font-mono">Publication permitted.</strong> The proposed contract conforms with all schema constraints registered by <code className="text-slate-200 font-mono">{consumerId}</code>.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#080c14] text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <span>Press <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-slate-400">ESC</kbd> to close</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
