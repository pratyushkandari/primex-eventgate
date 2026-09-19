import { Badge } from '@/components/ui/Badge'
import type { AnalysisResponse } from '@/types/api'
import { GitPullRequest, ShieldCheck } from 'lucide-react'

interface ReviewContextBarProps {
  analysis: AnalysisResponse | null
  onFilterAffected?: () => void
}

export function ReviewContextBar({ analysis, onFilterAffected }: ReviewContextBarProps) {
  if (!analysis) {
    return (
      <div className="bg-[#0c121e] border border-slate-800/90 rounded-lg p-2.5 px-4 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center space-x-2.5">
          <GitPullRequest className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-slate-300">Release Review Overview</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-500">Awaiting contract analysis</span>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:block">
          Select scenario preset or edit payload to evaluate
        </div>
      </div>
    )
  }

  const safeCount = analysis.findings.filter((f) => f.status === 'SAFE').length
  const breakCount = analysis.findings.filter((f) => f.status === 'BREAK').length
  const riskCount = analysis.findings.filter((f) => f.status === 'RISK').length
  const totalCount = analysis.findings.length || 3

  const safePct = (safeCount / totalCount) * 100
  const breakPct = (breakCount / totalCount) * 100
  const riskPct = (riskCount / totalCount) * 100

  const primaryImpactFinding = analysis.findings.find((f) => f.status !== 'SAFE')

  return (
    <div className="bg-[#0c121e] border border-slate-800/90 rounded-lg p-3 px-4 font-mono text-xs shadow-sm space-y-2.5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Change Target & Versions */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
              Change Review
            </span>
            <span className="text-blue-400 font-bold text-sm">{analysis.eventType}</span>
          </div>
          <span className="text-slate-400 font-medium">
            v{analysis.currentVersion} <span className="text-slate-600">→</span> v{analysis.proposedVersion}
          </span>
          <Badge variant={analysis.decision.toLowerCase() as 'allow' | 'block' | 'review'} size="sm">
            {analysis.decision}
          </Badge>
        </div>

        {/* Right: Primary Impact Diagnosis */}
        <div className="flex items-center space-x-3 text-[11px]">
          <div className="text-slate-300">
            <span className="text-slate-500">Impact: </span>
            <span className="font-semibold text-slate-200">
              {breakCount + riskCount}{' '}
              {breakCount + riskCount === 1 ? 'consumer affected' : 'consumers affected'}
            </span>
          </div>

          {primaryImpactFinding ? (
            <button
              type="button"
              onClick={onFilterAffected}
              className="text-left flex items-center space-x-1.5 hover:bg-slate-800/50 p-1 rounded transition-colors text-slate-300 group cursor-pointer"
              title="Click to inspect impacted consumer"
            >
              <span className="font-semibold text-rose-300 group-hover:text-rose-200 underline decoration-rose-500/40">
                {primaryImpactFinding.consumerId}
              </span>
              {primaryImpactFinding.field !== '*' && (
                <span className="text-slate-400">({primaryImpactFinding.field})</span>
              )}
            </button>
          ) : (
            <div className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              <span>Compatible</span>
            </div>
          )}
        </div>
      </div>

      {/* Segmented Distribution Bar */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
        {/* Visual Bar */}
        <div className="flex-1 max-w-md">
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-800" role="progressbar" aria-label="Consumer compatibility distribution">
            {safePct > 0 && (
              <div
                style={{ width: `${safePct}%` }}
                className="bg-emerald-500 transition-all duration-300"
                title={`${safeCount} Safe`}
              />
            )}
            {riskPct > 0 && (
              <div
                style={{ width: `${riskPct}%` }}
                className="bg-amber-500 transition-all duration-300"
                title={`${riskCount} Risk`}
              />
            )}
            {breakPct > 0 && (
              <div
                style={{ width: `${breakPct}%` }}
                className="bg-rose-500 transition-all duration-300"
                title={`${breakCount} Breaking`}
              />
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[10px] text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{safeCount} Safe</span>
          </span>
          {breakCount > 0 && (
            <span className="flex items-center space-x-1 text-rose-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>{breakCount} Break</span>
            </span>
          )}
          {riskCount > 0 && (
            <span className="flex items-center space-x-1 text-amber-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>{riskCount} Risk</span>
            </span>
          )}
          <span className="text-slate-500">| {totalCount} evaluated</span>
        </div>
      </div>
    </div>
  )
}
