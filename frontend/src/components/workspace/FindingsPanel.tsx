import { FileCode2, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { AnalysisResponse } from '@/types/api'

interface FindingsPanelProps {
  analysis: AnalysisResponse | null
}

export function FindingsPanel({ analysis }: FindingsPanelProps) {
  if (!analysis) return null

  const { changeSet, findings } = analysis

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
            <FileCode2 className="h-4 w-4 text-blue-400" />
            <span>Compatibility Findings & Schema Diff</span>
          </CardTitle>
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span>{findings.length} findings</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ChangeSet Summary */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Schema ChangeSet Summary
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Added Fields</span>
              <span className="text-emerald-400 font-semibold">
                {changeSet.addedFields.length > 0 ? changeSet.addedFields.join(', ') : 'None'}
              </span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Removed Fields</span>
              <span className="text-rose-400 font-semibold">
                {changeSet.removedFields.length > 0 ? changeSet.removedFields.join(', ') : 'None'}
              </span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Type Shifts</span>
              <span className="text-amber-400 font-semibold">
                {changeSet.typeChanges.length > 0
                  ? changeSet.typeChanges.map((tc) => `${tc.field} (${tc.fromType}→${tc.toType})`).join(', ')
                  : 'None'}
              </span>
            </div>

            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Requiredness</span>
              <span className="text-slate-300 font-semibold">
                {changeSet.requirednessChanges.length > 0
                  ? changeSet.requirednessChanges.map((rc) => rc.field).join(', ')
                  : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Findings List */}
        <div className="space-y-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block">
            Detailed Consumer Rules Evaluated
          </span>

          <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            {findings.map((f, idx) => (
              <div key={`${f.consumerId}-${f.ruleId}-${idx}`} className="p-3 space-y-1.5 text-xs font-mono">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-200">{f.consumerId}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-blue-400 font-medium">{f.ruleId}</span>
                    {f.field !== '*' && (
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-300">
                        {f.field}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge variant={f.status.toLowerCase() as 'safe' | 'break' | 'risk'} size="sm">
                      {f.status}
                    </Badge>
                    <span className="text-[10px] text-slate-500 uppercase">
                      Sev: {f.severity}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-sans leading-normal">
                  {f.reason}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Evaluation ID: {analysis.analysisId}</span>
          <span>•</span>
          <span>Timestamp: {new Date(analysis.timestamp).toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  )
}
