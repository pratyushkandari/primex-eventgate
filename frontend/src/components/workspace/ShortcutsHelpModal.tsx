import { Dialog } from '@/components/ui/Dialog'

interface ShortcutsHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS: Array<[string, string]> = [
  ['Ctrl K / ⌘ K', 'Open the command palette'],
  ['Ctrl Enter / ⌘ Enter', 'Analyze the current change (Review page)'],
  ['?', 'Open this help'],
  ['Esc', 'Close a dialog, drawer or palette'],
  ['Tab (in the payload editor)', 'Insert two spaces; press Esc first to move focus instead'],
]

const RULES: Array<[string, string, string]> = [
  ['EVT001', 'BREAK', 'A field the consumer reads changed to an incompatible type'],
  ['EVT003', 'BREAK', 'A field the consumer requires is missing from the proposed contract'],
  ['EVT004', 'BREAK', 'A field the consumer reads changed between required and optional'],
  ['EVT006', 'RISK', 'An optional field the consumer reads was removed'],
  ['EVT005', 'SAFE', 'Only optional fields the consumer does not read were added'],
  ['EVT008', 'SAFE', 'No change touches the fields the consumer reads'],
]

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} title="Keyboard shortcuts and rules" size="lg">
      <div className="space-y-6 text-sm">
        <section>
          <h3 className="mb-2 text-xs font-medium text-fg-subtle">Shortcuts</h3>
          <dl className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="flex items-center justify-between gap-4 px-3 py-2">
                <dt className="text-fg-muted">{action}</dt>
                <dd>
                  <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 text-xs text-fg">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-medium text-fg-subtle">Compatibility rules</h3>
          <table className="w-full text-left">
            <thead className="text-xs text-fg-subtle">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pr-3 font-medium">Rule</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Result</th>
                <th scope="col" className="py-1.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map(([id, status, when]) => (
                <tr key={id} className="border-b border-line/60">
                  <td className="py-1.5 pr-3 font-mono text-fg">{id}</td>
                  <td className="py-1.5 pr-3 font-mono text-fg-muted">{status}</td>
                  <td className="py-1.5 text-fg-muted">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-fg-subtle">
            Any BREAK blocks the release everywhere. A RISK needs review in staging and production and is allowed
            with a warning in development. An event with no registered consumers needs review.
          </p>
        </section>
      </div>
    </Dialog>
  )
}
