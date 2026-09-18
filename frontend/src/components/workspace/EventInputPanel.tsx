import * as React from 'react'
import { AlignLeft, RotateCcw, AlertCircle, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface EventInputPanelProps {
  eventType: string
  currentVersion: number
  proposedVersion: number
  payloadText: string
  jsonError: string | null
  isAnalyzing: boolean
  onProposedVersionChange: (version: number) => void
  onPayloadTextChange: (text: string) => void
  onFormatPayload: () => void
  onResetPayload: () => void
  onAnalyze: () => void
}

export function EventInputPanel({
  eventType,
  currentVersion,
  proposedVersion,
  payloadText,
  jsonError,
  isAnalyzing,
  onProposedVersionChange,
  onPayloadTextChange,
  onFormatPayload,
  onResetPayload,
  onAnalyze,
}: EventInputPanelProps) {
  const lineCount = React.useMemo(() => {
    return Math.max(payloadText.split('\n').length, 10)
  }, [payloadText])

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Support Tab key for 2 spaces indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const newValue = payloadText.substring(0, start) + '  ' + payloadText.substring(end)
      onPayloadTextChange(newValue)
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
        }
      })
    }
  }

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Contract change
            </CardTitle>
            <span className="text-[10px] font-mono text-slate-500">
              schema v{currentVersion} → v{proposedVersion}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {/* Form Controls: Event & Versions */}
          <div className="space-y-2">
            <div>
              <label
                htmlFor="event-type"
                className="block text-[11px] font-mono uppercase text-slate-400 mb-1"
              >
                Event
              </label>
              <input
                id="event-type"
                type="text"
                value={eventType}
                readOnly
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none cursor-default select-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="current-version"
                  className="block text-[11px] font-mono uppercase text-slate-400 mb-1"
                >
                  Current
                </label>
                <div
                  id="current-version"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-400"
                >
                  v{currentVersion} (Baseline)
                </div>
              </div>

              <div>
                <label
                  htmlFor="proposed-version-select"
                  className="block text-[11px] font-mono uppercase text-slate-400 mb-1"
                >
                  Proposed
                </label>
                <select
                  id="proposed-version-select"
                  value={proposedVersion}
                  onChange={(e) => onProposedVersionChange(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-blue-400 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={2}>v2 (Safe addition)</option>
                  <option value={3}>v3 (Breaking change)</option>
                  <option value={4}>v4 (Risky removal)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Event Payload Editor */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="payload-editor"
                className="text-[11px] font-mono uppercase text-slate-400"
              >
                Event payload
              </label>
              <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                <button
                  type="button"
                  onClick={onFormatPayload}
                  title="Format JSON"
                  className="hover:text-slate-200 flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <AlignLeft className="h-3 w-3" />
                  <span>Format</span>
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={onResetPayload}
                  title="Reset to default payload"
                  className="hover:text-slate-200 flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Code Surface with line gutter */}
            <div
              className={`rounded border flex overflow-hidden bg-[#0a0e17] transition-colors ${
                jsonError
                  ? 'border-rose-500/70 focus-within:border-rose-500'
                  : 'border-slate-800 focus-within:border-blue-500/60'
              }`}
            >
              {/* Line Gutter */}
              <div
                aria-hidden="true"
                className="bg-[#070a10] text-slate-600 font-mono text-[11px] leading-[20px] py-2 px-1.5 select-none text-right border-r border-slate-800/80 min-w-[28px]"
              >
                {Array.from({ length: lineCount }).map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                id="payload-editor"
                value={payloadText}
                onChange={(e) => onPayloadTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={10}
                spellCheck={false}
                placeholder="Enter JSON payload..."
                className="flex-1 bg-transparent p-2 font-mono text-xs text-slate-200 focus:outline-none leading-[20px] resize-none"
              />
            </div>

            {/* Inline Syntax Validation Error */}
            {jsonError && (
              <div className="mt-1.5 p-2 rounded bg-rose-950/30 border border-rose-500/30 text-xs text-rose-400 flex items-start space-x-1.5 font-mono">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <div className="leading-snug truncate">
                  <span className="font-semibold block">Invalid JSON</span>
                  <span className="text-[11px] text-rose-300">{jsonError}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </div>

      <div className="p-4 pt-0">
        <Button
          onClick={onAnalyze}
          isLoading={isAnalyzing}
          disabled={Boolean(jsonError)}
          aria-label="Analyze Compatibility"
          className="w-full"
          size="sm"
        >
          <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
          <span>Analyze change</span>
        </Button>
      </div>
    </Card>
  )
}
