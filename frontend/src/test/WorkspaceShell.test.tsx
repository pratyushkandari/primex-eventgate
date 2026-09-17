import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { eventGateApi } from '@/services/api'
import type { AnalysisResponse, PublishResponse } from '@/types/api'

vi.mock('@/services/api', () => ({
  eventGateApi: {
    checkHealth: vi.fn(),
    analyzeCompatibility: vi.fn(),
    publishEvent: vi.fn(),
  },
}))

describe('WorkspaceShell integrated workflow', () => {
  const mockAllowAnalysis: AnalysisResponse = {
    analysisId: 'an-allow-101',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 2,
    decision: 'ALLOW',
    severity: 'LOW',
    summary: 'All 3 consumers are safe with the proposed change.',
    timestamp: '2026-09-18T00:00:00Z',
    requestId: 'req-allow-1',
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
        ruleId: 'EVT005_OPTIONAL_FIELD_ADDED',
        field: '*',
        expectedType: null,
        proposedType: null,
        severity: 'LOW',
        reason: 'Billing Service unaffected.',
      },
    ],
  }

  const mockBlockAnalysis: AnalysisResponse = {
    analysisId: 'an-block-102',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 3,
    decision: 'BLOCK',
    severity: 'HIGH',
    summary: '1 consumer would break.',
    timestamp: '2026-09-18T00:00:00Z',
    requestId: 'req-block-1',
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
        reason: 'Type changed from string to object.',
      },
    ],
  }

  const mockReviewAnalysis: AnalysisResponse = {
    analysisId: 'an-review-103',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 4,
    decision: 'REVIEW',
    severity: 'MEDIUM',
    summary: '1 consumer has a potential risk.',
    timestamp: '2026-09-18T00:00:00Z',
    requestId: 'req-review-1',
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
        ruleId: 'EVT008_OPTIONAL_FIELD_REMOVED',
        field: 'couponCode',
        expectedType: null,
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
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    expect(screen.getByText('PrimeX EventGate')).toBeInTheDocument()
    expect(screen.getByText(/Contract & Payload/i)).toBeInTheDocument()
    expect(screen.getByText(/Ready to Analyze/i)).toBeInTheDocument()
    expect(screen.getByText(/Downstream Impact/i)).toBeInTheDocument()
  })

  it('switches between sample scenarios without fabricating analysis', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    // Initial state is Safe scenario (v2)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('2')

    // Click Breaking scenario button
    const breakingBtn = screen.getByRole('button', { name: /2\. BREAKING/i })
    fireEvent.click(breakingBtn)
    expect(select.value).toBe('3')
    expect(screen.getByText('Ready to Analyze')).toBeInTheDocument()

    // Click Risk scenario button
    const riskBtn = screen.getByRole('button', { name: /3\. RISK/i })
    fireEvent.click(riskBtn)
    expect(select.value).toBe('4')
    expect(screen.getByText('Ready to Analyze')).toBeInTheDocument()
  })

  it('executes analysis and renders ALLOW decision with active publish button', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Compatibility/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getAllByText('ALLOW')[0]).toBeInTheDocument()
      expect(screen.getByText('Safe to Publish')).toBeInTheDocument()
      expect(screen.getByText('SEVERITY: LOW')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publish Event to EventBridge/i })).toBeEnabled()
    })

    expect(eventGateApi.analyzeCompatibility).toHaveBeenCalledWith({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
    })
  })

  it('executes analysis and renders BLOCK decision with publish prevented', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockBlockAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    const breakingBtn = screen.getByRole('button', { name: /2\. BREAKING/i })
    fireEvent.click(breakingBtn)

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Compatibility/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getAllByText('BLOCK')[0]).toBeInTheDocument()
      expect(screen.getByText('Breaking Change Intercepted')).toBeInTheDocument()
      expect(screen.getByText('SEVERITY: HIGH')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publication Prevented by Gate/i })).toBeDisabled()
    })
  })

  it('executes analysis and renders REVIEW decision with publication prevented', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockReviewAnalysis)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    const riskBtn = screen.getByRole('button', { name: /3\. RISK/i })
    fireEvent.click(riskBtn)

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Compatibility/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getAllByText('REVIEW')[0]).toBeInTheDocument()
      expect(screen.getByText('Review Required')).toBeInTheDocument()
      expect(screen.getByText('SEVERITY: MEDIUM')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publication Prevented by Gate/i })).toBeDisabled()
    })
  })

  it('executes publish workflow when ALLOW and renders EventBridge entry', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(mockAllowAnalysis)
    vi.mocked(eventGateApi.publishEvent).mockResolvedValue(mockPublishResponse)

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    // Step 1: Analyze
    const analyzeBtn = screen.getByRole('button', { name: /Analyze Compatibility/i })
    fireEvent.click(analyzeBtn)
    await waitFor(() => expect(screen.getByText('Safe to Publish')).toBeInTheDocument())

    // Step 2: Publish
    const publishBtn = screen.getByRole('button', { name: /Publish Event to EventBridge/i })
    fireEvent.click(publishBtn)

    await waitFor(() => {
      expect(screen.getByText(/Published to Amazon EventBridge/i)).toBeInTheDocument()
      expect(screen.getByText('evt-allow-verified-1')).toBeInTheDocument()
      expect(screen.getByText('eb-verified-entry-888')).toBeInTheDocument()
    })

    expect(eventGateApi.publishEvent).toHaveBeenCalledTimes(1)
  })

  it('prevents analysis submission when JSON payload has syntax errors', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText('Enter JSON payload...')
    fireEvent.change(textarea, { target: { value: '{"orderId": INVALID_SYNTAX}' } })

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Compatibility/i })
    expect(analyzeBtn).toBeDisabled()

    fireEvent.click(analyzeBtn)
    expect(eventGateApi.analyzeCompatibility).not.toHaveBeenCalled()
  })

  it('displays error banner when analysis API call fails', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockRejectedValue(new Error('Network timeout'))

    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Compatibility/i })
    fireEvent.click(analyzeBtn)

    await waitFor(() => {
      expect(screen.getByText(/Compatibility Analysis Failed/i)).toBeInTheDocument()
      expect(screen.getByText(/Network timeout/i)).toBeInTheDocument()
    })
  })
})
