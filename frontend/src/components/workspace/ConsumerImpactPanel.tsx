import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { AnalysisResponse, ConsumerFinding } from '@/types/api'

interface ConsumerImpactPanelProps {
  analysis: AnalysisResponse | null
}

const REGISTERED_CONSUMERS = [
  { id: 'billing-service', name: 'Billing', role: 'Payment processing & invoices' },
  { id: 'inventory-service', name: 'Inventory', role: 'Stock allocation & fulfillment' },
  { id: 'analytics-service', name: 'Analytics', role: 'Metrics, BI & telemetry' },
]

export function ConsumerImpactPanel({ analysis }: ConsumerImpactPanelProps) {
  const getConsumerFinding = (consumerId: string): ConsumerFinding | undefined => {
    if (!analysis) return undefined
    return analysis.findings.find((f) => f.consumerId === consumerId)
  }

  return (
    <Card className="h-full flex flex-col justify-between border-slate-800">
      <div>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Consumers
            </CardTitle>
            <Badge variant="neutral" size="sm">
              3
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-2 font-mono">
          {/* Column Header Strip */}
          <div className="grid grid-cols-12 text-[10px] text-slate-500 uppercase px-2 py-1 tracking-wider border-b border-slate-800/60 pb-1">
            <span className="col-span-5">Consumer</span>
            <span className="col-span-3 text-center">Status</span>
            <span className="col-span-4 text-right">Impact</span>
          </div>

          {/* Consumer Rows */}
          <div className="space-y-2">
            {REGISTERED_CONSUMERS.map((consumer) => {
              const finding = getConsumerFinding(consumer.id)
              const status = finding ? finding.status : 'SAFE'

              return (
                <div
                  key={consumer.id}
                  className={`p-2.5 rounded border transition-colors ${
                    status === 'BREAK'
                      ? 'bg-rose-950/20 border-rose-500/50 border-l-2 border-l-rose-500'
                      : status === 'RISK'
                      ? 'bg-amber-950/20 border-amber-500/50 border-l-2 border-l-amber-500'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  <div className="grid grid-cols-12 items-center gap-1">
                    {/* Column 1: Consumer */}
                    <div className="col-span-5 truncate">
                      <span className="text-xs font-semibold text-slate-200 block truncate">
                        {consumer.id}
                      </span>
                      <span className="text-[10px] text-slate-500 font-sans block truncate">
                        {consumer.role}
                      </span>
                    </div>

                    {/* Column 2: Status */}
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

                    {/* Column 3: Impact Summary */}
                    <div className="col-span-4 text-right truncate">
                      {status === 'BREAK' && finding ? (
                        <div className="text-[11px] text-rose-300 font-medium truncate">
                          {finding.field}: {finding.expectedType} → {finding.proposedType}
                        </div>
                      ) : status === 'RISK' && finding ? (
                        <div className="text-[11px] text-amber-300 font-medium truncate">
                          {finding.field} removed
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-sans">
                          No relevant impact
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detailed Impact Diagnostic for Flagged Consumers */}
                  {finding && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 text-xs">
                      <div className="p-2 rounded bg-slate-950/90 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="text-blue-400 font-semibold">{finding.ruleId}</span>
                          <span className="text-slate-400">Severity: {finding.severity}</span>
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
            })}
          </div>
        </CardContent>
      </div>

      <div className="p-4 pt-0 text-[10px] font-mono text-slate-500 border-t border-slate-800/40 mt-2">
        <span>Evaluates downstream consumer dependency contracts in DynamoDB</span>
      </div>
    </Card>
  )
}
