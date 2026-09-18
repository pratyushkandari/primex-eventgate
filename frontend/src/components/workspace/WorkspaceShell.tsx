import * as React from 'react'
import { Header } from '@/components/layout/Header'
import { ScenarioSelector } from '@/components/workspace/ScenarioSelector'
import { EventInputPanel } from '@/components/workspace/EventInputPanel'
import { DecisionHero } from '@/components/workspace/DecisionHero'
import { ConsumerImpactPanel } from '@/components/workspace/ConsumerImpactPanel'
import { FindingsPanel } from '@/components/workspace/FindingsPanel'
import { PublishResultPanel } from '@/components/workspace/PublishResultPanel'
import { EventPath } from '@/components/workspace/EventPath'
import { DEMO_SCENARIOS, type DemoScenario } from '@/data/scenarios'
import { eventGateApi } from '@/services/api'
import { type AnalysisResponse, type PublishResponse, type Decision, EventGateApiError } from '@/types/api'
import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface SessionReviewItem {
  id: string
  eventType: string
  currentVersion: number
  proposedVersion: number
  decision: Decision
  timestamp: string
}

export function WorkspaceShell() {
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<DemoScenario['id']>('safe')
  const [eventType] = React.useState<string>('OrderPlaced')
  const [currentVersion] = React.useState<number>(1)
  const [proposedVersion, setProposedVersion] = React.useState<number>(2)
  const [payloadText, setPayloadText] = React.useState<string>(() =>
    JSON.stringify(DEMO_SCENARIOS.safe.samplePayload, null, 2)
  )
  const [jsonError, setJsonError] = React.useState<string | null>(null)

  // API State
  const [isAnalyzing, setIsAnalyzing] = React.useState<boolean>(false)
  const [analysis, setAnalysis] = React.useState<AnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = React.useState<string | null>(null)

  const [isPublishing, setIsPublishing] = React.useState<boolean>(false)
  const [publishResult, setPublishResult] = React.useState<PublishResponse | null>(null)
  const [publishError, setPublishError] = React.useState<string | null>(null)

  // Session History (P2 - browser tab session only)
  const [sessionHistory, setSessionHistory] = React.useState<SessionReviewItem[]>([])

  // Scenario selection handler
  const handleSelectScenario = React.useCallback((scenario: DemoScenario) => {
    setSelectedScenarioId(scenario.id)
    setProposedVersion(scenario.proposedVersion)
    setPayloadText(JSON.stringify(scenario.samplePayload, null, 2))
    setJsonError(null)
    setAnalysis(null)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)
  }, [])

  // Proposed version selector change
  const handleProposedVersionChange = React.useCallback((newVersion: number) => {
    setProposedVersion(newVersion)
    setAnalysis(null)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)
  }, [])

  // Payload text change with local JSON validation
  const handlePayloadTextChange = React.useCallback((text: string) => {
    setPayloadText(text)
    try {
      JSON.parse(text)
      setJsonError(null)
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax')
      setAnalysis(null)
      setAnalysisError(null)
      setPublishResult(null)
      setPublishError(null)
    }
  }, [])

  // Format JSON helper
  const handleFormatPayload = React.useCallback(() => {
    try {
      const parsed = JSON.parse(payloadText)
      setPayloadText(JSON.stringify(parsed, null, 2))
      setJsonError(null)
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax')
      setAnalysis(null)
      setAnalysisError(null)
      setPublishResult(null)
      setPublishError(null)
    }
  }, [payloadText])

  // Reset payload to current scenario default
  const handleResetPayload = React.useCallback(() => {
    const scenario = DEMO_SCENARIOS[selectedScenarioId]
    setPayloadText(JSON.stringify(scenario.samplePayload, null, 2))
    setJsonError(null)
  }, [selectedScenarioId])

  // Compatibility analysis trigger
  const handleAnalyze = React.useCallback(async () => {
    if (jsonError) return

    setIsAnalyzing(true)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)

    try {
      const res = await eventGateApi.analyzeCompatibility({
        eventType,
        currentVersion,
        proposedVersion,
      })
      setAnalysis(res)

      // Record in local session history (P2)
      setSessionHistory((prev) => [
        {
          id: `${eventType}-${currentVersion}-${proposedVersion}-${Date.now()}`,
          eventType,
          currentVersion,
          proposedVersion,
          decision: res.decision,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prev.slice(0, 4),
      ])
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis request failed')
      setAnalysis(null)
    } finally {
      setIsAnalyzing(false)
    }
  }, [eventType, currentVersion, proposedVersion, jsonError])

  // Gated publish trigger
  const handlePublish = React.useCallback(async () => {
    if (jsonError) return
    if (!analysis || analysis.decision !== 'ALLOW') return

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(payloadText)
    } catch {
      setPublishError('Payload rejected (422): Cannot publish malformed JSON payload')
      return
    }

    setIsPublishing(true)
    setPublishError(null)
    setPublishResult(null)

    try {
      const res = await eventGateApi.publishEvent({
        eventType,
        currentVersion,
        proposedVersion,
        payload: parsedPayload,
      })
      setPublishResult(res)
    } catch (err) {
      const statusCode =
        err instanceof EventGateApiError
          ? err.statusCode
          : typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode: unknown }).statusCode)
          : undefined

      if (statusCode === 422) {
        setPublishError(`Payload rejected (422): ${(err as Error).message}`)
      } else if (statusCode === 409) {
        setPublishError(`Publication prevented (409): ${(err as Error).message}`)
      } else if (statusCode === 503) {
        setPublishError('Publication failed (503): EventBridge publication did not complete successfully.')
      } else {
        setPublishError(err instanceof Error ? err.message : 'Event publication request failed')
      }
    } finally {
      setIsPublishing(false)
    }
  }, [analysis, eventType, currentVersion, proposedVersion, payloadText, jsonError])

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Scenario Toolbar */}
        <ScenarioSelector
          selectedScenario={selectedScenarioId}
          onSelectScenario={handleSelectScenario}
          disabled={isAnalyzing || isPublishing}
        />

        {/* Global Analysis Error Banner */}
        {analysisError && (
          <div className="bg-rose-950/30 border border-rose-500/50 rounded-lg p-3 flex items-start space-x-2.5 text-xs text-rose-300 font-mono">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Compatibility Analysis Failed</span>
              <p>{analysisError}</p>
            </div>
          </div>
        )}

        {/* Change Review Overview Strip (Section 19) */}
        {analysis && (
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-3 px-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono shadow-sm">
            <div className="flex items-center space-x-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
                Change Review
              </span>
              <div className="text-slate-200">
                <span className="font-semibold text-blue-400">{analysis.eventType}</span>{' '}
                <span className="text-slate-400">v{analysis.currentVersion} → v{analysis.proposedVersion}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5 text-slate-300">
                <span className="text-slate-500">Impact:</span>
                <span className="font-semibold text-slate-200">
                  {analysis.findings.filter((f) => f.status !== 'SAFE').length}{' '}
                  {analysis.findings.filter((f) => f.status !== 'SAFE').length === 1 ? 'consumer affected' : 'consumers affected'}
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Decision:</span>
                <Badge variant={analysis.decision.toLowerCase() as 'allow' | 'block' | 'review'} size="sm">
                  {analysis.decision}
                </Badge>
              </div>

              {analysis.findings.find((f) => f.status !== 'SAFE') && (
                <div className="text-slate-400 text-[11px] truncate max-w-sm font-sans hidden sm:block">
                  Reason: {analysis.findings.find((f) => f.status !== 'SAFE')?.reason}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3-Column Engineering Console Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Column 1: Contract Change & Code Editor (Col 4) */}
          <div className="lg:col-span-4 flex flex-col">
            <EventInputPanel
              eventType={eventType}
              currentVersion={currentVersion}
              proposedVersion={proposedVersion}
              payloadText={payloadText}
              jsonError={jsonError}
              isAnalyzing={isAnalyzing}
              onProposedVersionChange={handleProposedVersionChange}
              onPayloadTextChange={handlePayloadTextChange}
              onFormatPayload={handleFormatPayload}
              onResetPayload={handleResetPayload}
              onAnalyze={handleAnalyze}
            />
          </div>

          {/* Column 2: Release Decision Gate (Col 4) */}
          <div className="lg:col-span-4 flex flex-col">
            <DecisionHero
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              isPublishing={isPublishing}
              hasJsonError={Boolean(jsonError)}
              onPublish={handlePublish}
            />
          </div>

          {/* Column 3: Downstream Consumers (Col 4) */}
          <div className="lg:col-span-4 flex flex-col">
            <ConsumerImpactPanel analysis={analysis} />
          </div>
        </div>

        {/* Live Publication Outcome Section */}
        <PublishResultPanel
          publishResult={publishResult}
          publishError={publishError}
        />

        {/* Compatibility Findings & Schema Diff */}
        {analysis && <FindingsPanel analysis={analysis} />}

        {/* Event Path Pipeline Strip */}
        <EventPath
          decision={analysis?.decision ?? null}
          isPublished={Boolean(publishResult?.published)}
        />

        {/* Optional Session History (Section 20 - browser tab session only) */}
        {sessionHistory.length > 0 && (
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5 px-3.5 text-xs font-mono">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Recent Reviews
              </span>
              <span className="text-[10px] text-slate-500">
                Browser session history • local tab only
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sessionHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center space-x-2 bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-[11px]"
                >
                  <span className="text-slate-200 font-medium">{item.eventType}</span>
                  <span className="text-slate-500">v{item.currentVersion} → v{item.proposedVersion}</span>
                  <Badge variant={item.decision.toLowerCase() as 'allow' | 'block' | 'review'} size="sm">
                    {item.decision}
                  </Badge>
                  <span className="text-slate-500 text-[10px]">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-[#070a10] py-3 text-center text-[11px] font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>EventGate • Enterprise Event Release Control Plane</span>
          <span>Amazon EventBridge • DynamoDB • ap-south-1</span>
        </div>
      </footer>
    </div>
  )
}
