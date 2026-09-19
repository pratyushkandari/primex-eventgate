import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TopologyFallback } from '@/components/workspace/TopologyFallback'
import type { AnalysisResponse } from '@/types/api'

describe('TopologyFallback component', () => {
  const consumers = [
    { id: 'billing-service', name: 'Billing' },
    { id: 'inventory-service', name: 'Inventory' },
    { id: 'analytics-service', name: 'Analytics' },
  ]

  it('renders accessible hierarchy with idle state', () => {
    render(<TopologyFallback analysis={null} consumers={consumers} />)

    expect(screen.getByRole('list', { name: /Event processing topology/i })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: /Downstream consumers/i })).toBeInTheDocument()
    expect(screen.getByText(/Producer: OrderPlaced v1 → v2/i)).toBeInTheDocument()
    expect(screen.getByText(/EventGate Release Gate — Decision: Awaiting analysis/i)).toBeInTheDocument()
  })

  it('renders evaluated decision, consumer statuses, and allows activation', () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'an-topology-1',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      decision: 'BLOCK',
      severity: 'HIGH',
      summary: 'Breaking type mutation',
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
          reason: 'Field type changed from string to object',
        },
      ],
      changeSet: {
        addedFields: [],
        removedFields: [],
        typeChanges: [{ field: 'shippingMethod', fromType: 'string', toType: 'object' }],
        requirednessChanges: [],
      },
    }

    const handleSelect = vi.fn()
    render(
      <TopologyFallback
        analysis={mockAnalysis}
        consumers={consumers}
        onSelectConsumer={handleSelect}
      />
    )

    expect(screen.getByText(/EventGate Release Gate — Decision: BLOCK/i)).toBeInTheDocument()
    const inventoryBtn = screen.getByRole('button', { name: /Inventory \(inventory-service\): BREAK/i })
    expect(inventoryBtn).toBeInTheDocument()

    fireEvent.click(inventoryBtn)
    expect(handleSelect).toHaveBeenCalledWith('inventory-service')
  })
})
