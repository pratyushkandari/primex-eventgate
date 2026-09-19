import * as React from 'react'
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Play,
  Copy,
  Check,
  GitPullRequest,
  RefreshCw,
} from 'lucide-react'
import { eventGateApi } from '@/services/api'
import type { AnalysisResponse, Decision, Environment } from '@/types/api'
import { REGISTERED_CONSUMERS } from '@/data/consumers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface DeveloperToolsViewProps {
  onOpenReviewScenario?: (eventType: string, current: number, proposed: number) => void
}

function getSuggestedDecision(
  event: string,
  current: number,
  proposed: number,
  env: Environment,
): Decision {
  if (event === 'OrderPlaced') {
    if (current === 1 && proposed === 2) return 'ALLOW'
    if (current === 1 && proposed === 3) return 'BLOCK'
    if (current === 1 && proposed === 4) return env === 'development' ? 'ALLOW' : 'REVIEW'
  }
  if (current === proposed) return 'ALLOW'
  return 'ALLOW'
}

export function DeveloperToolsView({ onOpenReviewScenario }: DeveloperToolsViewProps) {
  // Test runner state
  const [eventType, setEventType] = React.useState('OrderPlaced')
  const [currentVersion, setCurrentVersion] = React.useState(1)
  const [proposedVersion, setProposedVersion] = React.useState(2)
  const [environment, setEnvironment] = React.useState<Environment>('production')
  const suggestedDecision = React.useMemo(
    () => getSuggestedDecision(eventType, currentVersion, proposedVersion, environment),
    [eventType, currentVersion, proposedVersion, environment]
  )

  const [manualOverrideDecision, setManualOverrideDecision] = React.useState<Decision | null>(null)
  const isManualOverride = manualOverrideDecision !== null
  const expectedDecision = manualOverrideDecision ?? suggestedDecision

  const handleExpectedDecisionChange = (decision: Decision) => {
    setManualOverrideDecision(decision)
  }

  const handleResetToSuggested = () => {
    setManualOverrideDecision(null)
  }

  const handleApplyPreset = (event: string, cur: number, prop: number) => {
    setEventType(event)
    setCurrentVersion(cur)
    setProposedVersion(prop)
    setManualOverrideDecision(null)
  }

  // Execution state
  const [isRunning, setIsRunning] = React.useState(false)
  const [testResult, setTestResult] = React.useState<AnalysisResponse | null>(null)
  const [testError, setTestError] = React.useState<string | null>(null)

  const consumerResults = React.useMemo(() => {
    if (!testResult) return []
    return REGISTERED_CONSUMERS.map((c) => {
      const finding = testResult.findings.find((f) => f.consumerId === c.id)
      return {
        consumerId: c.id,
        name: c.name,
        status: finding ? finding.status : ('SAFE' as const),
        ruleId: finding?.ruleId,
        field: finding?.field,
        reason: finding ? finding.reason : 'All consumed fields compatible',
      }
    })
  }, [testResult])
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null)

  const handleRunAssertion = async () => {
    setIsRunning(true)
    setTestError(null)
    setTestResult(null)

    try {
      const res = await eventGateApi.analyzeCompatibility({
        eventType,
        currentVersion,
        proposedVersion,
        environment,
      })
      setTestResult(res)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setIsRunning(false)
    }
  }

  const isPassed = testResult && testResult.decision === expectedDecision

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const cliCommands = [
    {
      title: 'Check release compatibility',
      cmd: `eventgate check --event ${eventType} --current ${currentVersion} --proposed ${proposedVersion} --env ${environment}`,
    },
    {
      title: 'Check release compatibility (strict CI review gate)',
      cmd: `eventgate check --event ${eventType} --current ${currentVersion} --proposed ${proposedVersion} --env ${environment} --fail-on-review`,
    },
    {
      title: 'Run contract assertion',
      cmd: `eventgate test --event ${eventType} --current ${currentVersion} --proposed ${proposedVersion} --expected ${expectedDecision} --env ${environment}`,
    },
    {
      title: 'Inspect registered contract',
      cmd: `eventgate catalog --event ${eventType}`,
    },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Developer Tools</h1>
            <Badge variant="default" size="sm">
              Engine Suite
            </Badge>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Deterministic contract test runner, CLI command generator, and CI integration guidance
          </p>
        </div>
      </div>

      {/* Grid: Test Runner + CLI Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Contract Test Runner (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Play className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-200">Contract Test Runner</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Live API Execution</span>
            </div>

            {/* Scenario Presets */}
            <div className="mb-4 pb-3 border-b border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block mb-2">Scenario Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('OrderPlaced', 1, 2)}
                  className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                    eventType === 'OrderPlaced' && currentVersion === 1 && proposedVersion === 2
                      ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/50 font-semibold'
                      : 'bg-slate-900 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  OrderPlaced v1 → v2 (SAFE)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('OrderPlaced', 1, 3)}
                  className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                    eventType === 'OrderPlaced' && currentVersion === 1 && proposedVersion === 3
                      ? 'bg-rose-950/50 text-rose-300 border-rose-500/50 font-semibold'
                      : 'bg-slate-900 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  OrderPlaced v1 → v3 (BREAK)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('OrderPlaced', 1, 4)}
                  className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                    eventType === 'OrderPlaced' && currentVersion === 1 && proposedVersion === 4
                      ? 'bg-amber-950/50 text-amber-300 border-amber-500/50 font-semibold'
                      : 'bg-slate-900 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  OrderPlaced v1 → v4 (RISK)
                </button>
              </div>
            </div>

            {/* Test Configuration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono mb-4">
              <div>
                <label className="block text-slate-400 mb-1">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="OrderPlaced">OrderPlaced</option>
                  <option value="PaymentCompleted">PaymentCompleted</option>
                  <option value="UserCreated">UserCreated</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Environment</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as Environment)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="development">development</option>
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <label className="block text-slate-400 mb-1">Current Version</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={currentVersion}
                    onChange={(e) => setCurrentVersion(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-slate-400 mb-1">Proposed Version</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={proposedVersion}
                    onChange={(e) => setProposedVersion(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Expected Decision</label>
                <select
                  value={expectedDecision}
                  onChange={(e) => handleExpectedDecisionChange(e.target.value as Decision)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="ALLOW">ALLOW</option>
                  <option value="REVIEW">REVIEW</option>
                  <option value="BLOCK">BLOCK</option>
                </select>
                <div className="flex items-center justify-between mt-1.5 text-[10px]">
                  {isManualOverride ? (
                    <>
                      <span className="text-amber-400 font-medium">Manual expectation</span>
                      <button
                        type="button"
                        onClick={handleResetToSuggested}
                        className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                      >
                        Reset to suggested ({suggestedDecision})
                      </button>
                    </>
                  ) : (
                    <span className="text-slate-400">Suggested from scenario</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleRunAssertion}
              disabled={isRunning}
              variant="primary"
              className="w-full justify-center"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Running Backend Assertion...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-2" />
                  Execute Contract Assertion
                </>
              )}
            </Button>
          </div>

          {/* Test Error */}
          {testError && (
            <div className="bg-rose-950/30 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-300 font-mono">
              <span className="font-bold">Assertion Execution Error:</span> {testError}
            </div>
          )}

          {/* Assertion Result Outcome Banner */}
          {testResult && (
            <div
              className={`border rounded-lg p-4 space-y-3 font-mono ${
                isPassed
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  {isPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-400 flex-shrink-0" />
                  )}
                  <div>
                    <span className="text-sm font-bold tracking-wider">
                      {isPassed ? 'ASSERTION PASSED' : 'ASSERTION FAILED'}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isPassed
                        ? `Expected ${expectedDecision}, got ${testResult.decision}. Gate permitted transition according to policy.`
                        : `Expected ${expectedDecision}, but actual gate decision evaluated to ${testResult.decision}.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      testResult.decision.toLowerCase() as 'allow' | 'block' | 'review'
                    }
                  >
                    Actual: {testResult.decision}
                  </Badge>
                  {onOpenReviewScenario && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenReviewScenario(eventType, currentVersion, proposedVersion)
                      }
                      className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                    >
                      Open in Review
                    </button>
                  )}
                </div>
              </div>

              {/* Detail Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Compatibility</span>
                  <span className="font-bold text-slate-200">
                    {testResult.compatibilityResult || (testResult.decision === 'BLOCK' ? 'BREAK' : testResult.decision === 'REVIEW' ? 'RISK' : 'SAFE')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Severity</span>
                  <span className="font-bold text-slate-200">
                    {testResult.severity}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Release Policy</span>
                  <span className="font-bold text-slate-200">
                    {testResult.policyName || 'StandardReleasePolicy'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Final Decision</span>
                  <span className="font-bold text-slate-200">
                    {testResult.decision}
                  </span>
                </div>
              </div>

              {/* Per-Consumer Breakdown */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-300 block mb-1.5">
                  Per-Consumer Results ({consumerResults.length} consumers evaluated):
                </span>
                <div className="bg-slate-950/60 border border-slate-800 rounded divide-y divide-slate-800/60 text-xs">
                  {consumerResults.map((c) => (
                    <div
                      key={c.consumerId}
                      className="p-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-200">{c.consumerId}</span>
                        {c.ruleId && (
                          <span className="text-slate-500 text-[11px] ml-2">
                            ({c.ruleId})
                          </span>
                        )}
                        {c.field && (
                          <span className="text-slate-400 text-[11px] ml-1.5">
                            field: <code className="text-slate-300">{c.field}</code>
                          </span>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">{c.reason}</p>
                      </div>
                      <Badge
                        variant={
                          c.status.toLowerCase() as 'safe' | 'risk' | 'break'
                        }
                        size="sm"
                      >
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: CLI Generator & CI Guide (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* CLI Generator */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center space-x-2 mb-3">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-200">CLI Generator</h2>
            </div>
            <p className="text-xs text-slate-400 font-mono mb-4">
              Real command-line invocations matching the active runner inputs:
            </p>

            <div className="space-y-3">
              {cliCommands.map((item, idx) => (
                <div
                  key={item.title}
                  className="bg-slate-950/90 border border-slate-800 rounded p-2.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>{item.title}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.cmd, idx)}
                      className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-emerald-400 overflow-x-auto py-1 text-[11px] select-all whitespace-pre-wrap break-all">
                    {item.cmd}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* CI Workflow Guidance */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-5 font-mono text-xs space-y-3">
            <div className="flex items-center space-x-2 text-slate-200">
              <GitPullRequest className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold">CI / CD Gate Standards</h3>
            </div>
            <p className="text-slate-400 text-[11px]">
              The EventGate CLI returns deterministic exit codes to enforce hard boundaries in CI:
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded p-1.5">
                <span className="font-bold text-emerald-400 block">Exit 0</span>
                <span className="text-slate-400 text-[10px]">ALLOW (Safe)</span>
              </div>
              <div className="bg-rose-950/30 border border-rose-500/30 rounded p-1.5">
                <span className="font-bold text-rose-400 block">Exit 1</span>
                <span className="text-slate-400 text-[10px]">BLOCK (Break)</span>
              </div>
              <div className="bg-amber-950/30 border border-amber-500/30 rounded p-1.5">
                <span className="font-bold text-amber-400 block">Exit 2</span>
                <span className="text-slate-400 text-[10px]">REVIEW (Risk)</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded p-2.5 text-[11px] text-slate-400">
              <span className="text-slate-300 font-bold block mb-1">
                GitHub Actions Workflow
              </span>
              <code>.github/workflows/eventgate-contract-check.yml</code>
              <p className="mt-1 text-[10px] text-slate-500">
                Automatically triggered on PR when files under <code>contracts/**</code> change.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
