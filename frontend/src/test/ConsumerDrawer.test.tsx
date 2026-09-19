import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConsumerDrawer } from '@/components/workspace/ConsumerDrawer'
import type { ConsumerFinding } from '@/types/api'

describe('ConsumerDrawer component', () => {
  it('renders nothing when consumerId is null', () => {
    const { container } = render(
      <ConsumerDrawer consumerId={null} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders consumer details in SAFE state when no finding is provided', () => {
    render(
      <ConsumerDrawer
        consumerId="billing-service"
        consumerRole="Payment processing & invoices"
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: /Consumer Inspector - billing-service/i })).toBeInTheDocument()
    expect(screen.getAllByText('billing-service').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Payment processing & invoices')).toBeInTheDocument()
    expect(screen.getByText('FULLY COMPATIBLE')).toBeInTheDocument()
    expect(screen.getByText('SAFE')).toBeInTheDocument()
  })

  it('renders BREAK finding details and enforcement policy', () => {
    const breakFinding: ConsumerFinding = {
      consumerId: 'inventory-service',
      ruleId: 'EVT001_FIELD_TYPE_CHANGED',
      severity: 'HIGH',
      status: 'BREAK',
      field: 'shippingMethod',
      expectedType: 'string',
      proposedType: 'object',
      reason: 'inventory-service expects string but received object',
    }

    render(
      <ConsumerDrawer
        consumerId="inventory-service"
        consumerRole="Stock allocation"
        finding={breakFinding}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('BREAKING INCOMPATIBILITY')).toBeInTheDocument()
    expect(screen.getByText('EVT001_FIELD_TYPE_CHANGED')).toBeInTheDocument()
    expect(screen.getByText('shippingMethod')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
    expect(screen.getByText('object')).toBeInTheDocument()
    expect(screen.getByText(/PUBLICATION HALTED/i)).toBeInTheDocument()
  })

  it('calls onClose when Dismiss button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <ConsumerDrawer
        consumerId="analytics-service"
        onClose={handleClose}
      />
    )

    const dismissBtn = screen.getByRole('button', { name: /Dismiss/i })
    fireEvent.click(dismissBtn)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
