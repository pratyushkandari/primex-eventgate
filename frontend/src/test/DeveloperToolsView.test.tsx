import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeveloperToolsView } from '@/components/devtools/DeveloperToolsView'
import { eventGateApi } from '@/services/api'
import type { AnalysisResponse } from '@/types/api'

vi.mock('@/services/api', () => ({
  eventGateApi: {
    analyzeCompatibility: vi.fn(),
  },
}))

describe('DeveloperToolsView component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders test runner controls and CLI generator commands', () => {
    render(<DeveloperToolsView />)

    expect(screen.getByText('Developer Tools')).toBeInTheDocument()
    expect(screen.getByText('Contract Test Runner')).toBeInTheDocument()
    expect(screen.getByText('CLI Generator')).toBeInTheDocument()
    expect(screen.getByText('Execute Contract Assertion')).toBeInTheDocument()

    // Verifies generated CLI commands contain active inputs
    expect(screen.getAllByText(/eventgate check --event OrderPlaced/).length).toBeGreaterThan(0)
  })

  it('runs live assertion check and renders PASS banner when outcome matches expected', async () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'test-analysis-123',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      environment: 'production',
      compatibilityResult: 'SAFE',
      severity: 'LOW',
      policyName: 'StandardReleasePolicy',
      policyReason: 'Release policy for production permits safe changes',
      decision: 'ALLOW',
      summary: 'All consumers safe',
      timestamp: new Date().toISOString(),
      changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
      findings: [
        {
          consumerId: 'billing-service',
          status: 'SAFE',
          ruleId: 'ALL_FIELDS_COMPATIBLE',
          field: null,
          expectedType: null,
          proposedType: null,
          severity: 'LOW',
          reason: 'Consumer contract is fully satisfied',
        },
      ],
    }

    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAnalysis)

    render(<DeveloperToolsView />)

    const runBtn = screen.getByText('Execute Contract Assertion')
    fireEvent.click(runBtn)

    await waitFor(() => {
      expect(screen.getByText('ASSERTION PASSED')).toBeInTheDocument()
    })

    expect(screen.getByText(/Actual: ALLOW/)).toBeInTheDocument()
    expect(screen.getByText('billing-service')).toBeInTheDocument()
  })

  it('renders FAIL banner when gate outcome diverges from expected', async () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'test-analysis-456',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      environment: 'production',
      compatibilityResult: 'BREAK',
      severity: 'HIGH',
      policyName: 'StandardReleasePolicy',
      policyReason: 'Breaking changes blocked in production',
      decision: 'BLOCK',
      summary: 'Breaking change detected',
      timestamp: new Date().toISOString(),
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
          reason: 'Field type changed',
        },
      ],
    }

    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAnalysis)

    render(<DeveloperToolsView />)

    // Default expected is ALLOW, but actual will be BLOCK -> FAIL
    const runBtn = screen.getByText('Execute Contract Assertion')
    fireEvent.click(runBtn)

    await waitFor(() => {
      expect(screen.getByText('ASSERTION FAILED')).toBeInTheDocument()
    })

    expect(screen.getByText(/Actual: BLOCK/)).toBeInTheDocument()
    expect(screen.getByText('inventory-service')).toBeInTheDocument()
  })
})
