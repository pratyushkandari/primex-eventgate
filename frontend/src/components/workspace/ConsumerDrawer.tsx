import { Dialog } from '@/components/ui/Dialog'
import { StatusBadge } from '@/components/ui/Badge'
import type { ConsumerImpact } from '@/lib/findings'
import type { SubscribedConsumer } from '@/types/api'

interface ConsumerDrawerProps {
  impact: ConsumerImpact | null
  contract?: SubscribedConsumer
  hasAnalysis: boolean
  onClose: () => void
}

/** Side panel with a consumer's findings and the fields its contract expects. */
export function ConsumerDrawer({ impact, contract, hasAnalysis, onClose }: ConsumerDrawerProps) {
  return (
    <Dialog
      open={impact !== null}
      onClose={onClose}
      variant="drawer"
      title={<span className="font-mono">{impact?.consumerId}</span>}
      description={contract ? `Consumes ${contract.eventType}` : undefined}
    >
      {impact && (
        <div className="space-y-6 text-sm">
          <section>
            <h3 className="mb-2 text-xs font-medium text-fg-subtle">Compatibility</h3>
            {!hasAnalysis ? (
              <p className="text-fg-muted">Run an analysis to see how this change affects the consumer.</p>
            ) : (
              <ul className="space-y-2">
                {impact.findings.map((f) => (
                  <li key={`${f.ruleId}-${f.field}`} className="rounded-[var(--radius-control)] border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={f.status} />
                      <span className="font-mono text-xs text-fg-subtle">{f.ruleId}</span>
                      <span className="ml-auto text-xs text-fg-subtle">severity {f.severity}</span>
                    </div>
                    {f.field !== '*' && (
                      <p className="mt-2 font-mono text-fg">
                        {f.field}
                        {f.expectedType && (
                          <span className="text-fg-subtle">
                            {' '}expects {f.expectedType}
                            {f.proposedType ? `, proposed ${f.proposedType}` : ', absent in proposed'}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="mt-1 text-fg-muted">{f.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {contract && (
            <section>
              <h3 className="mb-2 text-xs font-medium text-fg-subtle">Expected fields</h3>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-subtle">
                    <th scope="col" className="py-1.5 font-medium">Field</th>
                    <th scope="col" className="py-1.5 font-medium">Type</th>
                    <th scope="col" className="py-1.5 font-medium">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(contract.expectedFields).map((field) => (
                    <tr key={field.name} className="border-b border-line/60">
                      <td className="py-1.5 font-mono text-fg">{field.name}</td>
                      <td className="py-1.5 font-mono text-fg-muted">{field.type}</td>
                      <td className="py-1.5 text-fg-muted">{field.required ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </Dialog>
  )
}
