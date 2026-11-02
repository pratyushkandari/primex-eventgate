import * as React from 'react'
import { AlignLeft, Play, RotateCcw } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { FieldMessage, Label, Select } from '@/components/ui/Field'
import type { EventCatalogSummary } from '@/types/api'
import type { ChangeSelection } from './useReviewSession'

interface EventInputPanelProps {
  selection: ChangeSelection
  catalog: EventCatalogSummary[]
  versions: number[]
  payloadText: string
  jsonError: string | null
  isAnalyzing: boolean
  onSelectionChange: (selection: ChangeSelection) => void
  onPayloadTextChange: (text: string) => void
  onFormatPayload: () => void
  onResetPayload: () => void
  onAnalyze: () => void
}

export function EventInputPanel({
  selection,
  catalog,
  versions,
  payloadText,
  jsonError,
  isAnalyzing,
  onSelectionChange,
  onPayloadTextChange,
  onFormatPayload,
  onResetPayload,
  onAnalyze,
}: EventInputPanelProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  // Tab indents inside the editor; Escape releases it so the next Tab moves focus
  // on (WCAG 2.1.2, no keyboard trap).
  const tabReleased = React.useRef(false)
  const lineCount = Math.max(payloadText.split('\n').length, 12)
  const errorId = React.useId()

  const knownVersions = versions.length > 0 ? versions : [selection.currentVersion, selection.proposedVersion]
  const eventTypes = catalog.map((c) => c.eventType)
  const eventOptions = eventTypes.includes(selection.eventType) ? eventTypes : [selection.eventType, ...eventTypes]

  const changeEvent = (eventType: string) => {
    const available = catalog.find((c) => c.eventType === eventType)?.versions ?? [1, 2]
    onSelectionChange({
      eventType,
      currentVersion: available[0],
      proposedVersion: available[1] ?? available[0],
    })
  }

  const changeCurrent = (currentVersion: number) => {
    const proposedVersion =
      selection.proposedVersion === currentVersion
        ? knownVersions.find((v) => v !== currentVersion) ?? currentVersion
        : selection.proposedVersion
    onSelectionChange({ ...selection, currentVersion, proposedVersion })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      tabReleased.current = true
      return
    }
    if (e.key === 'Tab' && !e.shiftKey && !tabReleased.current) {
      e.preventDefault()
      const { selectionStart: start, selectionEnd: end } = e.currentTarget
      onPayloadTextChange(`${payloadText.slice(0, start)}  ${payloadText.slice(end)}`)
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
      })
      return
    }
    tabReleased.current = false
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Proposed change" description="Pick a contract version change and the event payload to publish." />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="event-type">Event type</Label>
            <Select id="event-type" value={selection.eventType} onChange={(e) => changeEvent(e.target.value)}>
              {eventOptions.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="current-version">Current version</Label>
            <Select
              id="current-version"
              value={selection.currentVersion}
              onChange={(e) => changeCurrent(Number(e.target.value))}
            >
              {knownVersions.map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="proposed-version">Proposed version</Label>
            <Select
              id="proposed-version"
              value={selection.proposedVersion}
              onChange={(e) => onSelectionChange({ ...selection, proposedVersion: Number(e.target.value) })}
            >
              {knownVersions
                .filter((v) => v !== selection.currentVersion)
                .map((v) => (
                  <option key={v} value={v}>
                    v{v}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="payload-editor" className="mb-0">
              Event payload (JSON)
            </Label>
            <div className="flex items-center gap-1">
              <CopyButton value={payloadText} label="Copy payload" showText />
              <button
                type="button"
                onClick={onFormatPayload}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-fg-subtle transition-colors hover:bg-raised hover:text-fg"
              >
                <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Format
              </button>
              <button
                type="button"
                onClick={onResetPayload}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-fg-subtle transition-colors hover:bg-raised hover:text-fg"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>
          <div
            className={
              'flex flex-1 overflow-hidden rounded-[var(--radius-control)] border bg-canvas transition-colors ' +
              (jsonError
                ? 'border-danger-line focus-within:border-danger'
                : 'border-line focus-within:border-accent')
            }
          >
            <div
              aria-hidden="true"
              className="select-none border-r border-line px-2 py-2 text-right font-mono text-xs leading-5 text-fg-subtle"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              id="payload-editor"
              value={payloadText}
              onChange={(e) => onPayloadTextChange(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              aria-invalid={jsonError ? true : undefined}
              aria-describedby={errorId}
              className="min-h-[15rem] flex-1 resize-none bg-transparent px-3 py-2 font-mono text-xs leading-5 text-fg focus:outline-none"
            />
          </div>
          {jsonError ? (
            <FieldMessage id={errorId} error>
              Invalid JSON: {jsonError}
            </FieldMessage>
          ) : (
            <FieldMessage id={errorId}>Tab indents. Press Esc, then Tab, to leave the editor.</FieldMessage>
          )}
        </div>

        <Button
          onClick={onAnalyze}
          isLoading={isAnalyzing}
          disabled={Boolean(jsonError)}
          className="w-full"
        >
          {!isAnalyzing && <Play className="h-4 w-4" aria-hidden="true" />}
          Analyze compatibility
          <kbd className="ml-1 hidden rounded border border-white/25 px-1 text-[11px] font-normal sm:inline">
            Ctrl Enter
          </kbd>
        </Button>
      </div>
    </Card>
  )
}
