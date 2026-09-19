import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { AnalysisResponse } from '@/types/api'
import { Network, ArrowRight, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'

interface DependencyTopologyProps {
  analysis: AnalysisResponse | null
  selectedConsumerId: string | null
  onSelectConsumer: (consumerId: string) => void
}

const CONSUMERS = [
  { id: 'billing-service', name: 'Billing', role: 'Payment processing & invoices' },
  { id: 'inventory-service', name: 'Inventory', role: 'Stock allocation & fulfillment' },
  { id: 'analytics-service', name: 'Analytics', role: 'Metrics, BI & telemetry' },
]

export function DependencyTopology({
  analysis,
  selectedConsumerId,
  onSelectConsumer,
}: DependencyTopologyProps) {
  const getConsumerStatus = (id: string) => {
    if (!analysis) return 'SAFE'
    const finding = analysis.findings.find((f) => f.consumerId === id)
    return finding ? finding.status : 'SAFE'
  }

  const getConsumerFinding = (id: string) => {
    if (!analysis) return null
    return analysis.findings.find((f) => f.consumerId === id)
  }

  const gateDecision = analysis?.decision ?? null

  return (
    <Card className="border-slate-800 bg-[#0c121e]">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Network className="h-3.5 w-3.5 text-blue-400" />
            <span>Dependency topology & contract graph</span>
          </CardTitle>
          <span className="text-[10px] text-slate-500 font-mono">
            Interactive Node Map • Click to inspect
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 font-mono">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-2">
          {/* Node 1: Producer Event */}
          <div className="p-3 rounded-lg border border-slate-700 bg-slate-900/90 flex flex-col justify-center min-w-[150px] shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">
              Producer Contract
            </span>
            <span className="text-sm font-bold text-blue-400">OrderPlaced</span>
            <span className="text-[10px] text-slate-400 mt-1">
              v{analysis ? analysis.currentVersion : 1} → v{analysis ? analysis.proposedVersion : 2}
            </span>
          </div>

          {/* Connector to Gate */}
          <div className="flex items-center justify-center text-slate-600">
            <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
          </div>

          {/* Node 2: EventGate Gatekeeper */}
          <div
            className={`p-3 rounded-lg border flex flex-col justify-center min-w-[160px] shadow-sm transition-colors ${
              gateDecision === 'ALLOW'
                ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                : gateDecision === 'BLOCK'
                ? 'bg-rose-950/30 border-rose-500/50 text-rose-300'
                : gateDecision === 'REVIEW'
                ? 'bg-amber-950/30 border-amber-500/50 text-amber-300'
                : 'bg-slate-900/90 border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider opacity-80 font-sans">
                Release Gate
              </span>
              {gateDecision === 'ALLOW' && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
              {gateDecision === 'BLOCK' && <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />}
              {gateDecision === 'REVIEW' && <ShieldQuestion className="h-3.5 w-3.5 text-amber-400" />}
            </div>
            <span className="text-sm font-bold mt-0.5">EventGate</span>
            <span className="text-[10px] opacity-80 mt-1">
              {gateDecision ? `Decision: ${gateDecision}` : 'Ready for analysis'}
            </span>
          </div>

          {/* Connector to Consumers */}
          <div className="flex items-center justify-center text-slate-600">
            <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
          </div>

          {/* Node 3: Consumer Downstream Fan-out */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {CONSUMERS.map((c) => {
              const status = getConsumerStatus(c.id)
              const finding = getConsumerFinding(c.id)
              const isSelected = selectedConsumerId === c.id

              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onSelectConsumer(c.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    status === 'BREAK'
                      ? 'bg-rose-950/30 border-rose-500/60 hover:bg-rose-950/50'
                      : status === 'RISK'
                      ? 'bg-amber-950/30 border-amber-500/60 hover:bg-amber-950/50'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  } ${
                    isSelected ? 'ring-2 ring-blue-500 scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200 truncate">{c.name}</span>
                    <Badge variant={status.toLowerCase() as 'break' | 'risk' | 'safe'} size="sm">
                      {status}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate font-mono">
                    {c.id}
                  </span>
                  {status === 'BREAK' && finding && (
                    <div className="text-[10px] text-rose-300 font-semibold truncate mt-1">
                      {finding.field}: {finding.expectedType} → {finding.proposedType}
                    </div>
                  )}
                  {status === 'RISK' && finding && (
                    <div className="text-[10px] text-amber-300 font-semibold truncate mt-1">
                      {finding.field} removed
                    </div>
                  )}
                  {status === 'SAFE' && (
                    <span className="text-[10px] text-emerald-400/80 block mt-1">
                      Compatible
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
