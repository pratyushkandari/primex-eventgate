import { GitPullRequest, Code2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { AnalysisResponse } from '@/types/api'

interface FindingsPanelProps {
  analysis: AnalysisResponse | null
}

export function FindingsPanel({ analysis }: FindingsPanelProps) {
  if (!analysis) return null

  const { changeSet, findings } = analysis

  const hasSchemaChanges =
    changeSet.addedFields.length > 0 ||
    changeSet.removedFields.length > 0 ||
    changeSet.typeChanges.length > 0 ||
    changeSet.requirednessChanges.length > 0

  return (
    <Card className="border-slate-800">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <GitPullRequest className="h-3.5 w-3.5 text-blue-400" />
            <span>Compatibility findings & Schema diff</span>
          </CardTitle>
          <span className="text-xs font-mono text-slate-400">
            {findings.length} {findings.length === 1 ? 'finding' : 'findings'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Schema Diff Section (Code Review Diff style) */}
        <div>
          <div className="flex items-center space-x-1.5 text-[11px] font-mono uppercase text-slate-400 mb-1.5">
            <Code2 className="h-3 w-3 text-slate-500" />
            <span>Schema change</span>
          </div>

          <div className="bg-[#0a0e17] rounded border border-slate-800 p-3 font-mono text-xs space-y-1 select-text">
            {hasSchemaChanges ? (
              <>
                {changeSet.addedFields.map((field) => (
                  <div key={field} className="flex items-center space-x-3 text-emerald-400">
                    <span className="text-emerald-500/80 select-none font-bold">+</span>
                    <span className="font-semibold">{field}</span>
                    <span className="text-slate-500 text-[11px]">field added (optional)</span>
                  </div>
                ))}

                {changeSet.typeChanges.map((tc) => (
                  <div key={tc.field} className="flex items-center space-x-3 text-amber-400">
                    <span className="text-amber-500/80 select-none font-bold">~</span>
                    <span className="font-semibold">{tc.field}</span>
                    <span className="text-slate-400 text-[11px]">
                      {tc.fromType} → {tc.toType}
                    </span>
                  </div>
                ))}

                {changeSet.removedFields.map((field) => (
                  <div key={field} className="flex items-center space-x-3 text-rose-400">
                    <span className="text-rose-500/80 select-none font-bold">-</span>
                    <span className="font-semibold">{field}</span>
                    <span className="text-slate-500 text-[11px]">optional field removed</span>
                  </div>
                ))}

                {changeSet.requirednessChanges.map((rc) => (
                  <div key={rc.field} className="flex items-center space-x-3 text-blue-400">
                    <span className="text-blue-500/80 select-none font-bold">~</span>
                    <span className="font-semibold">{rc.field}</span>
                    <span className="text-slate-500 text-[11px]">requiredness modified</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-slate-500 italic">No schema modifications detected</div>
            )}
          </div>
        </div>

        {/* Structured Findings List */}
        {findings.length > 0 && (
          <div>
            <span className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5">
              Compatibility findings
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {findings.map((f, idx) => (
                <div
                  key={`${f.consumerId}-${f.ruleId}-${idx}`}
                  className="p-3 rounded border border-slate-800/80 bg-slate-950/60 font-mono text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-blue-400 tracking-tight">
                        {f.ruleId}
                      </span>
                      {f.field !== '*' && (
                        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[11px]">
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

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div>
                      <span className="text-slate-500">Consumer: </span>
                      <span className="text-slate-200 font-semibold">{f.consumerId}</span>
                    </div>

                    {f.expectedType && f.proposedType && (
                      <div className="flex items-center space-x-4 pt-1 text-[11px]">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Expected</span>
                          <span className="text-slate-200">{f.expectedType}</span>
                        </div>
                        <span className="text-slate-600">→</span>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Proposed</span>
                          <span className="text-rose-300">{f.proposedType}</span>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-300 pt-1 font-sans">
                      {f.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
