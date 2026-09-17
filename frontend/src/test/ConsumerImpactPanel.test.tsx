import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ConsumerImpactPanel } from '@/components/workspace/ConsumerImpactPanel'
import type { AnalysisResponse } from '@/types/api'

describe('ConsumerImpactPanel component', () => {
  it('renders all 3 registered consumers in idle state', () => {
    render(<ConsumerImpactPanel analysis={null} />)
    expect(screen.getByText('billing-service')).toBeInTheDocument()
    expect(screen.getByText('inventory-service')).toBeInTheDocument()
    expect(screen.getByText('analytics-service')).toBeInTheDocument()
  })

  it('correctly maps BREAK finding to inventory-service while keeping others SAFE', () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'an-1',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      decision: 'BLOCK',
      severity: 'HIGH',
      summary: '1 consumer would break',
      timestamp: '2026-09-18T00:00:00Z',
      requestId: 'req-1',
      changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
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

    render(<ConsumerImpactPanel analysis={mockAnalysis} />)

    expect(screen.getByText('BREAK')).toBeInTheDocument()
    expect(screen.getByText(/Field: shippingMethod/i)).toBeInTheDocument()
    expect(screen.getByText(/EVT001_FIELD_TYPE_CHANGED/i)).toBeInTheDocument()

    // Other consumers default to SAFE
    const safeBadges = screen.getAllByText('SAFE')
    expect(safeBadges.length).toBe(2)
  })

  it('correctly maps RISK finding to analytics-service', () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'an-2',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 4,
      decision: 'REVIEW',
      severity: 'MEDIUM',
      summary: '1 consumer review required',
      timestamp: '2026-09-18T00:00:00Z',
      requestId: 'req-2',
      changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
      findings: [
        {
          consumerId: 'analytics-service',
          status: 'RISK',
          ruleId: 'EVT006_OPTIONAL_FIELD_REMOVED',
          field: 'couponCode',
          expectedType: 'string',
          proposedType: null,
          severity: 'MEDIUM',
          reason: "Field 'couponCode' was removed.",
        },
      ],
    }

    render(<ConsumerImpactPanel analysis={mockAnalysis} />)

    expect(screen.getByText('RISK')).toBeInTheDocument()
    expect(screen.getByText(/EVT006_OPTIONAL_FIELD_REMOVED/i)).toBeInTheDocument()
  })
})
