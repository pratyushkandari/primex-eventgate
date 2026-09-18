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
import type { AnalysisResponse, PublishResponse } from '@/types/api'
import { AlertCircle } from 'lucide-react'

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
