import { ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Decision, Environment } from '@/types/api'

interface EventPathProps {
  decision: Decision | null
  isPublished: boolean
  environment?: Environment
}

export function EventPath({ decision, isPublished, environment = 'production' }: EventPathProps) {
  const isBlocked = decision === 'BLOCK' || decision === 'REVIEW'
  const isAllowed = decision === 'ALLOW'

  return (
    <Card className="border-slate-800">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300">
            Event path
          </CardTitle>
          <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500">
            <span>{environment}</span>
            <span>•</span>
            <span>Bus: primex-eventgate-dev-bus</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center text-xs font-mono">
          {/* Node 1: API Gateway */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded p-2.5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block">Producer</span>
            <span className="font-semibold text-slate-200 block">API Gateway</span>
            <span className="text-[10px] text-slate-400 block font-mono">
              POST /events/publish
            </span>
          </div>

          {/* Transition 1 */}
          <div className="hidden md:flex justify-center text-slate-600">
            <ArrowRight className="h-4 w-4" />
          </div>

          {/* Node 2: EventGate */}
          <div
            className={`border rounded p-2.5 space-y-1 transition-colors ${
              decision === 'ALLOW'
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : decision === 'BLOCK'
                ? 'bg-rose-950/20 border-rose-500/40'
                : decision === 'REVIEW'
                ? 'bg-amber-950/20 border-amber-500/40'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase block">Gate</span>
              {decision === 'ALLOW' && (
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
              )}
              {decision === 'BLOCK' && (
                <ShieldAlert className="h-3 w-3 text-rose-400" />
              )}
              {decision === 'REVIEW' && (
                <ShieldQuestion className="h-3 w-3 text-amber-400" />
              )}
            </div>
            <span className="font-semibold text-slate-200 block">EventGate</span>
            <span
              className={`text-[10px] block font-mono ${
                decision === 'ALLOW'
                  ? 'text-emerald-400 font-medium'
                  : decision === 'BLOCK'
                  ? 'text-rose-400 font-medium'
                  : decision === 'REVIEW'
                  ? 'text-amber-400 font-medium'
                  : 'text-slate-500'
              }`}
            >
              {decision ? `decision: ${decision}` : 'Awaiting analysis'}
            </span>
          </div>

          {/* Transition 2 */}
          <div className="hidden md:flex justify-center">
            {isBlocked ? (
              <span
                title="Publication prevented by Gate"
                className="text-rose-500 text-xs font-bold select-none"
              >
                ✕
              </span>
            ) : isAllowed ? (
              <ArrowRight className="h-4 w-4 text-emerald-400" />
            ) : (
              <ArrowRight className="h-4 w-4 text-slate-700" />
            )}
          </div>

          {/* Node 3: EventBridge */}
          <div
            className={`border rounded p-2.5 space-y-1 transition-colors ${
              isPublished
                ? 'bg-emerald-950/30 border-emerald-500/50'
                : isBlocked
                ? 'bg-rose-950/20 border-rose-500/30'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase block">Broker</span>
              {isPublished && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
              {isBlocked && <span className="text-[10px] text-rose-400 font-bold">HALTED</span>}
            </div>
            <span className="font-semibold text-slate-200 block">EventBridge</span>
            <span
              className={`text-[10px] block font-mono ${
                isPublished
                  ? 'text-emerald-400 font-medium'
                  : isBlocked
                  ? 'text-rose-400 font-medium'
                  : 'text-slate-400'
              }`}
            >
              {isPublished
                ? 'INGESTED'
                : isBlocked
                ? 'NOT CALLED'
                : 'primex-eventgate-dev-bus'}
            </span>
            <span className="text-[9px] text-slate-500 block">
              {isPublished
                ? 'Ingested to bus'
                : isBlocked
                ? 'Traffic halted'
                : 'Custom event bus'}
            </span>
          </div>

          {/* Transition 3 */}
          <div className="hidden md:flex justify-center">
            {isPublished ? (
              <ArrowRight className="h-4 w-4 text-emerald-400" />
            ) : isBlocked ? (
              <span className="text-slate-700 text-xs select-none">—</span>
            ) : (
              <ArrowRight className="h-4 w-4 text-slate-700" />
            )}
          </div>

          {/* Node 4: Consumers */}
          <div
            className={`border rounded p-2.5 space-y-1 transition-colors ${
              isPublished
                ? 'bg-emerald-950/30 border-emerald-500/50'
                : isBlocked
                ? 'bg-slate-950/30 border-slate-800/60 opacity-50'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase block">Subscribers</span>
              {isPublished ? (
                <Badge variant="safe" size="sm">
                  DELIVERED
                </Badge>
              ) : isBlocked ? (
                <span className="text-[10px] text-slate-500 font-mono">BLOCKED</span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">TARGETS</span>
              )}
            </div>
            <span className="font-semibold text-slate-200 block">Consumers</span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {isPublished
                ? 'Billing · Inventory · Analytics'
                : isBlocked
                ? 'NOT REACHED'
                : '3 registered targets'}
            </span>
            <span className="text-[9px] text-slate-500 block">
              {isPublished
                ? 'Verified via CloudWatch logs'
                : isBlocked
                ? 'Zero propagation'
                : 'Registered consumer contracts'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
