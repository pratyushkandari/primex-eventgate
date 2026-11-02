import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { usePolicies } from '@/services/queries'

function DecisionCell({ value }: { value: string }) {
  const [decision, ...rest] = value.split(' ')
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge value={decision} />
      {rest.length > 0 && <span className="text-xs text-fg-subtle">{rest.join(' ')}</span>}
    </span>
  )
}

/** The release policy the API enforces, read from GET /api/v1/policies. */
export function PoliciesView() {
  const policies = usePolicies()

  return (
    <div>
      <PageHeader
        title="Release policy"
        description="Compatibility says what a change does to consumers. The policy decides what happens to the release in each environment."
        actions={policies.data && <Badge tone="accent">Active engine: {policies.data.engineName}</Badge>}
      />

      {policies.isPending ? (
        <SkeletonRows label="Loading release policy" />
      ) : policies.isError ? (
        <ErrorState title="Could not load the release policy" error={policies.error} onRetry={() => policies.refetch()} />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Decision matrix" description={policies.data.description} />
            <div className="p-4">
              <div tabIndex={0} role="region" aria-label="Decision matrix" className="relative overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Release decision by environment and severity</caption>
                <thead className="text-xs text-fg-subtle">
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-4 font-medium">Environment</th>
                    <th scope="col" className="py-2 pr-4 font-medium">SAFE (low severity)</th>
                    <th scope="col" className="py-2 pr-4 font-medium">RISK (medium)</th>
                    <th scope="col" className="py-2 font-medium">BREAK (high)</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.data.matrix.map((row) => (
                    <tr key={row.environment} className="border-b border-line/60 last:border-0">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-fg">
                        {row.environment}
                      </th>
                      <td className="py-2.5 pr-4"><DecisionCell value={row.low} /></td>
                      <td className="py-2.5 pr-4"><DecisionCell value={row.medium} /></td>
                      <td className="py-2.5"><DecisionCell value={row.high} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <ul className="mt-4 space-y-1 text-sm text-fg-muted">
                <li><span className="font-mono text-fg">ALLOW</span>: the publish endpoint sends the event to the bus.</li>
                <li><span className="font-mono text-fg">REVIEW</span>: publishing returns HTTP 409 until the change is reviewed.</li>
                <li><span className="font-mono text-fg">BLOCK</span>: publishing returns HTTP 409; the bus is never called.</li>
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Cedar policy"
              description={
                policies.data.activeEngine === 'cedar'
                  ? 'This policy is evaluated on every request.'
                  : 'Shipped with the service. Set EVENTGATE_POLICY_ENGINE=cedar to evaluate it instead of the standard engine; both give the same decisions.'
              }
              actions={
                policies.data.cedarPolicyText && (
                  <CopyButton value={policies.data.cedarPolicyText} label="Copy Cedar policy" showText />
                )
              }
            />
            <div className="p-4">
              {policies.data.cedarPolicyAvailable && policies.data.cedarPolicyText ? (
                <details>
                  <summary className="cursor-pointer text-sm text-accent-fg">Show policy source</summary>
                  <pre tabIndex={0} aria-label="Cedar policy source" className="mt-3 max-h-[28rem] overflow-auto rounded-[var(--radius-control)] border border-line bg-canvas p-3 font-mono text-xs leading-5 text-fg">
                    {policies.data.cedarPolicyText}
                  </pre>
                </details>
              ) : (
                <p className="text-sm text-fg-subtle">The Cedar policy file is not available on this deployment.</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
