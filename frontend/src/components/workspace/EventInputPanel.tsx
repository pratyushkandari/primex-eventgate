import { Layers, Activity, RotateCcw, AlignLeft, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
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
  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span>Contract & Payload</span>
            </CardTitle>
            <Badge variant="neutral">Input</Badge>
          </div>
          <CardDescription>
            Configure the proposed schema evolution and test event payload
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Event Type */}
          <div>
            <label htmlFor="event-type" className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Event Type
            </label>
            <input
              id="event-type"
              type="text"
              value={eventType}
              readOnly
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none"
            />
          </div>

          {/* Versions Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="current-version" className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Current Version
              </label>
              <div
                id="current-version"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-400"
              >
                v{currentVersion} (Baseline)
              </div>
            </div>

            <div>
              <label htmlFor="proposed-version-select" className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Proposed Version
              </label>
              <select
                id="proposed-version-select"
                value={proposedVersion}
                onChange={(e) => onProposedVersionChange(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-blue-400 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={2}>v2 (Safe Addition)</option>
                <option value={3}>v3 (Breaking Change)</option>
                <option value={4}>v4 (Risky Removal)</option>
              </select>
            </div>
          </div>

          {/* Payload Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="payload-editor" className="text-xs font-mono uppercase text-slate-400">
                Event Payload (JSON)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onFormatPayload}
                  title="Format JSON"
                  className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
                >
                  <AlignLeft className="h-3 w-3" />
                  <span>Format</span>
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={onResetPayload}
                  title="Reset to default payload"
                  className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <textarea
              id="payload-editor"
              value={payloadText}
              onChange={(e) => onPayloadTextChange(e.target.value)}
              rows={9}
              spellCheck={false}
              className={`w-full bg-slate-950 border rounded-md p-3 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed resize-none transition-colors ${
                jsonError
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
              placeholder="Enter JSON payload..."
            />

            {/* Local Syntax Validation Error */}
            {jsonError && (
              <div className="mt-1.5 text-xs text-rose-400 flex items-center space-x-1 font-mono">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{jsonError}</span>
              </div>
            )}
          </div>
        </CardContent>
      </div>

      <div className="p-5 pt-0">
        <Button
          onClick={onAnalyze}
          isLoading={isAnalyzing}
          disabled={Boolean(jsonError)}
          className="w-full shadow-md"
          size="md"
        >
          <Activity className="h-4 w-4 mr-2" />
          <span>Analyze Compatibility</span>
        </Button>
        <p className="text-[11px] text-slate-500 text-center mt-2">
          Advisory check — does not publish to EventBridge
        </p>
      </div>
    </Card>
  )
}
