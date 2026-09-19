import * as React from 'react'
import { CheckCircle2, Copy, Check, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { PublishResponse } from '@/types/api'

interface PublishResultPanelProps {
  publishResult: PublishResponse | null
  publishError: string | null
  analysisId?: string
}

export function PublishResultPanel({
  publishResult,
  publishError,
  analysisId: propAnalysisId,
}: PublishResultPanelProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  const handleCopy = React.useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // fallback
    }
  }, [])

  if (!publishResult && !publishError) {
    return null
  }

  // Publication Error state
  if (publishError) {
    const is422 = publishError.includes('422') || publishError.toLowerCase().includes('payload')
    const is409 = publishError.includes('409') || publishError.toLowerCase().includes('prevented')
    const is503 = publishError.includes('503') || publishError.toLowerCase().includes('did not complete')

    const title = is422
      ? 'Payload Rejected'
      : is409
      ? 'Publication Prevented'
      : is503
      ? 'Publication Failed'
      : 'Publication Error'

    const badgeLabel = is422
      ? 'HTTP 422'
      : is409
      ? 'HTTP 409'
      : is503
      ? 'HTTP 503'
      : 'FAILED'

    return (
      <Card className="border-rose-500/40 bg-rose-950/20">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-rose-400 flex items-center space-x-2">
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
              <span>EventGate Publication Error — {title}</span>
            </CardTitle>
            <div className="flex items-center space-x-1.5">
              <Badge variant="block" size="sm">
                FAILED
              </Badge>
              <Badge variant="neutral" size="sm">
                {badgeLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-rose-200 font-mono bg-rose-950/40 p-2.5 rounded border border-rose-500/20 break-words">
            {publishError}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {is422
              ? 'Payload failed schema validation. Fix payload structure before re-publishing.'
              : is409
              ? 'Publication prevented before EventBridge PutEvents. Zero downstream consumers were invoked.'
              : is503
              ? 'EventBridge publication did not complete successfully. Retry the operation.'
              : 'EventBridge publication was not executed.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!publishResult) return null

  const { eventId, eventBridgeEventId, analysis } = publishResult
  const requestId = analysis?.requestId || null
  const analysisId = propAnalysisId || analysis?.analysisId || null

  return (
    <Card className="border-emerald-500/40 bg-emerald-950/10">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-200">
              Published to Amazon EventBridge
            </CardTitle>
          </div>
          <Badge variant="safe" size="sm">
            INGESTED
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3 font-mono text-xs">
        {/* IDs Strip */}
        <div className={`grid grid-cols-1 ${analysisId ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-2.5`}>
          {/* Event ID */}
          <div className="p-2.5 rounded border border-slate-800 bg-[#0a0e17] space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase">
              <span>Event ID</span>
              <button
                type="button"
                onClick={() => handleCopy('eventId', eventId)}
                title="Copy event ID"
                className="hover:text-slate-200 flex items-center space-x-1 cursor-pointer transition-colors"
              >
                {copiedKey === 'eventId' ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{copiedKey === 'eventId' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="font-semibold text-slate-200 break-all select-all">
              {eventId}
            </div>
          </div>

          {/* EventBridge ID */}
          <div className="p-2.5 rounded border border-slate-800 bg-[#0a0e17] space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase">
              <span>EventBridge ID</span>
              {eventBridgeEventId && (
                <button
                  type="button"
                  onClick={() => handleCopy('ebId', eventBridgeEventId)}
                  title="Copy EventBridge ID"
                  className="hover:text-slate-200 flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  {copiedKey === 'ebId' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'ebId' ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
            <div className="font-semibold text-blue-400 break-all select-all">
              {eventBridgeEventId || 'None'}
            </div>
          </div>

          {/* Request ID */}
          <div className="p-2.5 rounded border border-slate-800 bg-[#0a0e17] space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase">
              <span>Request ID</span>
              {requestId && (
                <button
                  type="button"
                  onClick={() => handleCopy('reqId', requestId)}
                  title="Copy request ID"
                  className="hover:text-slate-200 flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  {copiedKey === 'reqId' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'reqId' ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
            <div className="text-slate-400 break-all select-all">
              {requestId ? `Request ID: ${requestId}` : 'N/A'}
            </div>
          </div>

          {/* Analysis ID */}
          {analysisId && (
            <div className="p-2.5 rounded border border-slate-800 bg-[#0a0e17] space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase">
                <span>Analysis ID</span>
                <button
                  type="button"
                  onClick={() => handleCopy('analysisId', analysisId)}
                  title="Copy analysis ID"
                  className="hover:text-slate-200 flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  {copiedKey === 'analysisId' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'analysisId' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-purple-400 break-all select-all font-semibold">
                {analysisId}
              </div>
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 gap-1">
          <span>Destination: primex-eventgate-dev-bus</span>
          <span>Status: Ingested & fanning out to subscribed lambdas</span>
        </div>
      </CardContent>
    </Card>
  )
}
