import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventInputPanel } from '@/components/workspace/EventInputPanel'
import { catalog } from './fixtures'

function setup(overrides: Partial<React.ComponentProps<typeof EventInputPanel>> = {}) {
  const props = {
    selection: { eventType: 'OrderPlaced', currentVersion: 1, proposedVersion: 2 },
    catalog,
    versions: [1, 2, 3, 4],
    payloadText: '{\n  "orderId": "o-1"\n}',
    jsonError: null,
    isAnalyzing: false,
    onSelectionChange: vi.fn(),
    onPayloadTextChange: vi.fn(),
    onFormatPayload: vi.fn(),
    onResetPayload: vi.fn(),
    onAnalyze: vi.fn(),
    ...overrides,
  }
  render(<EventInputPanel {...props} />)
  return props
}

describe('EventInputPanel', () => {
  it('shows the selected change with labeled controls', () => {
    setup()
    expect(screen.getByLabelText('Event type')).toHaveValue('OrderPlaced')
    expect(screen.getByLabelText('Current version')).toHaveValue('1')
    expect(screen.getByLabelText('Proposed version')).toHaveValue('2')
    expect(screen.getByLabelText('Event payload (JSON)')).toHaveValue('{\n  "orderId": "o-1"\n}')
  })

  it('never offers the current version as the proposed one', () => {
    setup()
    const options = Array.from((screen.getByLabelText('Proposed version') as HTMLSelectElement).options).map((o) => o.value)
    expect(options).toEqual(['2', '3', '4'])
  })

  it('switching event type picks that event’s first two versions', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'PaymentCompleted' } })
    expect(props.onSelectionChange).toHaveBeenCalledWith({ eventType: 'PaymentCompleted', currentVersion: 1, proposedVersion: 2 })
  })

  it('moves the proposed version when the current version would collide', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText('Current version'), { target: { value: '2' } })
    expect(props.onSelectionChange).toHaveBeenCalledWith({ eventType: 'OrderPlaced', currentVersion: 2, proposedVersion: 1 })
  })

  it('forwards payload edits, format, reset and analyze', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText('Event payload (JSON)'), { target: { value: '{}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Format' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(screen.getByRole('button', { name: /Analyze compatibility/ }))
    expect(props.onPayloadTextChange).toHaveBeenCalledWith('{}')
    expect(props.onFormatPayload).toHaveBeenCalled()
    expect(props.onResetPayload).toHaveBeenCalled()
    expect(props.onAnalyze).toHaveBeenCalled()
  })

  it('shows the JSON error inline and disables analysis', () => {
    setup({ jsonError: 'Unexpected token' })
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON: Unexpected token')
    expect(screen.getByLabelText('Event payload (JSON)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: /Analyze compatibility/ })).toBeDisabled()
  })

  it('Tab indents, but Escape releases the editor so Tab can leave it', () => {
    const props = setup({ payloadText: 'ab' })
    const editor = screen.getByLabelText('Event payload (JSON)') as HTMLTextAreaElement
    editor.setSelectionRange(1, 1)

    const indented = fireEvent.keyDown(editor, { key: 'Tab' })
    expect(indented).toBe(false)
    expect(props.onPayloadTextChange).toHaveBeenCalledWith('a  b')

    fireEvent.keyDown(editor, { key: 'Escape' })
    const leaves = fireEvent.keyDown(editor, { key: 'Tab' })
    expect(leaves).toBe(true)
    expect(props.onPayloadTextChange).toHaveBeenCalledTimes(1)
  })
})
