import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EventInputPanel } from '@/components/workspace/EventInputPanel'

describe('EventInputPanel component', () => {
  const defaultProps = {
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 2,
    payloadText: '{\n  "orderId": "O1"\n}',
    jsonError: null,
    isAnalyzing: false,
    onProposedVersionChange: vi.fn(),
    onPayloadTextChange: vi.fn(),
    onFormatPayload: vi.fn(),
    onResetPayload: vi.fn(),
    onAnalyze: vi.fn(),
  }

  it('renders input fields with current values', () => {
    render(<EventInputPanel {...defaultProps} />)
    expect(screen.getByDisplayValue('OrderPlaced')).toBeInTheDocument()
    expect(screen.getByText('v1 (Baseline)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter JSON payload...')).toHaveValue('{\n  "orderId": "O1"\n}')
  })

  it('calls onProposedVersionChange when selector changes', () => {
    render(<EventInputPanel {...defaultProps} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '3' } })
    expect(defaultProps.onProposedVersionChange).toHaveBeenCalledWith(3)
  })

  it('calls onPayloadTextChange when editing payload textarea', () => {
    render(<EventInputPanel {...defaultProps} />)
    const textarea = screen.getByPlaceholderText('Enter JSON payload...')
    fireEvent.change(textarea, { target: { value: '{"orderId": "O2"}' } })
    expect(defaultProps.onPayloadTextChange).toHaveBeenCalledWith('{"orderId": "O2"}')
  })

  it('displays jsonError message and disables analyze button when json is invalid', () => {
    render(<EventInputPanel {...defaultProps} jsonError="Unexpected token in JSON" />)
    expect(screen.getByText('Unexpected token in JSON')).toBeInTheDocument()
    const analyzeBtn = screen.getByRole('button', { name: /Analyze Compatibility/i })
    expect(analyzeBtn).toBeDisabled()
  })

  it('triggers onFormatPayload and onResetPayload', () => {
    render(<EventInputPanel {...defaultProps} />)
    const formatBtn = screen.getByRole('button', { name: /Format/i })
    fireEvent.click(formatBtn)
    expect(defaultProps.onFormatPayload).toHaveBeenCalledTimes(1)

    const resetBtn = screen.getByRole('button', { name: /Reset/i })
    fireEvent.click(resetBtn)
    expect(defaultProps.onResetPayload).toHaveBeenCalledTimes(1)
  })
})
