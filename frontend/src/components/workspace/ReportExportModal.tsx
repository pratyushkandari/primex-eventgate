import * as React from 'react'
import { Copy, Download } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/toast-context'
import { describeError, eventGateApi } from '@/services/api'
import { downloadText } from '@/lib/utils'
import type { AnalysisResponse, ReportFormat } from '@/types/api'

interface ReportExportModalProps {
  isOpen: boolean
  onClose: () => void
  analysis: AnalysisResponse | null
}

/** Exports the stored history record for the current analysis as Markdown or JSON. */
export function ReportExportModal({ isOpen, onClose, analysis }: ReportExportModalProps) {
  const toast = useToast()
  const [busy, setBusy] = React.useState<null | 'copy' | ReportFormat>(null)

  if (!analysis) return null

  const fetchReport = (format: ReportFormat) => eventGateApi.getReport(analysis.analysisId, format)

  const copyMarkdown = async () => {
    setBusy('copy')
    try {
      const report = await fetchReport('markdown')
      await navigator.clipboard.writeText(report.content)
      toast('Report copied', 'Markdown report copied to the clipboard.', 'success')
    } catch (err) {
      toast('Could not copy the report', describeError(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const download = async (format: ReportFormat) => {
    setBusy(format)
    try {
      const report = await fetchReport(format)
      const ext = format === 'json' ? 'json' : 'md'
      downloadText(
        `eventgate-${analysis.eventType}-v${analysis.currentVersion}-v${analysis.proposedVersion}.${ext}`,
        report.content,
        format === 'json' ? 'application/json' : 'text/markdown'
      )
      toast('Report downloaded', `Saved as .${ext}`, 'success')
    } catch (err) {
      toast('Could not download the report', describeError(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Export release report"
      description="The report is rendered from the record saved in release history for this analysis."
      footer={
        <>
          <Button variant="secondary" onClick={copyMarkdown} isLoading={busy === 'copy'} disabled={busy !== null}>
            {busy !== 'copy' && <Copy className="h-4 w-4" aria-hidden="true" />}
            Copy Markdown
          </Button>
          <Button variant="secondary" onClick={() => download('json')} isLoading={busy === 'json'} disabled={busy !== null}>
            {busy !== 'json' && <Download className="h-4 w-4" aria-hidden="true" />}
            Download JSON
          </Button>
          <Button onClick={() => download('markdown')} isLoading={busy === 'markdown'} disabled={busy !== null}>
            {busy !== 'markdown' && <Download className="h-4 w-4" aria-hidden="true" />}
            Download Markdown
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-fg-subtle">Change</dt>
        <dd className="text-fg">
          {analysis.eventType} <span className="font-mono">v{analysis.currentVersion} → v{analysis.proposedVersion}</span>
        </dd>
        <dt className="text-fg-subtle">Environment</dt>
        <dd className="text-fg">{analysis.environment}</dd>
        <dt className="text-fg-subtle">Decision</dt>
        <dd>
          <StatusBadge value={analysis.decision} />
        </dd>
        <dt className="text-fg-subtle">Analysis ID</dt>
        <dd className="break-all font-mono text-xs text-fg-muted">{analysis.analysisId}</dd>
      </dl>
    </Dialog>
  )
}
