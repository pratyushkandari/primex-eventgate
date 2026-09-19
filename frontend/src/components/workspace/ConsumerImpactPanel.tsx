import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Users, ChevronRight, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { REGISTERED_CONSUMERS } from '@/data/consumers'
import type { AnalysisResponse, ConsumerFinding } from '@/types/api'

interface ConsumerImpactPanelProps {
  analysis: AnalysisResponse | null
  selectedConsumerId?: string | null
  onSelectConsumer?: (id: string) => void
  selectedField?: string | null
  filter?: 'ALL' | 'AFFECTED' | 'SAFE'
  onFilterChange?: (filter: 'ALL' | 'AFFECTED' | 'SAFE') => void
}

export function ConsumerImpactPanel({
  analysis,
  selectedConsumerId = null,
  onSelectConsumer,
  selectedField = null,
  filter: controlledFilter,
  onFilterChange,
}: ConsumerImpactPanelProps) {
  const [internalFilter, setInternalFilter] = React.useState<'ALL' | 'AFFECTED' | 'SAFE'>('ALL')
  const currentFilter = controlledFilter ?? internalFilter

  const handleFilterChange = (newFilter: 'ALL' | 'AFFECTED' | 'SAFE') => {
    if (onFilterChange) {
      onFilterChange(newFilter)
    } else {
      setInternalFilter(newFilter)
    }
  }

  const getConsumerFinding = React.useCallback((consumerId: string): ConsumerFinding | undefined => {
    if (!analysis) return undefined
    return analysis.findings.find((f) => f.consumerId === consumerId)
  }, [analysis])

  const counts = React.useMemo(() => {
    let affected = 0
    let safe = 0
    REGISTERED_CONSUMERS.forEach((c) => {
      const finding = getConsumerFinding(c.id)
      const status = finding ? finding.status : 'SAFE'
      if (status === 'SAFE') {
        safe++
      } else {
        affected++
      }
    })
    return {
      all: REGISTERED_CONSUMERS.length,
      affected,
      safe,
    }
  }, [getConsumerFinding])

  const filteredConsumers = React.useMemo(() => {
    return REGISTERED_CONSUMERS.filter((c) => {
      const finding = getConsumerFinding(c.id)
      const status = finding ? finding.status : 'SAFE'
      if (currentFilter === 'AFFECTED') return status !== 'SAFE'
      if (currentFilter === 'SAFE') return status === 'SAFE'
      return true
    })
  }, [currentFilter, getConsumerFinding])

  return (
    <Card className="h-full flex flex-col justify-between border-slate-800 bg-[#0c1220]/80 backdrop-blur-sm shadow-md">
      <div>
        <CardHeader className="py-3 px-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Users className="h-3.5 w-3.5 text-blue-400" />
              <span>Downstream Consumers</span>
            </CardTitle>
            <div className="flex items-center space-x-1.5">
              <Badge variant="neutral" size="sm">
                {counts.all} Registered
              </Badge>
            </div>
          </div>

          {/* Segmented Filter Tabs */}
          <div className="flex items-center space-x-1 mt-2.5 bg-slate-950/70 p-1 rounded-md border border-slate-800/80 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => handleFilterChange('ALL')}
              className={`flex-1 py-1 px-2 rounded font-medium transition-all cursor-pointer text-center ${
                currentFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('AFFECTED')}
              className={`flex-1 py-1 px-2 rounded font-medium transition-all cursor-pointer text-center flex items-center justify-center space-x-1 ${
                currentFilter === 'AFFECTED'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              {counts.affected > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
              <span>AFFECTED ({counts.affected})</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('SAFE')}
              className={`flex-1 py-1 px-2 rounded font-medium transition-all cursor-pointer text-center flex items-center justify-center space-x-1 ${
                currentFilter === 'SAFE'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <span>SAFE ({counts.safe})</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-2 font-mono">
          {/* Column Header Strip */}
          <div className="grid grid-cols-12 text-[10px] text-slate-500 uppercase px-2 py-1 tracking-wider border-b border-slate-800/60">
            <span className="col-span-5">Consumer</span>
            <span className="col-span-3 text-center">Status</span>
            <span className="col-span-4 text-right">Impact / Action</span>
          </div>

          {/* Consumer Rows */}
          <div className="space-y-2">
            {filteredConsumers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-sans italic border border-dashed border-slate-800 rounded">
                No consumers match filter &quot;{currentFilter}&quot;
              </div>
            ) : (
              filteredConsumers.map((consumer) => {
                const finding = getConsumerFinding(consumer.id)
                const status = finding ? finding.status : 'SAFE'
                const isSelected = selectedConsumerId === consumer.id
                const isFieldMatched = Boolean(
                  selectedField && finding && finding.field === selectedField
                )

                return (
                  <div
                    key={consumer.id}
                    onClick={() => onSelectConsumer?.(consumer.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Inspect ${consumer.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectConsumer?.(consumer.id)
                      }
                    }}
                    className={`p-2.5 rounded border transition-all cursor-pointer group focus:outline-none ${
                      isSelected
                        ? 'ring-2 ring-blue-500/80 bg-blue-950/30 border-blue-500/60 shadow-lg'
                        : isFieldMatched
                        ? 'ring-1 ring-amber-400/70 bg-amber-950/20 border-amber-500/40'
                        : status === 'BREAK'
                        ? 'bg-rose-950/20 border-rose-500/50 border-l-2 border-l-rose-500 hover:border-rose-400'
                        : status === 'RISK'
                        ? 'bg-amber-950/20 border-amber-500/50 border-l-2 border-l-amber-500 hover:border-amber-400'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="grid grid-cols-12 items-center gap-1">
                      {/* Column 1: Consumer ID & Role */}
                      <div className="col-span-5 truncate">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-semibold text-slate-200 block truncate group-hover:text-blue-300 transition-colors">
                            {consumer.id}
                          </span>
                          {isSelected && (
                            <Eye className="h-3 w-3 text-blue-400 flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-sans block truncate">
                          {consumer.role}
                        </span>
                      </div>

                      {/* Column 2: Status Badge */}
                      <div className="col-span-3 flex justify-center">
                        <Badge
                          variant={
                            status === 'BREAK'
                              ? 'break'
                              : status === 'RISK'
                              ? 'risk'
                              : 'safe'
                          }
                          size="sm"
                        >
                          {status}
                        </Badge>
                      </div>

                      {/* Column 3: Impact Summary & Drawer affordance */}
                      <div className="col-span-4 text-right truncate flex items-center justify-end space-x-1">
                        <div className="truncate">
                          {status === 'BREAK' && finding ? (
                            <div className="text-[11px] text-rose-300 font-medium truncate">
                              {finding.field}: {finding.expectedType} → {finding.proposedType}
                            </div>
                          ) : status === 'RISK' && finding ? (
                            <div className="text-[11px] text-amber-300 font-medium truncate">
                              {finding.field} removed
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-sans flex items-center justify-end space-x-1">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500/70" />
                              <span>Compatible</span>
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                      </div>
                    </div>

                    {/* Detailed Impact Diagnostic for Flagged Consumers */}
                    {finding && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60 text-xs">
                        <div className="p-2 rounded bg-slate-950/90 border border-slate-800/90 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="text-blue-400 font-semibold flex items-center space-x-1">
                              <ShieldAlert className="h-3 w-3 text-blue-400" />
                              <span>{finding.ruleId}</span>
                            </span>
                            <span className="text-slate-400 font-sans">Severity: {finding.severity}</span>
                          </div>
                          {finding.field !== '*' && (
                            <div className="text-[10px] text-slate-300">
                              Field: {finding.field}
                            </div>
                          )}
                          <p className="text-[11px] text-slate-300 font-sans leading-tight">
                            {finding.reason}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </div>

      <div className="p-3 text-[10px] font-mono text-slate-500 border-t border-slate-800/60 mt-2 flex items-center justify-between">
        <span>Evaluates downstream dependency contracts</span>
        <span className="text-blue-400/80 font-sans">Click row to inspect</span>
      </div>
    </Card>
  )
}
