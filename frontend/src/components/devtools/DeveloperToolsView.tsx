/**
 * Developer tools: assert that a change produces an expected decision (the same
 * check as `eventgate test`), plus the CLI commands and CI exit codes for it.
 */

import * as React from 'react'
import { CheckCircle2, ExternalLink, Play, XCircle } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { FieldMessage, Label, Select } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState } from '@/components/ui/States'
import type { ChangeSelection } from '@/components/workspace/useReviewSession'
import { expectedDecisionFor, findScenario, SCENARIO_LIST } from '@/data/scenarios'
import { consumerImpacts } from '@/lib/findings'
import { cn } from '@/lib/utils'
import { eventGateApi } from '@/services/api'
import { useEventCatalog, useEventDetail } from '@/services/queries'
import { ENVIRONMENTS, type AnalysisResponse, type Decision, type Environment } from '@/types/api'

interface DeveloperToolsViewProps {
  environment: Environment
  onOpenReview?: (change: ChangeSelection) => void
}

interface RunSnapshot extends ChangeSelection {
  environment: Environment
  expected: Decision
}

export function DeveloperToolsView({ environment: globalEnvironment, onOpenReview }: DeveloperToolsViewProps) {
  const catalog = useEventCatalog()
  const [change, setChange] = React.useState<ChangeSelection>({ eventType: 'OrderPlaced', currentVersion: 1, proposedVersion: 2 })
  const [environment, setEnvironment] = React.useState<Environment>(globalEnvironment)
  const [override, setOverride] = React.useState<Decision | ''>('')
  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState<{ snapshot: RunSnapshot; analysis: AnalysisResponse } | null>(null)
  const [error, setError] = React.useState<unknown>(null)
  const detail = useEventDetail(change.eventType)

  const versions = detail.data?.versions ?? [change.currentVersion, change.proposedVersion]
  const suggestion = expectedDecisionFor(change, environment)
  const expected: Decision | null = override || suggestion

  const update = (next: Partial<ChangeSelection>, nextEnv = environment) => {
    setChange((c) => ({ ...c, ...next }))
    setEnvironment(nextEnv)
    setOverride('')
    setResult(null)
    setError(null)
  }

  const run = async () => {
    if (!expected) return
    setRunning(true)
    setError(null)
    const snapshot: RunSnapshot = { ...change, environment, expected }
    try {
      const analysis = await eventGateApi.analyzeCompatibility({ ...change, environment })
      setResult({ snapshot, analysis })
    } catch (err) {
      setResult(null)
      setError(err)
    } finally {
      setRunning(false)
    }
  }

  const commands = [
    {
      title: 'Check a change (exit 0 ALLOW, 1 BLOCK, 2 REVIEW)',
      cmd: `eventgate check --event ${change.eventType} --current ${change.currentVersion} --proposed ${change.proposedVersion} --env ${environment}`,
    },
    {
      title: 'Fail CI on REVIEW as well as BLOCK',
      cmd: `eventgate check --event ${change.eventType} --current ${change.currentVersion} --proposed ${change.proposedVersion} --env ${environment} --fail-on-review`,
    },
    {
      title: 'Assert the expected decision',
      cmd: `eventgate test --event ${change.eventType} --current ${change.currentVersion} --proposed ${change.proposedVersion} --expected ${expected ?? 'ALLOW'} --env ${environment}`,
    },
    { title: 'Show versions and consumers', cmd: `eventgate catalog --event ${change.eventType}` },
  ]

  const passed = result ? result.analysis.decision === result.snapshot.expected : false

  return (
    <div>
      <PageHeader title="Developer tools" description="Assert gate decisions against the live API and copy the matching CLI commands." />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Decision assertion" description="Runs an analysis and compares the decision with the one you expect." />
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-subtle">Samples</span>
              {SCENARIO_LIST.map((s) => {
                const active = findScenario(change.eventType, change.currentVersion, change.proposedVersion)?.id === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ eventType: s.eventType, currentVersion: s.currentVersion, proposedVersion: s.proposedVersion })}
                    className={cn(
                      'rounded-[var(--radius-control)] border px-2.5 py-1 text-xs transition-colors duration-150',
                      active ? 'border-accent bg-accent-tint text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                    )}
                  >
                    {s.eventType} v{s.currentVersion}→v{s.proposedVersion} ({s.compatibility})
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="dt-event">Event type</Label>
                <Select
                  id="dt-event"
                  value={change.eventType}
                  onChange={(e) => {
                    const v = catalog.data?.find((c) => c.eventType === e.target.value)?.versions ?? [1, 2]
                    update({ eventType: e.target.value, currentVersion: v[0], proposedVersion: v[1] ?? v[0] })
                  }}
                >
                  {(catalog.data?.map((c) => c.eventType) ?? [change.eventType]).map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="dt-env">Environment</Label>
                <Select id="dt-env" value={environment} onChange={(e) => update({}, e.target.value as Environment)}>
                  {ENVIRONMENTS.map((env) => (
                    <option key={env} value={env}>
                      {env}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="dt-current">Current version</Label>
                <Select id="dt-current" value={change.currentVersion} onChange={(e) => update({ currentVersion: Number(e.target.value) })}>
                  {versions.map((v) => (
                    <option key={v} value={v}>
                      v{v}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="dt-proposed">Proposed version</Label>
                <Select id="dt-proposed" value={change.proposedVersion} onChange={(e) => update({ proposedVersion: Number(e.target.value) })}>
                  {versions.map((v) => (
                    <option key={v} value={v}>
                      v{v}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="dt-expected">Expected decision</Label>
                <Select
                  id="dt-expected"
                  value={override || suggestion || ''}
                  onChange={(e) => {
                    setOverride(e.target.value as Decision | '')
                    setResult(null)
                  }}
                >
                  {!suggestion && <option value="">Choose a decision</option>}
                  <option value="ALLOW">ALLOW</option>
                  <option value="REVIEW">REVIEW</option>
                  <option value="BLOCK">BLOCK</option>
                </Select>
                <FieldMessage>
                  {suggestion
                    ? override && override !== suggestion
                      ? `Overriding the sample's expected ${suggestion}.`
                      : 'Filled in from the sample change.'
                    : 'No sample covers this change; choose the decision you expect.'}
                  {override && override !== suggestion && suggestion && (
                    <button type="button" onClick={() => setOverride('')} className="ml-2 text-accent-fg underline-offset-2 hover:underline">
                      Use {suggestion}
                    </button>
                  )}
                </FieldMessage>
              </div>
            </div>

            <Button onClick={run} isLoading={running} disabled={!expected || change.currentVersion === change.proposedVersion} className="w-full">
              {!running && <Play className="h-4 w-4" aria-hidden="true" />}
              Run assertion
            </Button>
            {change.currentVersion === change.proposedVersion && (
              <FieldMessage error>Choose two different versions.</FieldMessage>
            )}

            {Boolean(error) && <ErrorState title="The assertion could not run" error={error} onRetry={run} />}

            {result && (
              <div aria-live="polite" className="space-y-3">
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-[var(--radius-card)] border p-4',
                    passed ? 'border-success-line bg-success-tint/50' : 'border-danger-line bg-danger-tint/50'
                  )}
                >
                  {passed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium text-fg">
                      {passed ? 'Pass' : 'Fail'}: expected {result.snapshot.expected}, got {result.analysis.decision}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-fg-subtle">
                      {result.snapshot.eventType} v{result.snapshot.currentVersion}→v{result.snapshot.proposedVersion} ·{' '}
                      {result.snapshot.environment} · request {result.analysis.requestId ?? 'n/a'}
                    </p>
                    <p className="mt-1 text-fg-muted">{result.analysis.policyReason}</p>
                  </div>
                </div>
                <ul aria-label="Consumer results" className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                  {consumerImpacts([], result.analysis.findings).map((impact) => (
                    <li key={impact.consumerId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-mono text-fg">{impact.consumerId}</span>
                      <StatusBadge value={impact.status} />
                      <span className="w-full text-xs text-fg-subtle sm:w-auto sm:flex-1 sm:text-right">
                        {impact.findings[0]?.ruleId}
                      </span>
                    </li>
                  ))}
                </ul>
                {onOpenReview && (
                  <Button variant="secondary" size="sm" onClick={() => onOpenReview(result.snapshot)}>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Open this change in Review
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="CLI commands" description="Equivalent commands for the inputs on the left." />
            <ul className="space-y-3 p-4">
              {commands.map((c) => (
                <li key={c.title}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-subtle">{c.title}</span>
                    <CopyButton value={c.cmd} label={`Copy command: ${c.title}`} />
                  </div>
                  <pre tabIndex={0} className="overflow-x-auto rounded-[var(--radius-control)] border border-line bg-canvas px-3 py-2 font-mono text-xs text-fg">
                    {c.cmd}
                  </pre>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="CI gate" description=".github/workflows/eventgate-contract-check.yml runs on pull requests that touch contracts/**." />
            <div className="p-4">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">eventgate check exit codes</caption>
              <thead className="text-xs text-fg-subtle">
                <tr className="border-b border-line">
                  <th scope="col" className="py-1.5 font-medium">Exit code</th>
                  <th scope="col" className="py-1.5 font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-fg-muted">
                <tr className="border-b border-line/60">
                  <td className="py-1.5 font-mono text-fg">0</td>
                  <td className="py-1.5">ALLOW</td>
                </tr>
                <tr className="border-b border-line/60">
                  <td className="py-1.5 font-mono text-fg">1</td>
                  <td className="py-1.5">BLOCK, an error, or REVIEW with --fail-on-review</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-mono text-fg">2</td>
                  <td className="py-1.5">REVIEW</td>
                </tr>
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
