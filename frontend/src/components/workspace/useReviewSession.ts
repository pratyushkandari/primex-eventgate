/**
 * State and actions for the Review page: which change is selected, the payload
 * being edited, and the latest analysis and publish results. It lives in the
 * app shell so switching tabs does not discard an in-progress review.
 *
 * Any input change (event, versions, payload) clears the previous results, and
 * the shell calls resetResults() when the environment changes, so the page never
 * shows a decision for something other than what is on screen.
 */

import * as React from 'react'
import { eventGateApi } from '@/services/api'
import { useEventDetail } from '@/services/queries'
import { DEMO_SCENARIOS, findScenario, payloadTemplate, type ScenarioId } from '@/data/scenarios'
import {
  type AnalysisResponse,
  type Decision,
  type Environment,
  EventGateApiError,
  type PublishResponse,
} from '@/types/api'

export interface ChangeSelection {
  eventType: string
  currentVersion: number
  proposedVersion: number
}

export interface PublishFailure {
  status: number
  code: string
  message: string
}

export interface SessionReview {
  id: string
  eventType: string
  currentVersion: number
  proposedVersion: number
  environment: Environment
  decision: Decision
  at: string
}

const DEFAULT_SCENARIO = DEMO_SCENARIOS.safe

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function jsonErrorFor(text: string): string | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'The payload must be a JSON object.'
    }
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid JSON.'
  }
}

export function useReviewSession(environment: Environment) {
  const [selection, setSelection] = React.useState<ChangeSelection>({
    eventType: DEFAULT_SCENARIO.eventType,
    currentVersion: DEFAULT_SCENARIO.currentVersion,
    proposedVersion: DEFAULT_SCENARIO.proposedVersion,
  })
  // null means "use the payload generated from the proposed contract".
  const [payloadOverride, setPayloadOverride] = React.useState<string | null>(() =>
    formatJson(DEFAULT_SCENARIO.samplePayload)
  )

  const [analysis, setAnalysis] = React.useState<AnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = React.useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)

  const [publishResult, setPublishResult] = React.useState<PublishResponse | null>(null)
  const [publishError, setPublishError] = React.useState<PublishFailure | null>(null)
  const [isPublishing, setIsPublishing] = React.useState(false)

  const [recent, setRecent] = React.useState<SessionReview[]>([])
  const [selectedConsumerId, setSelectedConsumerId] = React.useState<string | null>(null)
  const [selectedField, setSelectedField] = React.useState<string | null>(null)

  const detailQuery = useEventDetail(selection.eventType)
  const templateText = React.useMemo(() => {
    const contract = detailQuery.data?.contracts.find((c) => c.version === selection.proposedVersion)
    return contract ? formatJson(payloadTemplate(contract)) : null
  }, [detailQuery.data, selection.proposedVersion])
  const payloadText = payloadOverride ?? templateText ?? ''
  // An empty payload only happens while the template's contract is loading.
  const jsonError = React.useMemo(() => (payloadText ? jsonErrorFor(payloadText) : null), [payloadText])
  const scenario = findScenario(selection.eventType, selection.currentVersion, selection.proposedVersion)
  const scenarioId: ScenarioId | null = scenario?.id ?? null

  const clearResults = React.useCallback(() => {
    setAnalysis(null)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)
    setSelectedField(null)
  }, [])

  /** Drop results; the shell calls this when the environment changes. */
  const resetResults = React.useCallback(() => {
    clearResults()
    setSelectedConsumerId(null)
  }, [clearResults])

  const openChange = React.useCallback(
    (next: ChangeSelection) => {
      setSelection(next)
      clearResults()
      setSelectedConsumerId(null)
      const sample = findScenario(next.eventType, next.currentVersion, next.proposedVersion)
      setPayloadOverride(sample ? formatJson(sample.samplePayload) : null)
    },
    [clearResults]
  )

  const selectScenario = React.useCallback(
    (id: ScenarioId) => {
      const s = DEMO_SCENARIOS[id]
      openChange({ eventType: s.eventType, currentVersion: s.currentVersion, proposedVersion: s.proposedVersion })
    },
    [openChange]
  )

  const editPayload = React.useCallback(
    (text: string) => {
      setPayloadOverride(text)
      clearResults()
    },
    [clearResults]
  )

  const formatPayload = React.useCallback((): boolean => {
    if (jsonError || !payloadText) return false
    setPayloadOverride(formatJson(JSON.parse(payloadText)))
    return true
  }, [jsonError, payloadText])

  const resetPayload = React.useCallback(() => {
    openChange(selection)
  }, [openChange, selection])

  const analyze = React.useCallback(async (): Promise<AnalysisResponse | null> => {
    if (jsonError || isAnalyzing) return null
    setIsAnalyzing(true)
    clearResults()
    try {
      const result = await eventGateApi.analyzeCompatibility({ ...selection, environment })
      setAnalysis(result)
      setRecent((prev) =>
        [
          {
            id: result.analysisId,
            ...selection,
            environment,
            decision: result.decision,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 5)
      )
      return result
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'The analysis request failed.')
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }, [jsonError, isAnalyzing, clearResults, selection, environment])

  const publish = React.useCallback(async (): Promise<PublishResponse | null> => {
    if (jsonError || !analysis || analysis.decision !== 'ALLOW' || isPublishing) return null
    setIsPublishing(true)
    setPublishError(null)
    setPublishResult(null)
    try {
      const result = await eventGateApi.publishEvent({
        ...selection,
        environment,
        payload: JSON.parse(payloadText) as Record<string, unknown>,
        analysisId: analysis.analysisId,
      })
      setPublishResult(result)
      return result
    } catch (err) {
      setPublishError(
        err instanceof EventGateApiError
          ? { status: err.statusCode, code: err.code, message: err.message }
          : { status: 0, code: 'UNKNOWN', message: 'The publish request failed.' }
      )
      return null
    } finally {
      setIsPublishing(false)
    }
  }, [jsonError, analysis, isPublishing, selection, environment, payloadText])

  return {
    selection,
    scenarioId,
    eventDetail: detailQuery.data ?? null,
    eventDetailQuery: detailQuery,
    payloadText,
    jsonError,
    analysis,
    analysisError,
    isAnalyzing,
    publishResult,
    publishError,
    isPublishing,
    recent,
    selectedConsumerId,
    selectedField,
    openChange,
    selectScenario,
    editPayload,
    formatPayload,
    resetPayload,
    analyze,
    publish,
    resetResults,
    selectConsumer: setSelectedConsumerId,
    selectField: setSelectedField,
  }
}

export type ReviewSession = ReturnType<typeof useReviewSession>
