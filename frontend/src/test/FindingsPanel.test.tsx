import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FindingsPanel } from '@/components/workspace/FindingsPanel'
import type { AnalysisResponse } from '@/types/api'

describe('FindingsPanel component', () => {
  it('renders nothing when analysis is null', () => {
    const { container } = render(<FindingsPanel analysis={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders schema diff additions, modifications, and removals correctly', () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'an-diff-1',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      decision: 'BLOCK',
      severity: 'HIGH',
      summary: 'Schema changes detected',
      timestamp: '2026-09-18T00:00:00Z',
      requestId: 'req-diff-1',
      changeSet: {
        addedFields: ['metadata'],
        removedFields: ['couponCode'],
        typeChanges: [{ field: 'shippingMethod', fromType: 'string', toType: 'object' }],
        requirednessChanges: [{ field: 'priority', fromRequired: false, toRequired: true }],
      },
      findings: [
        {
          consumerId: 'inventory-service',
          status: 'BREAK',
          ruleId: 'EVT001_FIELD_TYPE_CHANGED',
          field: 'shippingMethod',
          expectedType: 'string',
          proposedType: 'object',
          severity: 'HIGH',
          reason: "Field 'shippingMethod' type changed from string to object.",
        },
      ],
    }

    render(<FindingsPanel analysis={mockAnalysis} />)

    // Schema Diff checks
    expect(screen.getByText('metadata')).toBeInTheDocument()
    expect(screen.getByText('field added (optional)')).toBeInTheDocument()

    expect(screen.getAllByText('shippingMethod').length).toBe(2)
    expect(screen.getByText(/string\s+→\s+object/)).toBeInTheDocument()

    expect(screen.getByText('couponCode')).toBeInTheDocument()
    expect(screen.getByText('optional field removed')).toBeInTheDocument()

    // Structured Finding checks
    expect(screen.getByText('EVT001_FIELD_TYPE_CHANGED')).toBeInTheDocument()
    expect(screen.getByText('inventory-service')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })
})
