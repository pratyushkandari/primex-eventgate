import * as React from 'react'
import { Header, type NavTab } from '@/components/layout/Header'
import { ContractsHub } from '@/components/contracts/ContractsHub'
import { ReleaseHistoryView } from '@/components/history/ReleaseHistoryView'
import { DeveloperToolsView } from '@/components/devtools/DeveloperToolsView'
import { PoliciesView } from '@/components/policies/PoliciesView'
import { SettingsView } from '@/components/settings/SettingsView'
import { ReportExportModal } from '@/components/workspace/ReportExportModal'
import { ScenarioSelector } from '@/components/workspace/ScenarioSelector'
import { ReviewContextBar } from '@/components/workspace/ReviewContextBar'
import { EventInputPanel } from '@/components/workspace/EventInputPanel'
import { DecisionHero } from '@/components/workspace/DecisionHero'
import { ConsumerImpactPanel } from '@/components/workspace/ConsumerImpactPanel'
import { REGISTERED_CONSUMERS } from '@/data/consumers'
import { DependencyTopology } from '@/components/workspace/DependencyTopology'
import { FindingsPanel } from '@/components/workspace/FindingsPanel'
import { SchemaDiff } from '@/components/workspace/SchemaDiff'
import { PublishResultPanel } from '@/components/workspace/PublishResultPanel'
import { EventPath } from '@/components/workspace/EventPath'
import { ConsumerDrawer } from '@/components/workspace/ConsumerDrawer'
import { CommandPalette, type CommandItem } from '@/components/workspace/CommandPalette'
import { ShortcutsHelpModal } from '@/components/workspace/ShortcutsHelpModal'
import { ToastContainer, type ToastMessage } from '@/components/ui/Toast'
import { DEMO_SCENARIOS, type DemoScenario } from '@/data/scenarios'
import { eventGateApi } from '@/services/api'
import {
  type AnalysisRequest,
  type AnalysisResponse,
  type PublishRequest,
  type PublishResponse,
  type Decision,
  type Environment,
  EventGateApiError,
} from '@/types/api'
import {
  AlertCircle,
  Play,
  Send,
  Sparkles,
  FileCode,
  RotateCcw,
  Users,
  Copy,
  Database,
  History as HistoryIcon,
  Terminal,
  Shield,
  Settings as SettingsIcon,
  Globe,
  HelpCircle,
} from 'lucide-react'
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
  const [activeNavTab, setActiveNavTab] = React.useState<NavTab>('review')
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<DemoScenario['id'] | null>('safe')
  const [eventType] = React.useState<string>('OrderPlaced')
  const [currentVersion] = React.useState<number>(1)
  const [proposedVersion, setProposedVersion] = React.useState<number>(2)
  const [environment, setEnvironment] = React.useState<Environment>('production')
  const [payloadText, setPayloadText] = React.useState<string>(() =>
    JSON.stringify(DEMO_SCENARIOS.safe.samplePayload, null, 2)
  )
  const [jsonError, setJsonError] = React.useState<string | null>(null)

  // Interactive Cross-Linking & Filtering States
  const [selectedConsumerId, setSelectedConsumerId] = React.useState<string | null>(null)
  const [selectedField, setSelectedField] = React.useState<string | null>(null)
  const [consumerFilter, setConsumerFilter] = React.useState<'ALL' | 'AFFECTED' | 'SAFE'>('ALL')

  // Modals & Drawers
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState<boolean>(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = React.useState<boolean>(false)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState<boolean>(false)

  // Toast System
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  const showToast = React.useCallback(
    (title: string, description?: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      setToasts((prev) => [...prev, { id, title, description, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    []
  )

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

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
    setSelectedField(null)
  }, [])

  // Proposed version selector change
  const handleProposedVersionChange = React.useCallback((newVersion: number) => {
    setProposedVersion(newVersion)
    setSelectedScenarioId(null)
    setAnalysis(null)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)
  }, [])

  // Environment change handler — clears all stale analysis/publish state
  const handleEnvironmentChange = React.useCallback((newEnv: Environment) => {
    setEnvironment(newEnv)
    setAnalysis(null)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)
    setSelectedField(null)
    setSelectedConsumerId(null)
  }, [])

  // Payload text change with local JSON validation
  const handlePayloadTextChange = React.useCallback((text: string) => {
    setPayloadText(text)
    setSelectedScenarioId(null)
    setAnalysis(null)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)
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
      showToast('Payload Formatted', 'Clean JSON indentation applied', 'info')
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax')
      showToast('Cannot Format', 'Payload has JSON syntax errors', 'error')
    }
  }, [payloadText, showToast])

  // Reset payload to current scenario default
  const handleResetPayload = React.useCallback(() => {
    const fallbackId: DemoScenario['id'] =
      proposedVersion === 3 ? 'breaking' : proposedVersion === 4 ? 'risk' : 'safe'
    const scenarioId = selectedScenarioId ?? fallbackId
    const scenario = DEMO_SCENARIOS[scenarioId]
    setSelectedScenarioId(scenarioId)
    setPayloadText(JSON.stringify(scenario.samplePayload, null, 2))
    setJsonError(null)
    setAnalysis(null)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)
    showToast('Payload Reset', `Reset to ${scenario.name} default`, 'info')
  }, [selectedScenarioId, proposedVersion, showToast])

  // Compatibility analysis trigger
  const handleAnalyze = React.useCallback(async () => {
    if (jsonError) {
      showToast('Invalid Payload', 'Fix JSON syntax before analyzing', 'error')
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)
    setPublishResult(null)
    setPublishError(null)

    try {
      const req: AnalysisRequest = {
        eventType,
        currentVersion,
        proposedVersion,
        environment,
      }
      const res = await eventGateApi.analyzeCompatibility(req)
      setAnalysis(res)

      // Record in local session history (P2)
      setSessionHistory((prev) => [
        {
          id: `${eventType}-${currentVersion}-${proposedVersion}-${Date.now()}`,
          eventType,
          currentVersion,
          proposedVersion,
          decision: res.decision,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
        ...prev.slice(0, 4),
      ])

      if (res.decision === 'ALLOW') {
        showToast('Analysis Complete', 'Decision: ALLOW (Compatible with all consumers)', 'success')
      } else if (res.decision === 'BLOCK') {
        showToast('Analysis Complete', 'Decision: BLOCK (Breaking incompatibility caught)', 'error')
      } else {
        showToast('Analysis Complete', 'Decision: REVIEW (Potential risk flagged)', 'info')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Analysis request failed'
      setAnalysisError(errorMsg)
      setAnalysis(null)
      showToast('Analysis Error', 'Pre-flight check could not be completed', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }, [eventType, currentVersion, proposedVersion, environment, jsonError, showToast])

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
      const req: PublishRequest = {
        eventType,
        currentVersion,
        proposedVersion,
        environment,
        payload: parsedPayload,
      }
      if (analysis.analysisId) {
        req.analysisId = analysis.analysisId
      }
      const res = await eventGateApi.publishEvent(req)
      setPublishResult(res)
      showToast(
        'Event Ingested',
        `Event ID: ${res.eventId.substring(0, 18)}...`,
        'success'
      )
    } catch (err) {
      const statusCode =
        err instanceof EventGateApiError
          ? err.statusCode
          : typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode: unknown }).statusCode)
          : undefined

      if (statusCode === 422) {
        const msg = `Payload rejected (422): ${(err as Error).message}`
        setPublishError(msg)
        showToast('Payload Rejected', 'Schema validation failed', 'error')
      } else if (statusCode === 409) {
        const msg = `Publication prevented (409): ${(err as Error).message}`
        setPublishError(msg)
        showToast('Publication Prevented', 'Gate prevented delivery', 'error')
      } else if (statusCode === 503) {
        const msg =
          'Publication failed (503): EventBridge publication did not complete successfully.'
        setPublishError(msg)
        showToast('Service Unavailable', 'Delivery service did not complete', 'error')
      } else {
        const msg = err instanceof Error ? err.message : 'Event publication request failed'
        setPublishError(msg)
        showToast('Delivery Failure', 'Event release did not complete', 'error')
      }
    } finally {
      setIsPublishing(false)
    }
  }, [analysis, eventType, currentVersion, proposedVersion, environment, payloadText, jsonError, showToast])

  // Consumer selection handler for drawer
  const handleSelectConsumer = React.useCallback((id: string) => {
    setSelectedConsumerId(id)
  }, [])

  const handleCloseDrawer = React.useCallback(() => {
    setSelectedConsumerId(null)
  }, [])

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
      // ⌘Enter or Ctrl+Enter -> Analyze
      else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!isAnalyzing && !jsonError) {
          handleAnalyze()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAnalyzing, jsonError, handleAnalyze])

  // Build Command Palette Actions
  const commandPaletteItems = React.useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-review',
        title: 'Open Review Workspace',
        description: 'Pre-flight release analysis and decision gate',
        category: 'Navigation',
        icon: FileCode,
        onSelect: () => setActiveNavTab('review'),
      },
      {
        id: 'nav-contracts',
        title: 'Open Contracts',
        description: 'Browse versioned event catalogs and consumer contracts',
        category: 'Navigation',
        icon: Database,
        onSelect: () => setActiveNavTab('contracts'),
      },
      {
        id: 'nav-history',
        title: 'Open Release History',
        description: 'Persistent audit trail and release evidence records',
        category: 'Navigation',
        icon: HistoryIcon,
        onSelect: () => setActiveNavTab('history'),
      },
      {
        id: 'nav-devtools',
        title: 'Open Developer Tools',
        description: 'Contract test runner and CLI command generator',
        category: 'Navigation',
        icon: Terminal,
        onSelect: () => setActiveNavTab('devtools'),
      },
      {
        id: 'nav-policies',
        title: 'Open Policies',
        description: 'Environment release matrix and Cedar policy inspection',
        category: 'Navigation',
        icon: Shield,
        onSelect: () => setActiveNavTab('policies'),
      },
      {
        id: 'nav-settings',
        title: 'Open Settings',
        description: 'Inspect authoritative runtime platform configuration',
        category: 'Navigation',
        icon: SettingsIcon,
        onSelect: () => setActiveNavTab('settings'),
      },
      {
        id: 'cmd-analyze',
        title: 'Run Compatibility Analysis',
        description: 'Run pre-flight contract check against registered consumers',
        category: 'Actions',
        icon: Play,
        shortcut: '⌘↵',
        disabled: isAnalyzing || Boolean(jsonError),
        onSelect: () => handleAnalyze(),
      },
      {
        id: 'cmd-publish',
        title: 'Publish to EventBridge',
        description: 'Enforces release gate and publishes allowed event to EventBridge',
        category: 'Actions',
        icon: Send,
        disabled: isPublishing || !analysis || analysis.decision !== 'ALLOW' || Boolean(jsonError),
        onSelect: () => handlePublish(),
      },
      {
        id: 'cmd-format',
        title: 'Format Payload JSON',
        description: 'Beautify JSON indentation in editor',
        category: 'Actions',
        icon: FileCode,
        onSelect: () => handleFormatPayload(),
      },
      {
        id: 'cmd-reset',
        title: 'Reset Payload',
        description: 'Restore default sample payload for current scenario',
        category: 'Actions',
        icon: RotateCcw,
        onSelect: () => handleResetPayload(),
      },
      {
        id: 'cmd-scenario-safe',
        title: 'Scenario: Safe Addition (v2)',
        description: 'Adds optional loyaltyTier field - backward compatible (ALLOW)',
        category: 'Scenarios',
        keywords: ['safe', 'allow', 'v2', 'addition'],
        icon: Sparkles,
        onSelect: () => handleSelectScenario(DEMO_SCENARIOS.safe),
      },
      {
        id: 'cmd-scenario-breaking',
        title: 'Scenario: Breaking Change (v3)',
        description: 'Mutates shippingMethod from string to object - breaking (BLOCK)',
        category: 'Scenarios',
        keywords: ['break', 'breaking', 'block', 'v3', 'incompatible'],
        icon: Sparkles,
        onSelect: () => handleSelectScenario(DEMO_SCENARIOS.breaking),
      },
      {
        id: 'cmd-scenario-risky',
        title: 'Scenario: Risky Removal (v4)',
        description: 'Removes couponCode field used downstream by analytics (REVIEW)',
        category: 'Scenarios',
        keywords: ['risk', 'review', 'v4', 'removal', 'warn'],
        icon: Sparkles,
        onSelect: () => handleSelectScenario(DEMO_SCENARIOS.risk),
      },
      {
        id: 'cmd-filter-all',
        title: 'Filter: All Consumers',
        description: 'Display all registered downstream consumers',
        category: 'Filters',
        keywords: ['consumers', 'all', 'subscribers'],
        icon: Users,
        onSelect: () => setConsumerFilter('ALL'),
      },
      {
        id: 'cmd-filter-affected',
        title: 'Filter: Affected Consumers',
        description: 'Show only breaking or risky consumers',
        category: 'Filters',
        keywords: ['break', 'affected', 'breaking', 'risk', 'impacted'],
        icon: Users,
        onSelect: () => setConsumerFilter('AFFECTED'),
      },
      {
        id: 'cmd-filter-safe',
        title: 'Filter: Safe Consumers',
        description: 'Show only fully compatible consumers',
        category: 'Filters',
        keywords: ['safe', 'allow', 'compatible'],
        icon: Users,
        onSelect: () => setConsumerFilter('SAFE'),
      },
      {
        id: 'cmd-inspect-billing',
        title: 'Inspect Billing Service',
        description: 'Deep dive into billing-service consumer contract',
        category: 'Consumers',
        icon: Users,
        onSelect: () => handleSelectConsumer('billing-service'),
      },
      {
        id: 'cmd-inspect-inventory',
        title: 'Inspect Inventory Service',
        description: 'Deep dive into inventory-service consumer contract',
        category: 'Consumers',
        icon: Users,
        onSelect: () => handleSelectConsumer('inventory-service'),
      },
      {
        id: 'cmd-inspect-analytics',
        title: 'Inspect Analytics Service',
        description: 'Deep dive into analytics-service consumer contract',
        category: 'Consumers',
        icon: Users,
        onSelect: () => handleSelectConsumer('analytics-service'),
      },
      {
        id: 'cmd-env-dev',
        title: 'Switch Environment: Development',
        description: 'Target development contracts and dev event bus',
        category: 'Environments',
        icon: Globe,
        onSelect: () => handleEnvironmentChange('development'),
      },
      {
        id: 'cmd-env-staging',
        title: 'Switch Environment: Staging',
        description: 'Target staging environment policy validation',
        category: 'Environments',
        icon: Globe,
        onSelect: () => handleEnvironmentChange('staging'),
      },
      {
        id: 'cmd-env-prod',
        title: 'Switch Environment: Production',
        description: 'Target production release gating policies',
        category: 'Environments',
        icon: Globe,
        onSelect: () => handleEnvironmentChange('production'),
      },
      {
        id: 'cmd-help',
        title: 'Open Keyboard Shortcuts & Help',
        description: 'View command palette shortcuts, analyze hotkeys, and workflow guide',
        category: 'Help',
        icon: HelpCircle,
        shortcut: '?',
        onSelect: () => setIsHelpModalOpen(true),
      },
    ]

    if (publishResult) {
      items.push({
        id: 'cmd-copy-event-id',
        title: 'Copy Event ID',
        description: publishResult.eventId,
        category: 'Identifiers',
        icon: Copy,
        onSelect: () => {
          navigator.clipboard.writeText(publishResult.eventId)
          showToast('Copied Event ID', publishResult.eventId, 'success')
        },
      })
      if (publishResult.eventBridgeEventId) {
        items.push({
          id: 'cmd-copy-eb-id',
          title: 'Copy EventBridge ID',
          description: publishResult.eventBridgeEventId,
          category: 'Identifiers',
          icon: Copy,
          onSelect: () => {
            navigator.clipboard.writeText(publishResult.eventBridgeEventId || '')
            showToast('Copied EventBridge ID', publishResult.eventBridgeEventId || undefined, 'success')
          },
        })
      }
    }

    if (analysis?.analysisId) {
      items.push({
        id: 'cmd-copy-analysis-id',
        title: 'Copy Analysis ID',
        description: analysis.analysisId,
        category: 'Identifiers',
        icon: Copy,
        onSelect: () => {
          navigator.clipboard.writeText(analysis.analysisId || '')
          showToast('Copied Analysis ID', analysis.analysisId, 'success')
        },
      })
    }

    if (analysis?.requestId) {
      items.push({
        id: 'cmd-copy-request-id',
        title: 'Copy Request ID',
        description: analysis.requestId,
        category: 'Identifiers',
        icon: Copy,
        onSelect: () => {
          navigator.clipboard.writeText(analysis.requestId || '')
          showToast('Copied Request ID', analysis.requestId, 'success')
        },
      })
    }

    return items
  }, [
    isAnalyzing,
    isPublishing,
    jsonError,
    analysis,
    publishResult,
    handleAnalyze,
    handlePublish,
    handleSelectScenario,
    handleFormatPayload,
    handleResetPayload,
    handleSelectConsumer,
    handleEnvironmentChange,
    showToast,
  ])

  // Finding for selected drawer consumer
  const selectedDrawerFinding = React.useMemo(() => {
    if (!selectedConsumerId || !analysis) return undefined
    return analysis.findings.find((f) => f.consumerId === selectedConsumerId)
  }, [selectedConsumerId, analysis])

  const selectedDrawerRole = React.useMemo(() => {
    const c = REGISTERED_CONSUMERS.find((item) => item.id === selectedConsumerId)
    return c?.role
  }, [selectedConsumerId])

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top Application Bar */}
      <Header
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        environment={environment}
        onEnvironmentChange={handleEnvironmentChange}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {activeNavTab === 'contracts' && (
          <ContractsHub
            onOpenReviewScenario={(_et, _cur, prop) => {
              if (prop === 2) handleSelectScenario(DEMO_SCENARIOS.safe)
              else if (prop === 3) handleSelectScenario(DEMO_SCENARIOS.breaking)
              else if (prop === 4) handleSelectScenario(DEMO_SCENARIOS.risk)
              setActiveNavTab('review')
            }}
          />
        )}

        {activeNavTab === 'history' && (
          <ReleaseHistoryView
            onSelectReview={(_et, _cur, prop) => {
              if (prop === 2) handleSelectScenario(DEMO_SCENARIOS.safe)
              else if (prop === 3) handleSelectScenario(DEMO_SCENARIOS.breaking)
              else if (prop === 4) handleSelectScenario(DEMO_SCENARIOS.risk)
              setActiveNavTab('review')
            }}
          />
        )}

        {activeNavTab === 'devtools' && (
          <DeveloperToolsView
            onOpenReviewScenario={(_et, _cur, prop) => {
              if (prop === 2) handleSelectScenario(DEMO_SCENARIOS.safe)
              else if (prop === 3) handleSelectScenario(DEMO_SCENARIOS.breaking)
              else if (prop === 4) handleSelectScenario(DEMO_SCENARIOS.risk)
              setActiveNavTab('review')
            }}
          />
        )}

        {activeNavTab === 'policies' && <PoliciesView />}

        {activeNavTab === 'settings' && <SettingsView />}

        {activeNavTab === 'review' && (
          <>
            {/* Scenario Selection Toolbar */}
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

        {/* Pull Request-Style Review Context Bar with Segmented Distribution Bar */}
        <ReviewContextBar
          analysis={analysis}
          environment={environment}
          onFilterAffected={() => setConsumerFilter('AFFECTED')}
          onExportReport={() => setIsExportModalOpen(true)}
        />

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
              environment={environment}
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
              environment={environment}
            />
          </div>

          {/* Column 3: Downstream Consumers (Col 4) */}
          <div className="lg:col-span-4 flex flex-col">
            <ConsumerImpactPanel
              analysis={analysis}
              selectedConsumerId={selectedConsumerId}
              onSelectConsumer={handleSelectConsumer}
              selectedField={selectedField}
              filter={consumerFilter}
              onFilterChange={setConsumerFilter}
              environment={environment}
            />
          </div>
        </div>

        {/* Interactive Dependency Topology Map */}
        <DependencyTopology
          analysis={analysis}
          selectedConsumerId={selectedConsumerId}
          onSelectConsumer={handleSelectConsumer}
        />

        {/* Live Publication Outcome Section */}
        <PublishResultPanel
          publishResult={publishResult}
          publishError={publishError}
          analysisId={analysis?.analysisId}
        />

        {/* Compatibility Findings & Schema Diff with Bidirectional Cross-Linking */}
        {analysis && (
          <>
            <FindingsPanel
              analysis={analysis}
              selectedField={selectedField}
              onSelectField={(field) => {
                if (selectedField === field) {
                  setSelectedField(null)
                } else {
                  setSelectedField(field)
                  if (field) {
                    const matched = analysis.findings.find((f) => f.field === field)
                    if (matched) setSelectedConsumerId(matched.consumerId)
                  }
                }
              }}
              selectedConsumerId={selectedConsumerId}
              onSelectConsumer={handleSelectConsumer}
            />
            <SchemaDiff
              changeSet={analysis.changeSet}
              findings={analysis.findings}
              selectedField={selectedField}
              onSelectField={(field) => {
                if (selectedField === field) {
                  setSelectedField(null)
                } else {
                  setSelectedField(field)
                  if (field) {
                    const matched = analysis.findings.find((f) => f.field === field)
                    if (matched) setSelectedConsumerId(matched.consumerId)
                  }
                }
              }}
            />
          </>
        )}

        {/* Event Path Pipeline Strip */}
        <EventPath
          decision={analysis?.decision ?? null}
          isPublished={Boolean(publishResult?.published)}
          environment={environment}
        />

        {/* Session History (Browser tab session only) */}
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
                  <span className="text-slate-500">
                    v{item.currentVersion} → v{item.proposedVersion}
                  </span>
                  <Badge
                    variant={item.decision.toLowerCase() as 'allow' | 'block' | 'review'}
                    size="sm"
                  >
                    {item.decision}
                  </Badge>
                  <span className="text-slate-500 text-[10px]">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070a10] py-3 text-center text-[11px] font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PrimeX EventGate • Enterprise Event Release Control Plane</span>
          <span>Amazon EventBridge • DynamoDB • ap-south-1</span>
        </div>
      </footer>

      {/* Consumer Inspector Slide-Over Drawer */}
      <ConsumerDrawer
        consumerId={selectedConsumerId}
        consumerRole={selectedDrawerRole}
        finding={selectedDrawerFinding}
        onClose={handleCloseDrawer}
      />

      {/* Global Command Palette Modal (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandPaletteItems}
      />

      {/* Keyboard Shortcuts & System Guide Modal */}
      <ShortcutsHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Release Report Export Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        analysis={analysis}
        onToast={showToast}
      />

      {/* Accessible Floating Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
