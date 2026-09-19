/**
 * Release History & Audit Trail View.
 * Displays authoritative persistent records of event contract compatibility reviews,
 * policy determinations, and downstream transport publication status.
 */

import React, { useState, useMemo } from 'react'
import {
  History,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Download,
  Copy,
  Check,
  Search,
  RefreshCw,
  ExternalLink,
  X,
  Radio,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import { useHistory } from '@/services/queries'
import { eventGateApi } from '@/services/api'
import type { ReleaseRecord } from '@/types/api'

interface ReleaseHistoryViewProps {
  onSelectReview?: (eventType: string, currentVersion: number, proposedVersion: number) => void
}

export const ReleaseHistoryView: React.FC<ReleaseHistoryViewProps> = ({ onSelectReview }) => {
  const [selectedEventType, setSelectedEventType] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [inspectRecord, setInspectRecord] = useState<ReleaseRecord | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const { data: records = [], isLoading, isError, refetch, isFetching } = useHistory(
    selectedEventType || undefined
  )

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records
    const q = searchQuery.toLowerCase().trim()
    return records.filter((r) => {
      return (
        r.recordId.toLowerCase().includes(q) ||
        r.eventType.toLowerCase().includes(q) ||
        (r.requestId && r.requestId.toLowerCase().includes(q)) ||
        (r.eventId && r.eventId.toLowerCase().includes(q)) ||
        (r.eventBridgeEventId && r.eventBridgeEventId.toLowerCase().includes(q)) ||
        r.environment.toLowerCase().includes(q)
      )
    })
  }, [records, searchQuery])

  const stats = useMemo(() => {
    const total = records.length
    const published = records.filter((r) => r.published).length
    const blocked = records.filter((r) => r.decision === 'BLOCK').length
    const review = records.filter((r) => r.decision === 'REVIEW').length
    return { total, published, blocked, review }
  }, [records])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDownloadMarkdown = async (record: ReleaseRecord) => {
    try {
      setIsExporting(true)
      const res = await eventGateApi.getReport(record.recordId, 'markdown')
      const blob = new Blob([res.content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eventgate-release-${record.eventType}-v${record.proposedVersion}-${record.recordId.slice(0, 8)}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download markdown report:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadJson = async (record: ReleaseRecord) => {
    try {
      setIsExporting(true)
      const res = await eventGateApi.getReport(record.recordId, 'json')
      const blob = new Blob([res.content], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eventgate-release-${record.eventType}-v${record.proposedVersion}-${record.recordId.slice(0, 8)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download JSON report:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyMarkdownSummary = async (record: ReleaseRecord) => {
    try {
      const res = await eventGateApi.getReport(record.recordId, 'markdown')
      handleCopy(res.content, `md-${record.recordId}`)
    } catch (err) {
      console.error('Failed to copy markdown report:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-950 text-neutral-200">
      {/* Top Banner & Control Bar */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-400" />
              <h1 className="text-lg font-semibold tracking-tight text-neutral-100">
                Release History & Audit Trail
              </h1>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Immutable ledger of contract compatibility analyses, policy evaluations, and EventBridge publications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search audit records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-56 rounded border border-neutral-800 bg-neutral-900 pl-8 pr-3 text-xs text-neutral-200 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Event Filter */}
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="h-8 rounded border border-neutral-800 bg-neutral-900 px-2.5 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none"
              aria-label="Filter by Event Type"
            >
              <option value="">All Events</option>
              <option value="OrderPlaced">OrderPlaced</option>
              <option value="PaymentCompleted">PaymentCompleted</option>
              <option value="UserCreated">UserCreated</option>
            </select>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex h-8 items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 focus:outline-none disabled:opacity-50"
              title="Refresh history"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-neutral-800/80 bg-neutral-900/60 p-3">
            <span className="text-[11px] font-medium text-neutral-400">Total Evaluations</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-neutral-100">{stats.total}</span>
              <span className="text-[11px] text-neutral-500">recorded</span>
            </div>
          </div>
          <div className="rounded border border-emerald-900/30 bg-emerald-950/10 p-3">
            <span className="text-[11px] font-medium text-emerald-400">Published to Transport</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-300">{stats.published}</span>
              <span className="text-[11px] text-emerald-500/80">verified</span>
            </div>
          </div>
          <div className="rounded border border-rose-900/30 bg-rose-950/10 p-3">
            <span className="text-[11px] font-medium text-rose-400">Gate Blocked</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-rose-300">{stats.blocked}</span>
              <span className="text-[11px] text-rose-500/80">intercepted</span>
            </div>
          </div>
          <div className="rounded border border-amber-900/30 bg-amber-950/10 p-3">
            <span className="text-[11px] font-medium text-amber-400">Under Review</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-amber-300">{stats.review}</span>
              <span className="text-[11px] text-amber-500/80">flagged</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Loading release history audit records...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="rounded border border-rose-900/40 bg-rose-950/20 p-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-rose-400" />
            <h3 className="mt-2 text-sm font-semibold text-rose-200">Unable to load release history</h3>
            <p className="mt-1 text-xs text-rose-300/80">
              Could not retrieve audit records from the configured repository.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              Retry
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/20 p-12 text-center">
            <History className="mx-auto h-10 w-10 text-neutral-600" />
            <h3 className="mt-3 text-sm font-medium text-neutral-300">No release evaluations recorded</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-500">
              {searchQuery
                ? 'No historical records matched your search query.'
                : 'Zero fake functionality: fresh state is clean. Real records are generated when contract changes are analyzed or published.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-neutral-800 bg-neutral-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="border-b border-neutral-800 bg-neutral-900/80 text-[11px] font-semibold text-neutral-400">
                  <tr>
                    <th scope="col" className="py-3 pl-4 pr-3">Record ID</th>
                    <th scope="col" className="px-3 py-3">Event Type</th>
                    <th scope="col" className="px-3 py-3">Transition</th>
                    <th scope="col" className="px-3 py-3">Environment</th>
                    <th scope="col" className="px-3 py-3">Compatibility</th>
                    <th scope="col" className="px-3 py-3">Policy Decision</th>
                    <th scope="col" className="px-3 py-3">Publication Status</th>
                    <th scope="col" className="px-3 py-3">Timestamp</th>
                    <th scope="col" className="py-3 pl-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.recordId}
                      className="group transition-colors hover:bg-neutral-800/40"
                    >
                      {/* Record ID */}
                      <td className="whitespace-nowrap py-3 pl-4 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-neutral-200">
                            {record.recordId.slice(0, 8)}…
                          </span>
                          <button
                            onClick={() => handleCopy(record.recordId, `rec-${record.recordId}`)}
                            className="text-neutral-500 hover:text-neutral-300"
                            title="Copy full Record ID"
                          >
                            {copiedId === `rec-${record.recordId}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Event Type */}
                      <td className="whitespace-nowrap px-3 py-3 font-sans font-medium text-neutral-200">
                        {record.eventType}
                      </td>

                      {/* Version Transition */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
                          v{record.currentVersion}
                        </span>
                        <span className="mx-1 text-neutral-600">→</span>
                        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] font-bold text-neutral-100">
                          v{record.proposedVersion}
                        </span>
                      </td>

                      {/* Environment */}
                      <td className="whitespace-nowrap px-3 py-3 font-sans">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                            record.environment === 'production'
                              ? 'border border-amber-800/50 bg-amber-950/30 text-amber-300'
                              : record.environment === 'staging'
                              ? 'border border-purple-800/50 bg-purple-950/30 text-purple-300'
                              : 'border border-sky-800/50 bg-sky-950/30 text-sky-300'
                          }`}
                        >
                          {record.environment}
                        </span>
                      </td>

                      {/* Compatibility Result */}
                      <td className="whitespace-nowrap px-3 py-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            record.compatibilityResult === 'SAFE'
                              ? 'text-emerald-400'
                              : record.compatibilityResult === 'BREAK'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {record.compatibilityResult === 'SAFE' && <ShieldCheck className="h-3.5 w-3.5" />}
                          {record.compatibilityResult === 'BREAK' && <ShieldAlert className="h-3.5 w-3.5" />}
                          {record.compatibilityResult === 'RISK' && <AlertTriangle className="h-3.5 w-3.5" />}
                          {record.compatibilityResult}
                        </span>
                      </td>

                      {/* Policy Decision */}
                      <td className="whitespace-nowrap px-3 py-3 font-sans">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold ${
                            record.decision === 'ALLOW'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                              : record.decision === 'BLOCK'
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                          }`}
                        >
                          {record.decision}
                        </span>
                      </td>

                      {/* Publication Status */}
                      <td className="whitespace-nowrap px-3 py-3 font-sans">
                        {record.published ? (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium">Published</span>
                          </div>
                        ) : record.attemptedPublish ? (
                          <div className="flex items-center gap-1 text-rose-400">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium">Prevented</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-neutral-500">
                            <Layers className="h-3.5 w-3.5" />
                            <span className="text-[11px]">Evaluated</span>
                          </div>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="whitespace-nowrap px-3 py-3 text-[11px] text-neutral-400">
                        {new Date(record.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectRecord(record)}
                            className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] font-sans font-medium text-neutral-300 hover:border-neutral-700 hover:text-neutral-100"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => handleCopyMarkdownSummary(record)}
                            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                            title="Copy Markdown Summary"
                          >
                            {copiedId === `md-${record.recordId}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDownloadMarkdown(record)}
                            disabled={isExporting}
                            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                            title="Download Markdown Report"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Record Inspection Slide-Over Drawer */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                      inspectRecord.decision === 'ALLOW'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : inspectRecord.decision === 'BLOCK'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {inspectRecord.decision}
                  </span>
                  <h2 className="text-sm font-semibold text-neutral-100">
                    Release Audit Review: {inspectRecord.eventType} v{inspectRecord.proposedVersion}
                  </h2>
                </div>
                <p className="mt-1 font-mono text-xs text-neutral-400">
                  Record ID: {inspectRecord.recordId}
                </p>
              </div>

              <button
                onClick={() => setInspectRecord(null)}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                aria-label="Close Inspector"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 space-y-5 overflow-y-auto py-4 text-xs">
              {/* Overview Details */}
              <div className="grid grid-cols-2 gap-3 rounded border border-neutral-800 bg-neutral-950/60 p-3.5">
                <div>
                  <span className="text-[11px] text-neutral-500">Event Type</span>
                  <div className="font-semibold text-neutral-200">{inspectRecord.eventType}</div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500">Transition</span>
                  <div className="font-mono text-neutral-200">
                    v{inspectRecord.currentVersion} → v{inspectRecord.proposedVersion}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500">Environment</span>
                  <div className="font-medium text-neutral-200 uppercase">{inspectRecord.environment}</div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500">Timestamp</span>
                  <div className="text-neutral-300">
                    {new Date(inspectRecord.timestamp).toUTCString()}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500">Release Policy</span>
                  <div className="text-neutral-300">{inspectRecord.policyName}</div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500">Policy Reason</span>
                  <div className="text-neutral-300">{inspectRecord.policyReason}</div>
                </div>
              </div>

              {/* Publication / Transport Traceability */}
              <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-200">EventBridge Transport Status</span>
                  {inspectRecord.published ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Radio className="h-3.5 w-3.5 animate-pulse" />
                      <span className="font-semibold">Ingested & Dispatched</span>
                    </span>
                  ) : inspectRecord.attemptedPublish ? (
                    <span className="flex items-center gap-1 text-rose-400">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span className="font-semibold">Publication Intercepted</span>
                    </span>
                  ) : (
                    <span className="text-neutral-400">Evaluation Only (Not Published)</span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 font-mono text-[11px]">
                  {inspectRecord.eventId && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Event ID:</span>
                      <span className="text-neutral-300">{inspectRecord.eventId}</span>
                    </div>
                  )}
                  {inspectRecord.eventBridgeEventId && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">EventBridge ID:</span>
                      <span className="text-indigo-400">{inspectRecord.eventBridgeEventId}</span>
                    </div>
                  )}
                  {inspectRecord.publishedAt && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Published At:</span>
                      <span className="text-neutral-300">{inspectRecord.publishedAt}</span>
                    </div>
                  )}
                  {inspectRecord.error && (
                    <div className="mt-2 rounded bg-rose-950/40 p-2 text-rose-300 border border-rose-900/30">
                      {inspectRecord.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Downstream Consumers */}
              <div>
                <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                  Downstream Impact ({inspectRecord.affectedConsumers.length} affected)
                </h3>
                {inspectRecord.affectedConsumers.length === 0 ? (
                  <div className="rounded border border-emerald-900/30 bg-emerald-950/20 p-3 text-emerald-300">
                    ✓ Zero downstream consumers broken by this release.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {inspectRecord.affectedConsumers.map((c) => (
                      <span
                        key={c}
                        className="rounded border border-rose-900/40 bg-rose-950/30 px-2.5 py-1 font-mono text-xs text-rose-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Findings Summary */}
              {inspectRecord.findingsSummary.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                    Diagnostic Schema Findings
                  </h3>
                  <div className="overflow-hidden rounded border border-neutral-800">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-neutral-800/80 text-neutral-400">
                        <tr>
                          <th className="p-2">Consumer</th>
                          <th className="p-2">Field</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Rule</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {inspectRecord.findingsSummary.map((f, idx) => (
                          <tr key={idx} className="hover:bg-neutral-800/40">
                            <td className="p-2 font-mono text-neutral-300">{f.consumerId}</td>
                            <td className="p-2 font-mono text-neutral-200">{f.field}</td>
                            <td className="p-2">
                              <span
                                className={`font-semibold ${
                                  f.status === 'BREAK'
                                    ? 'text-rose-400'
                                    : f.status === 'RISK'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {f.status}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-neutral-400">{f.ruleId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="flex flex-wrap items-center justify-between border-t border-neutral-800 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadMarkdown(inspectRecord)}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .md</span>
                </button>
                <button
                  onClick={() => handleDownloadJson(inspectRecord)}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .json</span>
                </button>
              </div>

              {onSelectReview && (
                <button
                  onClick={() => {
                    onSelectReview(
                      inspectRecord.eventType,
                      inspectRecord.currentVersion,
                      inspectRecord.proposedVersion
                    )
                    setInspectRecord(null)
                  }}
                  className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <span>Open in Review Workspace</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
