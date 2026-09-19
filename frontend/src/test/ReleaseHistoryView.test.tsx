import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReleaseHistoryView } from '@/components/history/ReleaseHistoryView'
import { eventGateApi } from '@/services/api'
import type { ReleaseRecord } from '@/types/api'

vi.mock('@/services/api', () => ({
  eventGateApi: {
    listHistory: vi.fn(),
    getReview: vi.fn(),
    getReport: vi.fn(),
    exportActiveReport: vi.fn(),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ReleaseHistoryView component', () => {
  const mockRecords: ReleaseRecord[] = [
    {
      recordId: 'rec-001-safe',
      analysisId: 'rec-001-safe',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      environment: 'production',
      compatibilityResult: 'SAFE',
      severity: 'LOW',
      policyName: 'StandardReleasePolicy',
      policyReason: 'Production permits backward-compatible changes.',
      decision: 'ALLOW',
      affectedConsumers: [],
      findingsSummary: [],
      published: true,
      attemptedPublish: true,
      eventId: 'evt-001',
      eventBridgeEventId: 'eb-111',
      timestamp: '2026-09-19T10:00:00Z',
    },
    {
      recordId: 'rec-002-break',
      analysisId: 'rec-002-break',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      environment: 'production',
      compatibilityResult: 'BREAK',
      severity: 'HIGH',
      policyName: 'StandardReleasePolicy',
      policyReason: 'Production strictly blocks breaking changes.',
      decision: 'BLOCK',
      affectedConsumers: ['inventory-service'],
      findingsSummary: [
        {
          consumerId: 'inventory-service',
          status: 'BREAK',
          ruleId: 'EVT001_FIELD_TYPE_CHANGED',
          field: 'shippingMethod',
          expectedType: 'string',
          proposedType: 'object',
          severity: 'HIGH',
          reason: 'Field type changed from string to object',
        },
      ],
      published: false,
      attemptedPublish: true,
      timestamp: '2026-09-19T11:00:00Z',
      error: 'Publication prevented by StandardReleasePolicy',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders fresh empty state when zero evaluations recorded', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValueOnce([])

    renderWithClient(<ReleaseHistoryView />)

    await waitFor(() => {
      expect(screen.getByText(/No release records yet/i)).toBeInTheDocument()
    })
  })

  it('renders release records table with stats and details', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValueOnce(mockRecords)

    renderWithClient(<ReleaseHistoryView />)

    await waitFor(() => {
      expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
    })

    // Check stats
    expect(screen.getByText('Evaluations')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // total count

    // Check table content (2 table rows + 1 filter dropdown option)
    expect(screen.getAllByText('OrderPlaced')).toHaveLength(3)
    expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
    expect(screen.getByText(/rec-002/i)).toBeInTheDocument()
    expect(screen.getByText('SAFE')).toBeInTheDocument()
    expect(screen.getByText('BREAK')).toBeInTheDocument()
  })

  it('filters records when search query is entered', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValueOnce(mockRecords)

    renderWithClient(<ReleaseHistoryView />)

    await waitFor(() => {
      expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search audit records/i)
    fireEvent.change(searchInput, { target: { value: 'rec-002' } })

    expect(screen.queryByText(/rec-001/i)).not.toBeInTheDocument()
    expect(screen.getByText(/rec-002/i)).toBeInTheDocument()
  })

  it('opens and closes inspector drawer when Inspect button is clicked', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValueOnce(mockRecords)

    renderWithClient(<ReleaseHistoryView />)

    await waitFor(() => {
      expect(screen.getAllByText('Inspect')).toHaveLength(2)
    })

    // Open first record drawer
    fireEvent.click(screen.getAllByText('Inspect')[0])

    expect(screen.getByText(/Release Audit Review: OrderPlaced v2/i)).toBeInTheDocument()
    expect(screen.getByText(/EventBridge Transport Status/i)).toBeInTheDocument()
    expect(screen.getByText('eb-111')).toBeInTheDocument()

    // Close drawer
    const closeBtn = screen.getByLabelText('Close Inspector')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Release Audit Review: OrderPlaced v2/i)).not.toBeInTheDocument()
    })
  })

  it('triggers markdown copy summary', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValueOnce(mockRecords)
    vi.mocked(eventGateApi.getReport).mockResolvedValueOnce({
      recordId: 'rec-001-safe',
      format: 'markdown',
      content: '# EventGate Release Review Report',
    })

    renderWithClient(<ReleaseHistoryView />)

    await waitFor(() => {
      expect(screen.getAllByTitle(/Copy Markdown Summary/i)).toHaveLength(2)
    })

    fireEvent.click(screen.getAllByTitle(/Copy Markdown Summary/i)[0])

    await waitFor(() => {
      expect(eventGateApi.getReport).toHaveBeenCalledWith('rec-001-safe', 'markdown')
    })
  })

  describe('Dedicated History Filters (Environment, Decision, Event, Combined)', () => {
    const multiRecords: ReleaseRecord[] = [
      mockRecords[0], // OrderPlaced, production, ALLOW (rec-001-safe)
      mockRecords[1], // OrderPlaced, production, BLOCK (rec-002-break)
      {
        recordId: 'rec-003-review',
        analysisId: 'rec-003-review',
        eventType: 'PaymentCompleted',
        currentVersion: 1,
        proposedVersion: 2,
        environment: 'staging',
        compatibilityResult: 'RISK',
        severity: 'MEDIUM',
        policyName: 'StandardReleasePolicy',
        policyReason: 'Manual review required',
        decision: 'REVIEW',
        affectedConsumers: ['billing-service'],
        findingsSummary: [],
        published: false,
        attemptedPublish: false,
        timestamp: '2026-09-19T12:00:00Z',
      },
      {
        recordId: 'rec-004-dev',
        analysisId: 'rec-004-dev',
        eventType: 'UserCreated',
        currentVersion: 1,
        proposedVersion: 2,
        environment: 'development',
        compatibilityResult: 'SAFE',
        severity: 'LOW',
        policyName: 'DevReleasePolicy',
        policyReason: 'Dev permits changes',
        decision: 'ALLOW',
        affectedConsumers: [],
        findingsSummary: [],
        published: false,
        attemptedPublish: false,
        timestamp: '2026-09-19T13:00:00Z',
      },
    ]

    it('filters records by Environment dropdown', async () => {
      vi.mocked(eventGateApi.listHistory).mockResolvedValue(multiRecords)

      renderWithClient(<ReleaseHistoryView />)

      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
        expect(screen.getByText(/rec-003/i)).toBeInTheDocument()
        expect(screen.getByText(/rec-004/i)).toBeInTheDocument()
      })

      const envSelect = screen.getByLabelText('Filter by Environment')

      // Filter by staging
      fireEvent.change(envSelect, { target: { value: 'staging' } })
      expect(screen.getByText(/rec-003/i)).toBeInTheDocument()
      expect(screen.queryByText(/rec-001/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/rec-004/i)).not.toBeInTheDocument()

      // Filter by development
      fireEvent.change(envSelect, { target: { value: 'development' } })
      expect(screen.getByText(/rec-004/i)).toBeInTheDocument()
      expect(screen.queryByText(/rec-003/i)).not.toBeInTheDocument()

      // Filter by production
      fireEvent.change(envSelect, { target: { value: 'production' } })
      expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      expect(screen.getByText(/rec-002/i)).toBeInTheDocument()
      expect(screen.queryByText(/rec-003/i)).not.toBeInTheDocument()
    })

    it('filters records by Decision dropdown', async () => {
      vi.mocked(eventGateApi.listHistory).mockResolvedValue(multiRecords)

      renderWithClient(<ReleaseHistoryView />)

      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      })

      const decisionSelect = screen.getByLabelText('Filter by Decision')

      // Filter by REVIEW
      fireEvent.change(decisionSelect, { target: { value: 'REVIEW' } })
      expect(screen.getByText(/rec-003/i)).toBeInTheDocument()
      expect(screen.queryByText(/rec-001/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/rec-002/i)).not.toBeInTheDocument()

      // Filter by BLOCK
      fireEvent.change(decisionSelect, { target: { value: 'BLOCK' } })
      expect(screen.getByText(/rec-002/i)).toBeInTheDocument()
      expect(screen.queryByText(/rec-001/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/rec-003/i)).not.toBeInTheDocument()

      // Filter by ALLOW
      fireEvent.change(decisionSelect, { target: { value: 'ALLOW' } })
      expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      expect(screen.getByText(/rec-004/i)).toBeInTheDocument()
      expect(screen.queryByText(/rec-002/i)).not.toBeInTheDocument()
    })

    it('filters records by Event Type dropdown', async () => {
      vi.mocked(eventGateApi.listHistory).mockResolvedValue(multiRecords)

      renderWithClient(<ReleaseHistoryView />)

      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      })

      const eventSelect = screen.getByLabelText('Filter by Event Type')
      fireEvent.change(eventSelect, { target: { value: 'PaymentCompleted' } })

      await waitFor(() => {
        expect(screen.getByText(/rec-003/i)).toBeInTheDocument()
      })
      expect(screen.queryByText(/rec-001/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/rec-004/i)).not.toBeInTheDocument()
    })

    it('combines Event Type, Environment, Decision, and Search filters', async () => {
      vi.mocked(eventGateApi.listHistory).mockResolvedValue(multiRecords)

      renderWithClient(<ReleaseHistoryView />)

      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      })

      const envSelect = screen.getByLabelText('Filter by Environment')
      const decisionSelect = screen.getByLabelText('Filter by Decision')
      const searchInput = screen.getByPlaceholderText(/Search audit records/i)

      // Apply Environment = production, Decision = BLOCK
      fireEvent.change(envSelect, { target: { value: 'production' } })
      fireEvent.change(decisionSelect, { target: { value: 'BLOCK' } })

      expect(screen.getByText(/rec-002/i)).toBeInTheDocument()
      expect(screen.queryByText(/rec-001/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/rec-003/i)).not.toBeInTheDocument()

      // Add Search query matching rec-002
      fireEvent.change(searchInput, { target: { value: 'rec-002' } })
      expect(screen.getByText(/rec-002/i)).toBeInTheDocument()

      // Search query not matching
      fireEvent.change(searchInput, { target: { value: 'nonexistent-query' } })
      expect(screen.queryByText(/rec-002/i)).not.toBeInTheDocument()
      expect(screen.getByText(/No release records match the current filters/i)).toBeInTheDocument()
    })

    it('clears active filters and restores all records', async () => {
      vi.mocked(eventGateApi.listHistory).mockResolvedValue(multiRecords)

      renderWithClient(<ReleaseHistoryView />)

      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      })

      const envSelect = screen.getByLabelText('Filter by Environment')
      fireEvent.change(envSelect, { target: { value: 'staging' } })

      expect(screen.queryByText(/rec-001/i)).not.toBeInTheDocument()
      expect(screen.getByText(/rec-003/i)).toBeInTheDocument()

      // Clear filters button should be visible
      const clearBtn = screen.getByLabelText('Clear filters')
      expect(clearBtn).toBeInTheDocument()
      fireEvent.click(clearBtn)

      // All records restored
      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
        expect(screen.getByText(/rec-002/i)).toBeInTheDocument()
        expect(screen.getByText(/rec-003/i)).toBeInTheDocument()
        expect(screen.getByText(/rec-004/i)).toBeInTheDocument()
      })
    })

    it('shows empty filtered state with clear action when no records match', async () => {
      vi.mocked(eventGateApi.listHistory).mockResolvedValue(multiRecords)

      renderWithClient(<ReleaseHistoryView />)

      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      })

      // Select development + BLOCK (no records in multiRecords match this)
      const envSelect = screen.getByLabelText('Filter by Environment')
      const decisionSelect = screen.getByLabelText('Filter by Decision')

      fireEvent.change(envSelect, { target: { value: 'development' } })
      fireEvent.change(decisionSelect, { target: { value: 'BLOCK' } })

      expect(screen.getByText('No release records match the current filters.')).toBeInTheDocument()
      expect(
        screen.getByText(/Try adjusting or clearing your active filter criteria/i)
      ).toBeInTheDocument()

      // Click clear filters from the empty state
      const clearButtons = screen.getAllByRole('button', { name: /Clear filters/i })
      expect(clearButtons.length).toBeGreaterThan(0)
      fireEvent.click(clearButtons[0])

      // All records restored
      await waitFor(() => {
        expect(screen.getByText(/rec-001/i)).toBeInTheDocument()
      })
    })



  })
})
