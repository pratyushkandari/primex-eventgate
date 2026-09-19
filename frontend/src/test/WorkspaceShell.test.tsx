import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { eventGateApi } from '@/services/api'
import type { AnalysisResponse, PublishResponse } from '@/types/api'
import { EventGateApiError } from '@/types/api'

vi.mock('@/services/api', () => ({
  eventGateApi: {
    checkHealth: vi.fn(),
    analyzeCompatibility: vi.fn(),
    publishEvent: vi.fn(),
  },
}))

describe('WorkspaceShell integrated workflow', () => {
  const mockAllowAnalysis: AnalysisResponse = {
    analysisId: 'an-safe-1',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 2,
    decision: 'ALLOW',
    severity: 'LOW',
    summary: 'All 3 consumers are safe with the proposed change.',
    timestamp: '2026-09-18T00:00:00Z',
    requestId: 'req-allow-123',
    changeSet: {
      addedFields: ['metadata'],
      removedFields: [],
      typeChanges: [],
      requirednessChanges: [],
    },
    findings: [
      {
        consumerId: 'billing-service',
        status: 'SAFE',
        ruleId: 'NONE',
        field: '*',
        expectedType: null,
        proposedType: null,
        severity: 'LOW',
        reason: 'No conflicting fields.',
      },
      {
        consumerId: 'inventory-service',
        status: 'SAFE',
        ruleId: 'NONE',
        field: '*',
        expectedType: null,
        proposedType: null,
        severity: 'LOW',
        reason: 'No conflicting fields.',
      },
      {
        consumerId: 'analytics-service',
        status: 'SAFE',
        ruleId: 'NONE',
        field: '*',
        expectedType: null,
        proposedType: null,
        severity: 'LOW',
        reason: 'No conflicting fields.',
      },
    ],
  }

  const mockBlockAnalysis: AnalysisResponse = {
    analysisId: 'an-block-1',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 3,
    decision: 'BLOCK',
    severity: 'HIGH',
    summary: 'inventory-service is broken by type mutation on shippingMethod.',
    timestamp: '2026-09-18T00:00:00Z',
    requestId: 'req-block-456',
    changeSet: {
      addedFields: [],
      removedFields: [],
      typeChanges: [{ field: 'shippingMethod', fromType: 'string', toType: 'object' }],
      requirednessChanges: [],
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

  const mockReviewAnalysis: AnalysisResponse = {
    analysisId: 'an-risk-1',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 4,
    decision: 'REVIEW',
    severity: 'MEDIUM',
    summary: 'analytics-service impacted by couponCode removal.',
    timestamp: '2026-09-18T00:00:00Z',
    requestId: 'req-risk-789',
    changeSet: {
      addedFields: [],
      removedFields: ['couponCode'],
      typeChanges: [],
      requirednessChanges: [],
    },
    findings: [
      {
        consumerId: 'analytics-service',
        status: 'RISK',
        ruleId: 'EVT006_OPTIONAL_FIELD_REMOVED',
        field: 'couponCode',
        expectedType: 'string',
        proposedType: null,
        severity: 'MEDIUM',
        reason: 'Field couponCode was removed.',
      },
    ],
  }

  const mockPublishResponse: PublishResponse = {
    eventId: 'evt-allow-verified-1',
    published: true,
    decision: 'ALLOW',
    severity: 'LOW',
    eventBridgeEventId: 'eb-verified-entry-888',
    analysis: mockAllowAnalysis,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(eventGateApi.checkHealth).mockResolvedValue({
      status: 'ok',
      service: 'eventgate',
      version: '0.1.0',
    })
  })

  it('renders all main panels and connects to live health', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    expect(screen.getAllByText('EventGate').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Contract change/i)).toBeInTheDocument()
    expect(screen.getByText(/Ready to Analyze/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Consumers/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Event path/i)).toBeInTheDocument()
  })

  it('switches between sample scenarios without fabricating analysis', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    // Initial state is Safe scenario (v2)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('2')

    // Click Breaking scenario button
    const breakingBtn = screen.getByRole('button', { name: /Breaking/i })
    fireEvent.click(breakingBtn)
    expect(select.value).toBe('3')
    expect(screen.getByText('Ready to Analyze')).toBeInTheDocument()

    // Click Risk scenario button
    const riskBtn = screen.getByRole('button', { name: /Risk/i })
    fireEvent.click(riskBtn)
    expect(select.value).toBe('4')
    expect(screen.getByText('Ready to Analyze')).toBeInTheDocument()
  })

  it('executes analysis and renders ALLOW decision with active publish button', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getAllByText('ALLOW')[0]).toBeInTheDocument()
      expect(screen.getByText('Publication permitted.')).toBeInTheDocument()
      expect(screen.getByText('SEVERITY: LOW')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publish Event/i })).toBeEnabled()
    })

    expect(eventGateApi.analyzeCompatibility).toHaveBeenCalledWith({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      environment: 'production',
    })
  })

  it('executes analysis and renders BLOCK decision with publish prevented', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockBlockAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const breakingBtn = screen.getByRole('button', { name: /Breaking/i })
    fireEvent.click(breakingBtn)

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getAllByText('BLOCK')[0]).toBeInTheDocument()
      expect(screen.getByText('Publication prevented.')).toBeInTheDocument()
      expect(screen.getByText('SEVERITY: HIGH')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publication prevented/i })).toBeDisabled()
    })
  })

  it('executes analysis and renders REVIEW decision with publication prevented', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockReviewAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const riskBtn = screen.getByRole('button', { name: /Risk/i })
    fireEvent.click(riskBtn)

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getAllByText('REVIEW')[0]).toBeInTheDocument()
      expect(screen.getByText('Publication held pending review.')).toBeInTheDocument()
      expect(screen.getByText('SEVERITY: MEDIUM')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publication held pending review/i })).toBeDisabled()
    })
  })

  it('executes publish workflow when ALLOW and renders EventBridge entry', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)
    vi.mocked(eventGateApi.publishEvent).mockResolvedValue(mockPublishResponse)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    // Step 1: Analyze
    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)
    await waitFor(() => expect(screen.getByText('Publication permitted.')).toBeInTheDocument())

    // Step 2: Publish
    const publishBtn = screen.getByRole('button', { name: /Publish Event/i })
    fireEvent.click(publishBtn)

    await waitFor(() => {
      expect(screen.getByText('Published to Amazon EventBridge')).toBeInTheDocument()
      expect(screen.getByText('evt-allow-verified-1')).toBeInTheDocument()
      expect(screen.getByText('eb-verified-entry-888')).toBeInTheDocument()
    })

    expect(eventGateApi.publishEvent).toHaveBeenCalledTimes(1)
    expect(eventGateApi.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 2,
        environment: 'production',
      })
    )
  })

  it('clears stale analysis result and resets decision when environment is switched', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    // Analyze in default production environment
    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)
    await waitFor(() => expect(screen.getByText('Publication permitted.')).toBeInTheDocument())

    // Click environment selector to open dropdown menu
    const envBtn = screen.getByLabelText(/Target Environment: production/i)
    fireEvent.click(envBtn)

    // Select development environment from dropdown
    const devOption = screen.getByRole('menuitem', { name: /development/i })
    fireEvent.click(devOption)

    // Verify stale decision is cleared and reset to Ready to Analyze
    expect(screen.getByText('Ready to Analyze')).toBeInTheDocument()
    expect(screen.queryByText('Publication permitted.')).not.toBeInTheDocument()
  })

  it('prevents analysis submission when JSON payload has syntax errors', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText('Enter JSON payload...')
    fireEvent.change(textarea, { target: { value: '{"orderId": INVALID_SYNTAX}' } })

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    expect(analyzeBtn).toBeDisabled()

    fireEvent.click(analyzeBtn)
    expect(eventGateApi.analyzeCompatibility).not.toHaveBeenCalled()
  })

  it('clears stale ALLOW result and disables Publish when JSON payload becomes malformed', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    // Initial valid analysis produces ALLOW
    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getByText('Publication permitted.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publish Event/i })).toBeEnabled()
    })

    // Now corrupt the JSON payload
    const textarea = screen.getByPlaceholderText('Enter JSON payload...')
    fireEvent.change(textarea, { target: { value: '{"orderId": MALFORMED_JSON' } })

    // Verify stale ALLOW result is cleared and neutral Invalid Payload state is displayed
    await waitFor(() => {
      expect(screen.queryByText('Publication permitted.')).not.toBeInTheDocument()
      expect(screen.getByText('Invalid Payload')).toBeInTheDocument()
      expect(screen.getByText('Fix JSON syntax to analyze.')).toBeInTheDocument()
    })

    // Verify Analyze is disabled
    expect(analyzeBtn).toBeDisabled()

    // Verify Publish is disabled with explicit message
    const disabledPublishBtn = screen.getByRole('button', { name: /Fix invalid JSON before publishing/i })
    expect(disabledPublishBtn).toBeDisabled()

    // Verify clicking disabled publish does not call publish API
    fireEvent.click(disabledPublishBtn)
    expect(eventGateApi.publishEvent).not.toHaveBeenCalled()
  })

  it('restores normal analysis workflow when valid JSON is entered after syntax error', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText('Enter JSON payload...')
    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })

    // Step 1: Corrupt JSON
    fireEvent.change(textarea, { target: { value: '{"broken": ' } })
    expect(screen.getByText('Invalid Payload')).toBeInTheDocument()
    expect(analyzeBtn).toBeDisabled()

    // Step 2: Fix JSON with valid syntax
    fireEvent.change(textarea, { target: { value: '{\n  "orderId": "O1001",\n  "amount": 500\n}' } })

    // Verify Ready to Analyze state is restored
    expect(screen.getByText('Ready to Analyze')).toBeInTheDocument()
    expect(analyzeBtn).toBeEnabled()

    // Step 3: Run analysis
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getByText('Publication permitted.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publish Event/i })).toBeEnabled()
    })
  })

  it('displays error banner when analysis API call fails', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockRejectedValue(new Error('Network timeout'))

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getByText(/Compatibility Analysis Failed/i)).toBeInTheDocument()
      expect(screen.getByText(/Network timeout/i)).toBeInTheDocument()
    })
  })

  it('renders Change Review summary and registers session history item after analysis', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      // Change Review strip
      expect(screen.getByText('Change Review')).toBeInTheDocument()
      expect(screen.getByText('0 consumers affected')).toBeInTheDocument()
      // Session history card
      expect(screen.getByText('Recent Reviews')).toBeInTheDocument()
    })
  })

  it('displays 422 Payload Rejected when publish returns HTTP 422', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)
    vi.mocked(eventGateApi.publishEvent).mockRejectedValue(
      new EventGateApiError(422, {
        code: 'INVALID_EVENT_PAYLOAD',
        message: 'Missing required field: orderId',
      })
    )

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)
    await waitFor(() => expect(screen.getByText('Publication permitted.')).toBeInTheDocument())

    const publishBtn = screen.getByRole('button', { name: /Publish Event/i })
    fireEvent.click(publishBtn)

    await waitFor(() => {
      expect(screen.getByText(/EventGate Publication Error/i)).toBeInTheDocument()
      expect(screen.getByText('HTTP 422')).toBeInTheDocument()
      expect(screen.getByText(/Missing required field: orderId/i)).toBeInTheDocument()
    })
  })

  it('displays 503 Publication Failed when publish returns HTTP 503', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)
    vi.mocked(eventGateApi.publishEvent).mockRejectedValue(
      new EventGateApiError(503, {
        code: 'EVENTBRIDGE_UNAVAILABLE',
        message: 'EventBridge publication did not complete successfully',
      })
    )

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)
    await waitFor(() => expect(screen.getByText('Publication permitted.')).toBeInTheDocument())

    const publishBtn = screen.getByRole('button', { name: /Publish Event/i })
    fireEvent.click(publishBtn)

    await waitFor(() => {
      expect(screen.getByText(/EventGate Publication Error/i)).toBeInTheDocument()
      expect(screen.getByText('HTTP 503')).toBeInTheDocument()
    })
  })

  it('clears active scenario chip and stale analysis when scenario preset is followed by manual payload editing', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API ONLINE')).toBeInTheDocument())

    // 1. Run analysis on initial preset
    const analyzeBtn = screen.getByRole('button', { name: /Analyze/i })
    fireEvent.click(analyzeBtn)
    await waitFor(() => expect(screen.getByText('Publication permitted.')).toBeInTheDocument())

    // 2. Select Breaking Scenario preset
    const breakingBtn = screen.getByRole('button', { name: /BREAK/i })
    fireEvent.click(breakingBtn)

    // Verify breaking button has active class / styling
    expect(breakingBtn.className).toContain('bg-slate-800')

    // 3. Manually edit payload textarea
    const payloadTextarea = screen.getByPlaceholderText('Enter JSON payload...')
    fireEvent.change(payloadTextarea, {
      target: { value: JSON.stringify({ orderId: 'ord-custom-99', customField: 123 }, null, 2) },
    })

    // 4. Verify breaking preset chip is now unselected (does not have active bg-slate-800)
    expect(breakingBtn.className).not.toContain('bg-slate-800')

    // 5. Verify stale decision is cleared
    expect(screen.queryByText('Publication permitted.')).not.toBeInTheDocument()
    expect(screen.queryByText('Publication prevented.')).not.toBeInTheDocument()
  })
})
