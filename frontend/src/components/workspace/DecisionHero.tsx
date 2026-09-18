import { AlertCircle, Radio, Send, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
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
  if (isAnalyzing) {
    return (
      <Card className="h-full border-slate-800 bg-slate-900/80 flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Radio className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span>Deterministic Gate</span>
            </CardTitle>
            <Badge variant="neutral">Evaluating</Badge>
          </div>
          <CardDescription>
            Evaluating compatibility rules EVT001 - EVT008...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="h-20 w-20 rounded-full border-2 border-dashed border-blue-500/40 flex items-center justify-center animate-spin">
            <Radio className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Analyzing Compatibility</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Comparing proposed schema against all active consumer contracts in DynamoDB...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (hasJsonError) {
    return (
      <Card className="h-full border-slate-800 bg-slate-900/80 flex flex-col justify-between">
        <div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Radio className="h-4 w-4 text-amber-400" />
                <span>Deterministic Gate</span>
              </CardTitle>
              <Badge variant="review">Invalid JSON</Badge>
            </div>
            <CardDescription>
              Payload syntax error detected
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">Invalid Payload</h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Fix JSON syntax to analyze.
              </p>
            </div>
          </CardContent>
        </div>
        <div className="p-5 pt-0">
          <Button variant="outline" disabled className="w-full opacity-40 cursor-not-allowed" size="md">
            Fix invalid JSON before publishing
          </Button>
          <p className="text-[11px] text-slate-500 text-center mt-2">
            Payload syntax must be valid before publishing
          </p>
        </div>
      </Card>
    )
  }

  if (!analysis) {
    return (
      <Card className="h-full border-slate-800 bg-slate-900/80 flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Radio className="h-4 w-4 text-indigo-400" />
              <span>Deterministic Gate</span>
            </CardTitle>
            <Badge variant="neutral">Standby</Badge>
          </div>
          <CardDescription>
            Awaiting schema analysis request
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500">
            <Radio className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-300">Ready to Analyze</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Click &quot;Analyze Compatibility&quot; to test your proposed schema changes against downstream consumers.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { decision, severity, summary } = analysis

  return (
    <Card className="h-full border-slate-800 bg-slate-900/80 flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Radio className="h-4 w-4 text-indigo-400" />
              <span>Deterministic Gate</span>
            </CardTitle>
            <Badge variant={decision.toLowerCase() as 'allow' | 'block' | 'review'}>
              {decision}
            </Badge>
          </div>
          <CardDescription>
            Authoritative decision based on consumer contract consensus
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          {decision === 'ALLOW' && (
            <>
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <ShieldCheck className="h-10 w-10 text-emerald-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold font-mono text-emerald-400 tracking-wider">
                  ALLOW
                </span>
                <h3 className="text-base font-semibold text-white mt-1">Safe to Publish</h3>
                <p className="text-xs text-slate-300 max-w-xs mt-1.5 leading-relaxed">
                  {summary}
                </p>
              </div>
              <Badge variant="safe" size="md">
                SEVERITY: {severity}
              </Badge>
            </>
          )}

          {decision === 'BLOCK' && (
            <>
              <div className="h-20 w-20 rounded-full bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/10">
                <ShieldAlert className="h-10 w-10 text-rose-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold font-mono text-rose-400 tracking-wider">
                  BLOCK
                </span>
                <h3 className="text-base font-semibold text-white mt-1">
                  Breaking Change Intercepted
                </h3>
                <p className="text-xs text-slate-300 max-w-xs mt-1.5 leading-relaxed">
                  {summary}
                </p>
              </div>
              <Badge variant="block" size="md">
                SEVERITY: {severity}
              </Badge>
              <p className="text-xs text-rose-400/90 font-medium">
                EventBridge publication is prevented.
              </p>
            </>
          )}

          {decision === 'REVIEW' && (
            <>
              <div className="h-20 w-20 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
                <ShieldQuestion className="h-10 w-10 text-amber-400" />
              </div>
              <div>
                <span className="text-3xl font-extrabold font-mono text-amber-400 tracking-wider">
                  REVIEW
                </span>
                <h3 className="text-base font-semibold text-white mt-1">
                  Review Required
                </h3>
                <p className="text-xs text-slate-300 max-w-xs mt-1.5 leading-relaxed">
                  {summary}
                </p>
              </div>
              <Badge variant="review" size="md">
                SEVERITY: {severity}
              </Badge>
              <p className="text-xs text-amber-400/90 font-medium">
                Publication prevented pending future review.
              </p>
            </>
          )}
        </CardContent>
      </div>

      {/* Gated Publish Action Area */}
      <div className="p-5 pt-0">
        {decision === 'ALLOW' ? (
          <div>
            <Button
              variant="success"
              onClick={onPublish}
              disabled={hasJsonError || isPublishing}
              isLoading={isPublishing}
              className="w-full shadow-lg shadow-emerald-950/40 cursor-pointer"
              size="md"
            >
              <Send className="h-4 w-4 mr-2" />
              <span>Publish Event to EventBridge</span>
            </Button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Enforces gate and triggers EventBridge fan-out
            </p>
          </div>
        ) : (
          <div>
            <Button variant="outline" disabled className="w-full opacity-40 cursor-not-allowed" size="md">
              Publication Prevented by Gate
            </Button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Only verified ALLOW events can be published to EventBridge
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
