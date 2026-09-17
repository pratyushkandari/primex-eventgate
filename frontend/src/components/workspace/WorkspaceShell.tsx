import * as React from 'react'
import { Header } from '@/components/layout/Header'
import { ScenarioSelector } from '@/components/workspace/ScenarioSelector'
import { EventInputPanel } from '@/components/workspace/EventInputPanel'
import { DecisionHero } from '@/components/workspace/DecisionHero'
import { ConsumerImpactPanel } from '@/components/workspace/ConsumerImpactPanel'
import { FindingsPanel } from '@/components/workspace/FindingsPanel'
import { PublishResultPanel } from '@/components/workspace/PublishResultPanel'
import { DEMO_SCENARIOS, type DemoScenario } from '@/data/scenarios'
import { eventGateApi } from '@/services/api'
import type { AnalysisResponse, PublishResponse } from '@/types/api'
import { ArrowRight, AlertTriangle } from 'lucide-react'

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
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis request failed')
      setAnalysis(null)
    } finally {
      setIsAnalyzing(false)
    }
  }, [eventType, currentVersion, proposedVersion, jsonError])

  // Gated publish trigger
  const handlePublish = React.useCallback(async () => {
    if (!analysis || analysis.decision !== 'ALLOW') return

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(payloadText)
    } catch {
      setPublishError('Cannot publish: payload is not valid JSON')
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
      setPublishError(err instanceof Error ? err.message : 'Event publication request failed')
    } finally {
      setIsPublishing(false)
    }
  }, [analysis, eventType, currentVersion, proposedVersion, payloadText])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Scenario Quick Selector Banner */}
        <ScenarioSelector
          selectedScenario={selectedScenarioId}
          onSelectScenario={handleSelectScenario}
          disabled={isAnalyzing || isPublishing}
        />

        {/* Global Analysis Error Banner */}
        {analysisError && (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-3.5 flex items-start space-x-3 text-xs text-rose-300 font-mono">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Compatibility Analysis Failed</span>
              <p>{analysisError}</p>
            </div>
          </div>
        )}

        {/* 3-Column Core Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Column 1: Input & Payload Editor (Col 4) */}
          <div className="lg:col-span-4">
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

          {/* Column 2: Decision Hero (Col 4) */}
          <div className="lg:col-span-4">
            <DecisionHero
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              isPublishing={isPublishing}
              onPublish={handlePublish}
            />
          </div>

          {/* Column 3: Consumer Impact Panel (Col 4) */}
          <div className="lg:col-span-4">
            <ConsumerImpactPanel analysis={analysis} />
          </div>
        </div>

        {/* Live Publication Outcome Panel */}
        <PublishResultPanel
          publishResult={publishResult}
          publishError={publishError}
        />

        {/* Technical Findings & ChangeSet Breakdown */}
        {analysis && <FindingsPanel analysis={analysis} />}

        {/* Bottom Cloud Architecture Transport Flow */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <span>Cloud Transport Flow</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Live Amazon EventBridge Routing</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Bus: primex-eventgate-dev-bus
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <span className="block text-xs font-semibold text-slate-200">Producer</span>
              <span className="text-[11px] font-mono text-slate-400">API Gateway HTTP API</span>
            </div>

            <div className="hidden md:flex justify-center text-slate-600">
              <ArrowRight className="h-4 w-4" />
            </div>

            <div
              className={`border rounded-lg p-3 transition-colors ${
                analysis?.decision === 'ALLOW'
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : analysis?.decision === 'BLOCK'
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : analysis?.decision === 'REVIEW'
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-slate-950 border-blue-500/30'
              }`}
            >
              <span
                className={`block text-xs font-semibold ${
                  analysis?.decision === 'ALLOW'
                    ? 'text-emerald-400'
                    : analysis?.decision === 'BLOCK'
                    ? 'text-rose-400'
                    : analysis?.decision === 'REVIEW'
                    ? 'text-amber-400'
                    : 'text-blue-400'
                }`}
              >
                EventGate Core Gate
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {analysis ? `Gate: ${analysis.decision}` : 'Payload + Consumer Analysis'}
              </span>
            </div>

            <div className="hidden md:flex justify-center text-slate-600">
              <ArrowRight className="h-4 w-4" />
            </div>

            <div
              className={`border rounded-lg p-3 transition-colors ${
                publishResult?.published
                  ? 'bg-emerald-950/30 border-emerald-500/60'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <span
                className={`block text-xs font-semibold ${
                  publishResult?.published ? 'text-emerald-300' : 'text-slate-200'
                }`}
              >
                Amazon EventBridge
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {publishResult?.published
                  ? 'Entry Ingested (Fan-out Active)'
                  : 'Custom Bus (ALLOW Only)'}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
