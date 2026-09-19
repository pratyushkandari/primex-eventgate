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

  it('displays compact execution trace matching actual request parameters', async () => {
    const mockAnalysis: AnalysisResponse = {
      analysisId: 'test-trace-1',
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
      findings: [],
    }

    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAnalysis)

    render(<DeveloperToolsView />)

    // Switch to v1 -> v3
    fireEvent.click(screen.getByText('OrderPlaced v1 → v3 (BREAK)'))
    fireEvent.click(screen.getByText('Execute Contract Assertion'))

    await waitFor(() => {
      expect(screen.getByText('ASSERTION PASSED')).toBeInTheDocument()
    })

    // Expect compact execution trace
    expect(screen.getByText(/Executed:/)).toBeInTheDocument()
    expect(screen.getByText(/OrderPlaced · v1 → v3 · production/)).toBeInTheDocument()
  })

  it('handles scenario transitions cleanly: v1->v2 to v1->v3 to v1->v4 to v1->v2', async () => {
    const makeAnalysis = (propVer: number, dec: 'ALLOW' | 'BLOCK' | 'REVIEW'): AnalysisResponse => ({
      analysisId: `an-${propVer}`,
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: propVer,
      environment: 'production',
      compatibilityResult: dec === 'BLOCK' ? 'BREAK' : dec === 'REVIEW' ? 'RISK' : 'SAFE',
      severity: dec === 'BLOCK' ? 'HIGH' : dec === 'REVIEW' ? 'MEDIUM' : 'LOW',
      policyName: 'StandardReleasePolicy',
      policyReason: 'Policy evaluation',
      decision: dec,
      summary: `Outcome for v${propVer}`,
      timestamp: new Date().toISOString(),
      changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
      findings: [],
    })

    render(<DeveloperToolsView />)

    // 1. v1 -> v2 (SAFE)
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(makeAnalysis(2, 'ALLOW'))
    fireEvent.click(screen.getByText('OrderPlaced v1 → v2 (SAFE)'))
    fireEvent.click(screen.getByText('Execute Contract Assertion'))
    await waitFor(() => {
      expect(screen.getByText(/OrderPlaced · v1 → v2 · production/)).toBeInTheDocument()
    })

    // 2. Transition v1 -> v2 to v1 -> v3 (BREAK)
    // Changing preset must clear stale result immediately
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(makeAnalysis(3, 'BLOCK'))
    fireEvent.click(screen.getByText('OrderPlaced v1 → v3 (BREAK)'))
    expect(screen.queryByText(/OrderPlaced · v1 → v2 · production/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Execute Contract Assertion'))
    await waitFor(() => {
      expect(screen.getByText(/OrderPlaced · v1 → v3 · production/)).toBeInTheDocument()
    })

    // 3. Transition v1 -> v3 to v1 -> v4 (RISK)
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(makeAnalysis(4, 'REVIEW'))
    fireEvent.click(screen.getByText('OrderPlaced v1 → v4 (RISK)'))
    expect(screen.queryByText(/OrderPlaced · v1 → v3 · production/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Execute Contract Assertion'))
    await waitFor(() => {
      expect(screen.getByText(/OrderPlaced · v1 → v4 · production/)).toBeInTheDocument()
    })

    // 4. Transition v1 -> v4 back to v1 -> v2 (SAFE)
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(makeAnalysis(2, 'ALLOW'))
    fireEvent.click(screen.getByText('OrderPlaced v1 → v2 (SAFE)'))
    expect(screen.queryByText(/OrderPlaced · v1 → v4 · production/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Execute Contract Assertion'))
    await waitFor(() => {
      expect(screen.getByText(/OrderPlaced · v1 → v2 · production/)).toBeInTheDocument()
    })
  })

  it('supports changing environment and scenario simultaneously without stale state', async () => {
    const mockAnalysisStaging: AnalysisResponse = {
      analysisId: 'an-staging-3',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      environment: 'staging',
      compatibilityResult: 'BREAK',
      severity: 'HIGH',
      policyName: 'StandardReleasePolicy',
      policyReason: 'Staging break',
      decision: 'BLOCK',
      summary: 'Staging breaking change',
      timestamp: new Date().toISOString(),
      changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
      findings: [],
    }

    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAnalysisStaging)
    render(<DeveloperToolsView />)

    // Select v1 -> v3
    fireEvent.click(screen.getByText('OrderPlaced v1 → v3 (BREAK)'))

    // Change environment to staging
    const envSelect = screen.getByDisplayValue('production')
    fireEvent.change(envSelect, { target: { value: 'staging' } })

    fireEvent.click(screen.getByText('Execute Contract Assertion'))

    await waitFor(() => {
      expect(screen.getByText(/OrderPlaced · v1 → v3 · staging/)).toBeInTheDocument()
    })

    expect(eventGateApi.analyzeCompatibility).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 3,
        environment: 'staging',
      })
    )
  })

  it('supports manual expected decision override and reset to suggested decision', async () => {
    render(<DeveloperToolsView />)

    // Initially suggested is ALLOW
    expect(screen.getByText('Suggested from scenario')).toBeInTheDocument()

    // Override expectation to BLOCK
    const expectedSelect = screen.getByDisplayValue('ALLOW')
    fireEvent.change(expectedSelect, { target: { value: 'BLOCK' } })

    expect(screen.getByText('Manual expectation')).toBeInTheDocument()
    expect(screen.getByText(/Reset to suggested/)).toBeInTheDocument()

    // Click Reset
    fireEvent.click(screen.getByText(/Reset to suggested/))
    expect(screen.getByText('Suggested from scenario')).toBeInTheDocument()
  })

  it('handles rapid repeated scenario switching and immediate assertion execution', async () => {
    const mockFinalAnalysis: AnalysisResponse = {
      analysisId: 'an-final-break',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      environment: 'production',
      compatibilityResult: 'BREAK',
      severity: 'HIGH',
      policyName: 'StandardReleasePolicy',
      policyReason: 'Breaking changes blocked in production',
      decision: 'BLOCK',
      summary: 'Final assertion outcome',
      timestamp: new Date().toISOString(),
      changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
      findings: [],
    }

    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockFinalAnalysis)
    render(<DeveloperToolsView />)

    // Rapid switching
    fireEvent.click(screen.getByText('OrderPlaced v1 → v2 (SAFE)'))
    fireEvent.click(screen.getByText('OrderPlaced v1 → v4 (RISK)'))
    fireEvent.click(screen.getByText('OrderPlaced v1 → v3 (BREAK)'))

    // Immediate execution
    fireEvent.click(screen.getByText('Execute Contract Assertion'))

    await waitFor(() => {
      expect(screen.getByText('ASSERTION PASSED')).toBeInTheDocument()
      expect(screen.getByText(/OrderPlaced · v1 → v3 · production/)).toBeInTheDocument()
    })

    expect(eventGateApi.analyzeCompatibility).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 3,
        environment: 'production',
      })
    )
  })
})
