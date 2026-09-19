import * as React from 'react'
import { FileText, Download, Copy, Check, X, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react'
import type { AnalysisResponse } from '@/types/api'
import { eventGateApi } from '@/services/api'

interface ReportExportModalProps {
  isOpen: boolean
  onClose: () => void
  analysis: AnalysisResponse | null
  onToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  analysis,
  onToast,
}) => {
  const [copied, setCopied] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)

  if (!isOpen || !analysis) return null

  const handleCopyMarkdown = async () => {
    try {
      setIsGenerating(true)
      const res = await eventGateApi.exportActiveReport({
        analysisId: analysis.analysisId,
        eventType: analysis.eventType,
        currentVersion: analysis.currentVersion,
        proposedVersion: analysis.proposedVersion,
        environment: analysis.environment || 'production',
        compatibilityResult: analysis.compatibilityResult || 'SAFE',
        severity: analysis.severity,
        policyName: analysis.policyName || 'StandardReleasePolicy',
        policyReason: analysis.policyReason || analysis.summary,
        decision: analysis.decision,
        affectedConsumers: analysis.findings.filter((f) => f.status !== 'SAFE').map((f) => f.consumerId),
        findingsSummary: analysis.findings,
        format: 'markdown',
      })
      await navigator.clipboard.writeText(res.content)
      setCopied(true)
      onToast('Report Copied', 'Release review markdown copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to export markdown report:', err)
      onToast('Export Failed', 'Could not generate report', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (format: 'markdown' | 'json') => {
    try {
      setIsGenerating(true)
      const res = await eventGateApi.exportActiveReport({
        analysisId: analysis.analysisId,
        eventType: analysis.eventType,
        currentVersion: analysis.currentVersion,
        proposedVersion: analysis.proposedVersion,
        environment: analysis.environment || 'production',
        compatibilityResult: analysis.compatibilityResult || 'SAFE',
        severity: analysis.severity,
        policyName: analysis.policyName || 'StandardReleasePolicy',
        policyReason: analysis.policyReason || analysis.summary,
        decision: analysis.decision,
        affectedConsumers: analysis.findings.filter((f) => f.status !== 'SAFE').map((f) => f.consumerId),
        findingsSummary: analysis.findings,
        format,
      })

      const mime = format === 'json' ? 'application/json' : 'text/markdown'
      const ext = format === 'json' ? 'json' : 'md'
      const blob = new Blob([res.content], { type: `${mime};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eventgate-report-${analysis.eventType}-v${analysis.proposedVersion}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      onToast('Report Downloaded', `Generated ${ext.toUpperCase()} release artifact`, 'success')
    } catch (err) {
      console.error(`Failed to download ${format} report:`, err)
      onToast('Download Failed', 'Could not export report file', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl p-6 text-neutral-200">
        <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">Export Release Review</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Generate audit evidence for PRs, CI, or compliance records.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 cursor-pointer"
            aria-label="Close Export Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Overview Box */}
        <div className="my-5 rounded border border-neutral-800 bg-neutral-950/60 p-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500">Event:</span>
            <span className="font-semibold text-neutral-200">{analysis.eventType}</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-neutral-500">Transition:</span>
            <span className="text-neutral-200">v{analysis.currentVersion} → v{analysis.proposedVersion}</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-neutral-500">Environment:</span>
            <span className="text-neutral-200 uppercase">{analysis.environment || 'production'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Decision:</span>
            <span
              className={`inline-flex items-center gap-1 font-bold rounded px-1.5 py-0.5 text-[10px] ${
                analysis.decision === 'ALLOW'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : analysis.decision === 'BLOCK'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {analysis.decision === 'ALLOW' && <ShieldCheck className="h-3 w-3" />}
              {analysis.decision === 'BLOCK' && <ShieldAlert className="h-3 w-3" />}
              {analysis.decision === 'REVIEW' && <AlertTriangle className="h-3 w-3" />}
              {analysis.decision}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Analysis ID:</span>
            <span className="font-mono text-neutral-400">{analysis.analysisId.slice(0, 16)}…</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleCopyMarkdown}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Markdown Copied!' : 'Copy Markdown Summary'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleDownload('markdown')}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Markdown</span>
            </button>
            <button
              onClick={() => handleDownload('json')}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
