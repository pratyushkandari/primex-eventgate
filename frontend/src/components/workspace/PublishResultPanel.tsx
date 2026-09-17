import { CheckCircle, XCircle, AlertTriangle, ArrowUpRight, Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { PublishResponse } from '@/types/api'

interface PublishResultPanelProps {
  publishResult: PublishResponse | null
  publishError: string | null
  onClose?: () => void
}

export function PublishResultPanel({
  publishResult,
  publishError,
}: PublishResultPanelProps) {
  if (!publishResult && !publishError) {
    return null
  }

  if (publishError) {
    return (
      <Card className="border-rose-500/50 bg-rose-950/20 shadow-xl animate-in fade-in slide-in-from-bottom-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-rose-400 flex items-center space-x-2">
              <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>EventGate Publication Error</span>
            </CardTitle>
            <Badge variant="block" size="sm">
              FAILED
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-rose-200 font-mono bg-rose-950/40 p-3 rounded border border-rose-500/20">
            {publishError}
          </p>
          <p className="text-[11px] text-slate-400">
            EventBridge publication was prevented. Downstream consumers were not invoked.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!publishResult) return null

  const isSuccess = publishResult.published && publishResult.decision === 'ALLOW'

  return (
    <Card
      className={`shadow-xl transition-all ${
        isSuccess
          ? 'border-emerald-500/50 bg-emerald-950/20'
          : 'border-rose-500/50 bg-rose-950/20'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center space-x-2">
            {isSuccess ? (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-emerald-300">Published to Amazon EventBridge</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                <span className="text-rose-300">EventBridge Publication Prevented</span>
              </>
            )}
          </CardTitle>
          <Badge variant={isSuccess ? 'safe' : 'block'} size="sm">
            {isSuccess ? 'INGESTED' : 'BLOCKED'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-slate-950/80 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">EventGate Event ID</span>
            <span className="text-slate-200 break-all select-all font-semibold">
              {publishResult.eventId}
            </span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">EventBridge Entry ID</span>
            <span className="text-blue-400 break-all select-all font-semibold">
              {publishResult.eventBridgeEventId || 'None (Publication Prevented)'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60 gap-2">
          <div className="flex items-center space-x-2">
            <Cpu className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-mono text-[11px]">
              Decision: <strong className="text-slate-200">{publishResult.decision}</strong> | Severity:{' '}
              <strong className="text-slate-200">{publishResult.severity}</strong>
            </span>
          </div>

          {publishResult.analysis?.requestId && (
            <div className="flex items-center space-x-1 font-mono text-[11px] text-slate-500">
              <ArrowUpRight className="h-3 w-3" />
              <span>Trace: {publishResult.analysis.requestId}</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/50 p-2 rounded border border-slate-800/40">
          {isSuccess
            ? 'Event successfully published to custom bus primex-eventgate-dev-bus. EventBridge rule primex-eventgate-dev-order-placed-rule matches this event and fans out to subscribed demonstration Lambdas.'
            : 'Deterministic compatibility engine intercepted breaking changes. Zero events were dispatched to Amazon EventBridge.'}
        </p>
      </CardContent>
    </Card>
  )
}
