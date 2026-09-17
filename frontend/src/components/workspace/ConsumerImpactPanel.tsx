import { Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { AnalysisResponse, ConsumerFinding } from '@/types/api'

interface ConsumerImpactPanelProps {
  analysis: AnalysisResponse | null
}

const REGISTERED_CONSUMERS = [
  { id: 'billing-service', name: 'Billing Service', role: 'Payment processing & invoices' },
  { id: 'inventory-service', name: 'Inventory Service', role: 'Stock allocation & fulfillment' },
  { id: 'analytics-service', name: 'Analytics Service', role: 'Metrics, BI & telemetry' },
]

export function ConsumerImpactPanel({ analysis }: ConsumerImpactPanelProps) {
  const getConsumerFinding = (consumerId: string): ConsumerFinding | undefined => {
    if (!analysis) return undefined
    return analysis.findings.find((f) => f.consumerId === consumerId)
  }

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Downstream Impact</span>
            </CardTitle>
            <Badge variant="neutral">3 Consumers</Badge>
          </div>
          <CardDescription>
            Real-time contract verification per registered microservice
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {REGISTERED_CONSUMERS.map((consumer) => {
            const finding = getConsumerFinding(consumer.id)
            const status = finding ? finding.status : 'SAFE'

            return (
              <div
                key={consumer.id}
                className={`border rounded-lg p-3.5 space-y-2 transition-all ${
                  status === 'BREAK'
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : status === 'RISK'
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {status === 'BREAK' ? (
                      <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                    ) : status === 'RISK' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-100 font-mono">
                        {consumer.id}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {consumer.role}
                      </span>
                    </div>
                  </div>

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

                <div className="text-xs font-mono text-slate-300 bg-slate-900/60 rounded p-2 border border-slate-800/60">
                  {finding ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Rule: {finding.ruleId}</span>
                        {finding.field !== '*' && (
                          <span className="text-blue-400">Field: {finding.field}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {finding.reason}
                      </p>
                      {finding.expectedType && finding.proposedType && (
                        <div className="text-[10px] text-slate-400 pt-0.5">
                          Type shift: <span className="text-rose-400">{finding.expectedType}</span> → <span className="text-amber-400">{finding.proposedType}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      {analysis
                        ? 'Rule EVT008: Consumer contract unaffected by proposed changes.'
                        : 'Awaiting analysis...'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </div>

      <div className="p-5 pt-0 text-[11px] text-slate-500 text-center font-mono">
        Contracts evaluated via Amazon DynamoDB
      </div>
    </Card>
  )
}
