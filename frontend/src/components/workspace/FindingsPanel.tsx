import * as React from 'react'
import { GitPullRequest, Code2, ShieldCheck, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { AnalysisResponse } from '@/types/api'

interface FindingsPanelProps {
  analysis: AnalysisResponse | null
  selectedField?: string | null
  onSelectField?: (field: string | null) => void
  selectedConsumerId?: string | null
  onSelectConsumer?: (consumerId: string) => void
}

type DiffFilter = 'ALL' | 'TYPES' | 'ADDITIONS' | 'REMOVALS'

export function FindingsPanel({
  analysis,
  selectedField = null,
  onSelectField,
  selectedConsumerId = null,
  onSelectConsumer,
}: FindingsPanelProps) {
  const [diffFilter, setDiffFilter] = React.useState<DiffFilter>('ALL')
  const [expandedFindings, setExpandedFindings] = React.useState<Record<string, boolean>>({})

  if (!analysis) return null

  const { changeSet, findings } = analysis

  const addedCount = changeSet.addedFields.length
  const removedCount = changeSet.removedFields.length
  const typeChangeCount = changeSet.typeChanges.length
  const requirednessCount = changeSet.requirednessChanges.length

  const hasSchemaChanges =
    addedCount > 0 || removedCount > 0 || typeChangeCount > 0 || requirednessCount > 0

  const toggleFindingExpand = (key: string) => {
    setExpandedFindings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleFieldClick = (field: string) => {
    if (!onSelectField) return
    if (selectedField === field) {
      onSelectField(null)
    } else {
      onSelectField(field)
    }
  }

  return (
    <Card className="border-slate-800 bg-[#0c1220]/80 backdrop-blur-sm shadow-md">
      <CardHeader className="py-3 px-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <GitPullRequest className="h-3.5 w-3.5 text-blue-400" />
            <span>Compatibility findings & Schema diff</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                analysis.decision === 'ALLOW'
                  ? 'safe'
                  : analysis.decision === 'BLOCK'
                  ? 'break'
                  : 'risk'
              }
              size="sm"
            >
              {analysis.decision}
            </Badge>
            <span className="text-xs font-mono text-slate-400">
              {findings.length} {findings.length === 1 ? 'finding' : 'findings'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-5">
        {/* Schema Diff Section (Code Review Diff style) */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-400 mb-2">
            <div className="flex items-center space-x-2 uppercase">
              <Code2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-semibold text-slate-300">Schema Diff Breakdown</span>
            </div>

            {/* Diff Filter Controls */}
            <div className="flex items-center space-x-1 bg-slate-950/80 p-0.5 rounded border border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => setDiffFilter('ALL')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  diffFilter === 'ALL'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({addedCount + removedCount + typeChangeCount + requirednessCount})
              </button>
              <button
                type="button"
                onClick={() => setDiffFilter('TYPES')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  diffFilter === 'TYPES'
                    ? 'bg-amber-950/70 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                Types ({typeChangeCount})
              </button>
              <button
                type="button"
                onClick={() => setDiffFilter('ADDITIONS')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  diffFilter === 'ADDITIONS'
                    ? 'bg-emerald-950/70 text-emerald-300 font-semibold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                Added ({addedCount})
              </button>
              <button
                type="button"
                onClick={() => setDiffFilter('REMOVALS')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  diffFilter === 'REMOVALS'
                    ? 'bg-rose-950/70 text-rose-300 font-semibold border border-rose-500/30'
                    : 'text-slate-400 hover:text-rose-300'
                }`}
              >
                Removed ({removedCount})
              </button>
            </div>
          </div>

          <div className="bg-[#0a0e17] rounded border border-slate-800 p-3 font-mono text-xs space-y-1.5 select-text">
            {hasSchemaChanges ? (
              <>
                {(diffFilter === 'ALL' || diffFilter === 'ADDITIONS') &&
                  changeSet.addedFields.map((field) => {
                    const isSelected = selectedField === field
                    return (
                      <div
                        key={field}
                        onClick={() => handleFieldClick(field)}
                        role="button"
                        tabIndex={0}
                        title="Click to cross-link with consumer impact"
                        className={`flex items-center justify-between text-emerald-400 bg-emerald-950/20 px-2.5 py-1.5 rounded border transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-950/40'
                            : 'border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-950/30'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-emerald-400 select-none font-bold">+</span>
                          <span className="font-semibold">{field}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] font-sans">
                          <span className="text-slate-400">field added (optional)</span>
                          <span className="text-slate-600 text-[10px] font-mono">click to crosslink</span>
                        </div>
                      </div>
                    )
                  })}

                {(diffFilter === 'ALL' || diffFilter === 'TYPES') &&
                  changeSet.typeChanges.map((tc) => {
                    const isSelected = selectedField === tc.field
                    return (
                      <div
                        key={tc.field}
                        onClick={() => handleFieldClick(tc.field)}
                        role="button"
                        tabIndex={0}
                        title="Click to cross-link with consumer impact"
                        className={`flex items-center justify-between text-amber-400 bg-amber-950/20 px-2.5 py-1.5 rounded border transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-950/40'
                            : 'border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-950/30'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-amber-400 select-none font-bold">~</span>
                          <span className="font-semibold">{tc.field}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-slate-300 text-[11px] font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {tc.fromType} → {tc.toType}
                          </span>
                          <span className="text-slate-600 text-[10px] font-mono">click to crosslink</span>
                        </div>
                      </div>
                    )
                  })}

                {(diffFilter === 'ALL' || diffFilter === 'REMOVALS') &&
                  changeSet.removedFields.map((field) => {
                    const isSelected = selectedField === field
                    return (
                      <div
                        key={field}
                        onClick={() => handleFieldClick(field)}
                        role="button"
                        tabIndex={0}
                        title="Click to cross-link with consumer impact"
                        className={`flex items-center justify-between text-rose-400 bg-rose-950/20 px-2.5 py-1.5 rounded border transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-rose-400 border-rose-400 bg-rose-950/40'
                            : 'border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-950/30'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-rose-400 select-none font-bold">-</span>
                          <span className="font-semibold">{field}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] font-sans">
                          <span className="text-slate-400">optional field removed</span>
                          <span className="text-slate-600 text-[10px] font-mono">click to crosslink</span>
                        </div>
                      </div>
                    )
                  })}

                {diffFilter === 'ALL' &&
                  changeSet.requirednessChanges.map((rc) => (
                    <div
                      key={rc.field}
                      className="flex items-center justify-between text-blue-400 bg-blue-950/20 px-2.5 py-1.5 rounded border border-blue-500/20"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-400 select-none font-bold">~</span>
                        <span className="font-semibold">{rc.field}</span>
                      </div>
                      <span className="text-slate-400 text-[11px] font-sans">requiredness modified</span>
                    </div>
                  ))}
              </>
            ) : (
              <div className="text-slate-500 italic py-2 text-center">No schema modifications detected</div>
            )}
          </div>
        </div>

        {/* Structured Findings List */}
        {findings.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-slate-400 mb-2">
              <span className="font-semibold text-slate-300">Consumer Compatibility Diagnostics</span>
              <span className="text-slate-500 text-[10px]">Click consumer to open deep inspector</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {findings.map((f, idx) => {
                const key = `${f.consumerId}-${f.ruleId}-${idx}`
                const isSelected = selectedConsumerId === f.consumerId
                const isFieldMatched = selectedField && f.field === selectedField
                const isExpanded = Boolean(expandedFindings[key])

                return (
                  <div
                    key={key}
                    className={`p-3.5 rounded border font-mono text-xs space-y-2.5 transition-all ${
                      isSelected
                        ? 'ring-2 ring-blue-500 bg-blue-950/30 border-blue-500/60 shadow-lg'
                        : isFieldMatched
                        ? 'ring-1 ring-amber-400 bg-amber-950/20 border-amber-500/50'
                        : f.status === 'BREAK'
                        ? 'bg-slate-950/80 border-rose-500/40 hover:border-rose-400'
                        : 'bg-slate-950/80 border-amber-500/40 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-blue-400 tracking-tight flex items-center space-x-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                          <span>{f.ruleId}</span>
                        </span>
                        {f.field !== '*' && (
                          <span
                            onClick={() => handleFieldClick(f.field)}
                            title="Filter by this field"
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded text-[11px] cursor-pointer border border-slate-700"
                          >
                            {f.field}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Badge
                          variant={f.status.toLowerCase() as 'safe' | 'break' | 'risk'}
                          size="sm"
                        >
                          {f.status}
                        </Badge>
                        <Badge variant="neutral" size="sm">
                          {f.severity}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-500">Consumer:</span>
                          <button
                            type="button"
                            onClick={() => onSelectConsumer?.(f.consumerId)}
                            className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 flex items-center space-x-1 cursor-pointer"
                          >
                            <span>{f.consumerId}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFindingExpand(key)}
                          className="text-slate-500 hover:text-slate-300 text-[10px] flex items-center space-x-0.5 cursor-pointer font-sans"
                        >
                          <span>{isExpanded ? 'Less' : 'Details'}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {f.expectedType && f.proposedType && (
                        <div className="flex items-center space-x-3 p-1.5 rounded bg-slate-900 border border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase">Expected Type</span>
                            <span className="text-slate-200 font-bold">{f.expectedType}</span>
                          </div>
                          <span className="text-slate-600 font-bold">→</span>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase">Proposed Type</span>
                            <span className="text-rose-300 font-bold">{f.proposedType}</span>
                          </div>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-300 font-sans leading-relaxed pt-0.5">
                        {f.reason}
                      </p>

                      {isExpanded && (
                        <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] font-sans space-y-1 text-slate-400">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Contract Rule:</span>
                            <span className="font-mono text-slate-300">{f.ruleId}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Policy Action:</span>
                            <span className="font-mono text-rose-300 font-semibold">
                              {f.status === 'BREAK' ? 'BLOCK_EVENT' : 'FLAG_REVIEW'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Target Field:</span>
                            <span className="font-mono text-slate-300">{f.field}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
