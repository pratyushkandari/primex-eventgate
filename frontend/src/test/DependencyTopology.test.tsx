import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DependencyTopology } from '@/components/workspace/DependencyTopology'
import type { AnalysisResponse } from '@/types/api'

describe('DependencyTopology component', () => {
  const mockAnalysis: AnalysisResponse = {
    analysisId: 'top-1',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 3,
    decision: 'BLOCK',
    severity: 'HIGH',
    summary: 'Breaking change',
    timestamp: '2026-09-19T00:00:00Z',
    requestId: 'req-top-1',
    findings: [
      {
        consumerId: 'inventory-service',
        ruleId: 'EVT001',
        severity: 'HIGH',
        status: 'BREAK',
        field: 'shippingMethod',
        expectedType: 'string',
        proposedType: 'object',
        reason: 'Type mismatch',
      },
    ],
    changeSet: {
      addedFields: [],
      removedFields: [],
      typeChanges: [{ field: 'shippingMethod', fromType: 'string', toType: 'object' }],
      requirednessChanges: [],
    },
  }

  it('renders Producer, EventGate, and Downstream Consumers in idle state', () => {
    render(
      <DependencyTopology
        analysis={null}
        selectedConsumerId={null}
        onSelectConsumer={vi.fn()}
      />
    )

    expect(screen.getByText('Producer Contract')).toBeInTheDocument()
    expect(screen.getByText('OrderPlaced')).toBeInTheDocument()
    expect(screen.getByText('EventGate')).toBeInTheDocument()
    expect(screen.getByText('Ready for analysis')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Inventory')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('reflects evaluated BLOCK decision and consumer statuses', () => {
    const handleSelect = vi.fn()
    render(
      <DependencyTopology
        analysis={mockAnalysis}
        selectedConsumerId="inventory-service"
        onSelectConsumer={handleSelect}
      />
    )

    expect(screen.getByText('Decision: BLOCK')).toBeInTheDocument()
    expect(screen.getByText('BREAK')).toBeInTheDocument()

    const inventoryBtn = screen.getByRole('button', { name: /Inventory/i })
    fireEvent.click(inventoryBtn)
    expect(handleSelect).toHaveBeenCalledWith('inventory-service')
  })
})
