import { Send, AlertOctagon, CheckCircle2, AlertTriangle, Radio, ShieldCheck, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { AnalysisResponse, Environment } from '@/types/api'

interface DecisionHeroProps {
  analysis: AnalysisResponse | null
  isAnalyzing: boolean
  isPublishing: boolean
  hasJsonError?: boolean
  onPublish: () => void
  environment?: Environment
}

export function DecisionHero({
  analysis,
  isAnalyzing,
  isPublishing,
  hasJsonError = false,
  onPublish,
  environment = 'production',
}: DecisionHeroProps) {
  // State: Loading / Analyzing
  if (isAnalyzing) {
    return (
      <Card className="h-full flex flex-col justify-between border-slate-800 bg-[#0c1220]/80 backdrop-blur-sm shadow-md">
        <div>
          <CardHeader className="py-3 px-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Radio className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                <span>Release Decision</span>
              </CardTitle>
              <Badge variant="neutral" size="sm">
                Evaluating
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="p-5 rounded border border-slate-800 bg-slate-950/60 text-center space-y-2.5">
              <div className="inline-block h-6 w-6 border-2 border-blue-500/40 border-t-blue-400 rounded-full animate-spin" />
              <h4 className="text-xs font-semibold text-slate-200 font-mono">
                Analyzing Compatibility
              </h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed font-sans">
                Comparing proposed schema against registered consumer contracts in DynamoDB...
              </p>
            </div>
          </CardContent>
        </div>

        <div className="p-4 pt-0">
          <Button variant="outline" disabled className="w-full opacity-40 cursor-not-allowed" size="sm">
            Evaluating contracts...
          </Button>
        </div>
      </Card>
    )
  }

  // State: Invalid Payload JSON Error
  if (hasJsonError) {
    return (
      <Card className="h-full flex flex-col justify-between border-slate-800 border-l-2 border-l-amber-500 bg-[#0c1220]/80 backdrop-blur-sm shadow-md">
        <div>
          <CardHeader className="py-3 px-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span>Release Decision</span>
              </CardTitle>
              <Badge variant="risk" size="sm">
                Invalid JSON
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            <div className="p-3.5 rounded border border-amber-500/30 bg-amber-950/20 space-y-1">
              <span className="text-xs font-mono uppercase text-amber-400 font-bold block">
                Invalid Payload
              </span>
              <p className="text-xs text-slate-300 font-sans">
                Fix JSON syntax to analyze.
              </p>
            </div>
          </CardContent>
        </div>

        <div className="p-4 pt-0">
          <Button variant="outline" disabled className="w-full opacity-40 cursor-not-allowed" size="sm">
            Fix invalid JSON before publishing
          </Button>
          <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono">
            Payload syntax must be valid before publishing
          </p>
        </div>
      </Card>
    )
  }

  // State: Idle / Standby
  if (!analysis) {
    return (
      <Card className="h-full flex flex-col justify-between border-slate-800 bg-[#0c1220]/80 backdrop-blur-sm shadow-md">
        <div>
          <CardHeader className="py-3 px-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                <span>Release Decision</span>
              </CardTitle>
              <Badge variant="neutral" size="sm">
                Standby
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            <div className="p-4 rounded border border-slate-800 bg-slate-950/50 space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-200 font-mono flex items-center space-x-1.5">
                <span>Ready to Analyze</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Select an event version and click &quot;Analyze Compatibility&quot; (or press Ctrl+Enter) to evaluate schema changes against downstream consumers.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                <span className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">Pre-flight check</span>
                <span>•</span>
                <span>Deterministic rules</span>
              </div>
            </div>
          </CardContent>
        </div>

        <div className="p-4 pt-0">
          <Button variant="outline" disabled className="w-full opacity-40 cursor-not-allowed" size="sm">
            Awaiting analysis
          </Button>
        </div>
      </Card>
    )
  }

  const { decision, severity, summary, compatibilityResult, policyName, policyReason } = analysis
  const primaryBreak = analysis.findings.find((f) => f.status === 'BREAK')
  const primaryRisk = analysis.findings.find((f) => f.status === 'RISK')

  return (
    <Card
      className={`h-full flex flex-col justify-between border-slate-800 bg-[#0c1220]/80 backdrop-blur-sm shadow-md ${
        decision === 'ALLOW'
          ? 'border-l-2 border-l-emerald-500 shadow-emerald-950/20'
          : decision === 'BLOCK'
          ? 'border-l-2 border-l-rose-500 shadow-rose-950/20'
          : 'border-l-2 border-l-amber-500 shadow-amber-950/20'
      }`}
    >
      <div>
        <CardHeader className="py-3 px-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              {decision === 'ALLOW' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : decision === 'BLOCK' ? (
                <Lock className="h-3.5 w-3.5 text-rose-400" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              )}
              <span>Release Decision</span>
            </CardTitle>
            <Badge variant={decision.toLowerCase() as 'allow' | 'block' | 'review'} size="sm">
              {decision}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3 font-mono">
          {/* Final Decision Banner — strongest visual element */}
          <div
            className={`p-3.5 rounded border space-y-2 ${
              decision === 'ALLOW'
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : decision === 'BLOCK'
                ? 'border-rose-500/30 bg-rose-950/20'
                : 'border-amber-500/30 bg-amber-950/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {decision === 'ALLOW' && <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
                {decision === 'BLOCK' && <AlertOctagon className="h-4 w-4 text-rose-400 flex-shrink-0" />}
                {decision === 'REVIEW' && <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />}
                <span
                  className={`text-lg font-bold tracking-wide font-mono ${
                    decision === 'ALLOW' ? 'text-emerald-400' : decision === 'BLOCK' ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {decision}
                </span>
              </div>
              <Badge
                variant={decision === 'ALLOW' ? 'safe' : decision === 'BLOCK' ? 'block' : 'review'}
                size="sm"
              >
                SEVERITY: {severity}
              </Badge>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-100 font-sans">
                {decision === 'ALLOW'
                  ? 'Publication permitted.'
                  : decision === 'BLOCK'
                  ? 'Publication prevented.'
                  : 'Publication held pending review.'}
              </h4>
              {decision === 'ALLOW' && (
                <div className="text-[10px] font-mono mt-0.5 text-emerald-400">
                  Event path: EventGate → EventBridge → Consumers
                </div>
              )}
              {decision === 'BLOCK' && (
                <div className="text-[10px] font-mono mt-0.5 text-rose-400">
                  EventBridge: NOT CALLED · Consumers: NOT REACHED
                </div>
              )}
              {decision === 'REVIEW' && (
                <div className="text-[10px] font-mono mt-0.5 text-amber-400">
                  EventBridge: NOT CALLED · Consumers: NOT REACHED
                </div>
              )}
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-sans">
                {summary}
              </p>
            </div>

            {/* Primary breaking or risk finding */}
            {decision === 'BLOCK' && primaryBreak && (
              <div className="p-2 rounded bg-rose-950/40 border border-rose-500/20 text-xs font-mono space-y-0.5">
                <div className="text-slate-200 font-semibold">{primaryBreak.consumerId}</div>
                <div className="text-rose-300 text-[11px]">
                  {primaryBreak.field}
                  {primaryBreak.expectedType && primaryBreak.proposedType && (
                    <span className="text-slate-400 ml-1.5 font-normal">
                      ({primaryBreak.expectedType} → {primaryBreak.proposedType})
                    </span>
                  )}
                </div>
              </div>
            )}
            {decision === 'REVIEW' && primaryRisk && (
              <div className="p-2 rounded bg-amber-950/40 border border-amber-500/20 text-xs font-mono space-y-0.5">
                <div className="text-slate-200 font-semibold">{primaryRisk.consumerId}</div>
                <div className="text-amber-300 text-[11px]">
                  {primaryRisk.field}
                  <span className="text-slate-400 ml-1.5 font-normal">
                    (field dependency detected)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Two-Tier Breakdown: Compatibility + Policy */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Compatibility Result */}
            <div className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                Compatibility
              </div>
              <div
                className={`font-bold text-xs ${
                  (compatibilityResult || 'SAFE') === 'SAFE'
                    ? 'text-emerald-400'
                    : (compatibilityResult || '') === 'BREAK'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {compatibilityResult || (decision === 'ALLOW' ? 'SAFE' : decision === 'BLOCK' ? 'BREAK' : 'RISK')}
              </div>
              <div className="text-[10px] text-slate-500">
                Severity: {severity}
              </div>
            </div>

            {/* Release Policy */}
            <div className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                Release Policy
              </div>
              <div
                className={`font-bold text-xs ${
                  decision === 'ALLOW'
                    ? 'text-emerald-400'
                    : decision === 'BLOCK'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {decision}
              </div>
              <div className="text-[10px] text-slate-500 truncate" title={policyName || undefined}>
                {policyName || `${environment} policy`}
              </div>
            </div>
          </div>

          {/* Policy Reason */}
          {policyReason && (
            <div className="p-2 rounded border border-slate-800/60 bg-slate-950/40 text-[11px] text-slate-400 font-sans leading-relaxed">
              <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block mb-0.5">
                Policy Reason
              </span>
              {policyReason}
            </div>
          )}

          {/* Environment Context */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Environment: {environment}</span>
            {analysis.requestId && (
              <span className="truncate ml-2" title={analysis.requestId}>
                Request: {analysis.requestId.substring(0, 12)}...
              </span>
            )}
          </div>
        </CardContent>
      </div>

      {/* Action / Publish Area */}
      <div className="p-4 pt-0">
        {decision === 'ALLOW' ? (
          <div>
            <Button
              variant="success"
              onClick={onPublish}
              disabled={hasJsonError || isPublishing}
              isLoading={isPublishing}
              className="w-full shadow-lg"
              size="sm"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              <span>Publish Event</span>
            </Button>
            <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono">
              Publication permitted to Amazon EventBridge bus
            </p>
          </div>
        ) : (
          <div>
            <Button
              variant="outline"
              disabled
              className="w-full opacity-40 cursor-not-allowed text-xs font-mono"
              size="sm"
            >
              {decision === 'BLOCK' ? 'Publication prevented' : 'Publication held pending review'}
            </Button>
            <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono">
              {decision === 'BLOCK'
                ? 'Publication prevented before EventBridge PutEvents'
                : 'Publication held pending review before EventBridge PutEvents'}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
