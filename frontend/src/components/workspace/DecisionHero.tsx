import { Send, AlertOctagon, CheckCircle2, AlertTriangle, Radio } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { AnalysisResponse } from '@/types/api'

interface DecisionHeroProps {
  analysis: AnalysisResponse | null
  isAnalyzing: boolean
  isPublishing: boolean
  hasJsonError?: boolean
  onPublish: () => void
}

export function DecisionHero({
  analysis,
  isAnalyzing,
  isPublishing,
  hasJsonError = false,
  onPublish,
}: DecisionHeroProps) {
  // State: Loading / Analyzing
  if (isAnalyzing) {
    return (
      <Card className="h-full flex flex-col justify-between border-slate-800">
        <div>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Radio className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                <span>Release decision</span>
              </CardTitle>
              <Badge variant="neutral" size="sm">
                Evaluating
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="p-4 rounded border border-slate-800 bg-slate-950/60 text-center space-y-2">
              <div className="inline-block h-6 w-6 border-2 border-blue-500/40 border-t-blue-400 rounded-full animate-spin" />
              <h4 className="text-xs font-semibold text-slate-200 font-mono">
                Analyzing Compatibility
              </h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Comparing proposed schema against registered consumer contracts...
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
      <Card className="h-full flex flex-col justify-between border-slate-800 border-l-2 border-l-amber-500">
        <div>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span>Release decision</span>
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
              <p className="text-xs text-slate-300">
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
      <Card className="h-full flex flex-col justify-between border-slate-800">
        <div>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300">
                Release decision
              </CardTitle>
              <Badge variant="neutral" size="sm">
                Standby
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            <div className="p-3.5 rounded border border-slate-800 bg-slate-950/50 space-y-1">
              <h4 className="text-xs font-semibold text-slate-300 font-mono">
                Ready to Analyze
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                No analysis yet. Choose an event version and click &quot;Analyze change&quot; to test proposed schema evolution against downstream consumers.
              </p>
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

  const { decision, severity, summary } = analysis
  const primaryBreak = analysis.findings.find((f) => f.status === 'BREAK')
  const primaryRisk = analysis.findings.find((f) => f.status === 'RISK')

  return (
    <Card
      className={`h-full flex flex-col justify-between border-slate-800 ${
        decision === 'ALLOW'
          ? 'border-l-2 border-l-emerald-500'
          : decision === 'BLOCK'
          ? 'border-l-2 border-l-rose-500'
          : 'border-l-2 border-l-amber-500'
      }`}
    >
      <div>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Release decision
            </CardTitle>
            <Badge variant={decision.toLowerCase() as 'allow' | 'block' | 'review'} size="sm">
              {decision}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3 font-mono">
          {/* Main Decision Status Banner */}
          {decision === 'ALLOW' && (
            <div className="p-3.5 rounded border border-emerald-500/30 bg-emerald-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-lg font-bold text-emerald-400 tracking-wide font-mono">
                    ALLOW
                  </span>
                </div>
                <Badge variant="safe" size="sm">
                  SEVERITY: {severity}
                </Badge>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-100 font-sans">
                  Safe to Publish
                </h4>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-sans">
                  {summary}
                </p>
                <div className="mt-2 text-[10px] text-emerald-400 font-mono">
                  All registered consumers are compatible.
                </div>
              </div>
            </div>
          )}

          {decision === 'BLOCK' && (
            <div className="p-3.5 rounded border border-rose-500/30 bg-rose-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertOctagon className="h-4 w-4 text-rose-400 flex-shrink-0" />
                  <span className="text-lg font-bold text-rose-400 tracking-wide font-mono">
                    BLOCK
                  </span>
                </div>
                <Badge variant="block" size="sm">
                  SEVERITY: {severity}
                </Badge>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-100 font-sans">
                  Breaking Change Intercepted
                </h4>
                <div className="text-[10px] text-rose-400 font-mono mt-0.5">
                  Publication prevented
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-sans">
                  {summary}
                </p>
                {primaryBreak && (
                  <div className="mt-2 p-2 rounded bg-rose-950/40 border border-rose-500/20 text-xs font-mono space-y-0.5">
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
                <p className="text-[10px] text-rose-400 mt-1.5">
                  EventBridge publication is prevented.
                </p>
              </div>
            </div>
          )}

          {decision === 'REVIEW' && (
            <div className="p-3.5 rounded border border-amber-500/30 bg-amber-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <span className="text-lg font-bold text-amber-400 tracking-wide font-mono">
                    REVIEW
                  </span>
                </div>
                <Badge variant="review" size="sm">
                  SEVERITY: {severity}
                </Badge>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-100 font-sans">
                  Review Required
                </h4>
                <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                  Publication prevented pending review
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-sans">
                  {summary}
                </p>
                {primaryRisk && (
                  <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-500/20 text-xs font-mono space-y-0.5">
                    <div className="text-slate-200 font-semibold">{primaryRisk.consumerId}</div>
                    <div className="text-amber-300 text-[11px]">
                      {primaryRisk.field}
                      <span className="text-slate-400 ml-1.5 font-normal">
                        (field dependency detected)
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-amber-400 mt-1.5">
                  Publication prevented pending future review.
                </p>
              </div>
            </div>
          )}
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
              className="w-full"
              size="sm"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              <span>Publish Event to EventBridge</span>
            </Button>
            <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono">
              Enforces gate and triggers EventBridge fan-out
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
              Publication Prevented by Gate
            </Button>
            <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono">
              Only verified ALLOW events can be published to EventBridge
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
