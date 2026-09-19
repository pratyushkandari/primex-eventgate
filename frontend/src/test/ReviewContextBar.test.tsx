import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReviewContextBar } from '@/components/workspace/ReviewContextBar'
import type { AnalysisResponse } from '@/types/api'

describe('ReviewContextBar component', () => {
  it('renders idle standby state when analysis is null', () => {
    render(<ReviewContextBar analysis={null} />)

    expect(screen.getByText('Release Review Overview')).toBeInTheDocument()
    expect(screen.getByText('Awaiting contract analysis')).toBeInTheDocument()
  })

  it('renders active review summary with segmented distribution bar when analysis is present', () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'rev-1',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      decision: 'ALLOW',
      severity: 'LOW',
      summary: 'All consumers compatible',
      timestamp: '2026-09-19T00:00:00Z',
      requestId: 'req-rev-1',
      findings: [
        {
          consumerId: 'billing-service',
          ruleId: 'EVT008',
          severity: 'LOW',
          status: 'SAFE',
          field: '*',
          reason: 'Compatible',
        },
        {
          consumerId: 'inventory-service',
          ruleId: 'EVT008',
          severity: 'LOW',
          status: 'SAFE',
          field: '*',
          reason: 'Compatible',
        },
        {
          consumerId: 'analytics-service',
          ruleId: 'EVT008',
          severity: 'LOW',
          status: 'SAFE',
          field: '*',
          reason: 'Compatible',
        },
      ],
      changeSet: {
        addedFields: ['loyaltyTier'],
        removedFields: [],
        typeChanges: [],
        requirednessChanges: [],
      },
    }

    render(<ReviewContextBar analysis={mockAnalysis} />)

    expect(screen.getByText('Change Review')).toBeInTheDocument()
    expect(screen.getByText('OrderPlaced')).toBeInTheDocument()
    expect(screen.getByText(/v1.*v2/)).toBeInTheDocument()
    expect(screen.getByText('ALLOW')).toBeInTheDocument()
    expect(screen.getByText('0 consumers affected')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText('3 Safe')).toBeInTheDocument()
  })

  it('triggers onFilterAffected when clicking impacted consumer button in BREAK state', () => {
    const handleFilter = vi.fn()
    const mockBreakingAnalysis: AnalysisResponse = {
      analysisId: 'rev-2',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      decision: 'BLOCK',
      severity: 'HIGH',
      summary: 'Breaking change caught',
      timestamp: '2026-09-19T00:00:00Z',
      requestId: 'req-rev-2',
      findings: [
        {
          consumerId: 'inventory-service',
          ruleId: 'EVT001',
          severity: 'HIGH',
          status: 'BREAK',
          field: 'shippingMethod',
          expectedType: 'string',
          proposedType: 'object',
          reason: 'Incompatible type',
        },
        {
          consumerId: 'billing-service',
          ruleId: 'EVT008',
          severity: 'LOW',
          status: 'SAFE',
          field: '*',
          reason: 'Compatible',
        },
      ],
      changeSet: {
        addedFields: [],
        removedFields: [],
        typeChanges: [{ field: 'shippingMethod', fromType: 'string', toType: 'object' }],
        requirednessChanges: [],
      },
    }

    render(
      <ReviewContextBar
        analysis={mockBreakingAnalysis}
        onFilterAffected={handleFilter}
      />
    )

    expect(screen.getByText('BLOCK')).toBeInTheDocument()
    expect(screen.getByText('1 consumer affected')).toBeInTheDocument()
    expect(screen.getByText('1 Break')).toBeInTheDocument()

    const impactBtn = screen.getByRole('button', { name: /inventory-service/i })
    fireEvent.click(impactBtn)
    expect(handleFilter).toHaveBeenCalledTimes(1)
  })
})
