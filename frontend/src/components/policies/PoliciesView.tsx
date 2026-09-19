import * as React from 'react'
import {
  ShieldCheck,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react'
import { usePolicies } from '@/services/queries'
import { Badge } from '@/components/ui/Badge'

export function PoliciesView() {
  const { data: policiesData, isLoading, error, refetch } = usePolicies()
  const [copiedCedar, setCopiedCedar] = React.useState(false)

  const handleCopyCedar = () => {
    if (policiesData?.cedarPolicyText) {
      navigator.clipboard.writeText(policiesData.cedarPolicyText)
      setCopiedCedar(true)
      setTimeout(() => setCopiedCedar(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 font-mono text-xs text-slate-400">
        <RefreshCw className="h-4 w-4 mr-2 animate-spin text-blue-400" />
        Loading authoritative release policies...
      </div>
    )
  }

  if (error || !policiesData) {
    return (
      <div className="bg-rose-950/30 border border-rose-500/50 rounded-lg p-5 text-xs text-rose-300 font-mono">
        <div className="flex items-center space-x-2 font-bold mb-1">
          <XCircle className="h-4 w-4 text-rose-400" />
          <span>Unable to load release policy.</span>
        </div>
        <p className="text-rose-300/80">Check the release API connection and retry.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Release Policies</h1>
            <Badge variant="default" size="sm">
              {policiesData.engineName}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative release gating rules by deployment environment and compatibility severity
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400">Active Engine:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
            {policiesData.activeEngine}
          </span>
        </div>
      </div>

      {/* Decision Pipeline Architecture Banner */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5 text-xs font-mono">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Decision Pipeline
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300">
            <span className="text-slate-500 text-[10px] block">Stage 1</span>
            <span className="font-bold text-blue-400">Compatibility</span>
            <span className="text-[10px] text-slate-400 ml-1.5">(SAFE / RISK / BREAK)</span>
          </div>
          <span className="text-slate-600">→</span>
          <div className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300">
            <span className="text-slate-500 text-[10px] block">Stage 2</span>
            <span className="font-bold text-purple-400">Severity</span>
            <span className="text-[10px] text-slate-400 ml-1.5">(LOW / MEDIUM / HIGH)</span>
          </div>
          <span className="text-slate-600">→</span>
          <div className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300">
            <span className="text-slate-500 text-[10px] block">Stage 3</span>
            <span className="font-bold text-amber-400">Release Policy</span>
            <span className="text-[10px] text-slate-400 ml-1.5">(Environment Matrix)</span>
          </div>
          <span className="text-slate-600">→</span>
          <div className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300">
            <span className="text-slate-500 text-[10px] block">Final</span>
            <span className="font-bold text-emerald-400">Decision</span>
            <span className="text-[10px] text-slate-400 ml-1.5">(ALLOW / REVIEW / BLOCK)</span>
          </div>
        </div>
      </div>

      {/* Engine Overview Strip */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <ShieldCheck className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-sm font-semibold text-slate-200">
              {policiesData.engineName}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">{policiesData.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500">Status:</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 font-bold">Enforcing</span>
        </div>
      </div>

      {/* Authoritative Environment Policy Matrix */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            Environment Release Policy Matrix
          </h2>
          <span className="text-xs text-slate-400">Decision Rules</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-4 font-semibold">Environment</th>
                <th className="py-2.5 px-4 font-semibold">
                  <div className="flex items-center space-x-1.5 text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>LOW Severity (Safe)</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 font-semibold">
                  <div className="flex items-center space-x-1.5 text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>MEDIUM Severity (Risk)</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 font-semibold">
                  <div className="flex items-center space-x-1.5 text-rose-400">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>HIGH Severity (Break)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {policiesData.matrix.map((row) => (
                <tr
                  key={row.environment}
                  className="hover:bg-slate-900/40 transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-slate-200">
                    {row.environment}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="allow" size="sm">
                      {row.low}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        row.medium.startsWith('ALLOW') ? 'allow' : 'review'
                      }
                      size="sm"
                    >
                      {row.medium}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="block" size="sm">
                      {row.high}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Semantics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold">
            <CheckCircle2 className="h-4 w-4" />
            <span>ALLOW</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            All registered downstream consumers remain backward compatible. Change may be
            published immediately to production Amazon EventBridge bus.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <AlertTriangle className="h-4 w-4" />
            <span>REVIEW</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Change introduces non-breaking risk (e.g. removed optional field in consumer view).
            Requires explicit engineering review prior to production publication.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-rose-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2 text-rose-400 font-bold">
            <XCircle className="h-4 w-4" />
            <span>BLOCK</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            One or more consumers will experience runtime exceptions due to type changes or
            missing required fields. EventGate blocks publication automatically.
          </p>
        </div>
      </div>

      {/* Cedar Policy Specification Code Viewer */}
      {policiesData.cedarPolicyText && (
        <div className="bg-[#0b0f19] border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileCode className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Cedar Language Policy Specification
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCopyCedar}
              className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              {copiedCedar ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Cedar Policy</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-slate-950/90 text-xs overflow-x-auto">
            <pre className="text-slate-300 leading-relaxed font-mono whitespace-pre">
              {policiesData.cedarPolicyText}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
