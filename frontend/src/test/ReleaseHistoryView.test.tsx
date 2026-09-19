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
      expect(screen.getByText(/No release evaluations recorded/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Zero fake functionality/i)).toBeInTheDocument()
  })

  it('renders release records table with stats and details', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValueOnce(mockRecords)

    renderWithClient(<ReleaseHistoryView />)

    await waitFor(() => {
      expect(screen.getByText('ALLOW')).toBeInTheDocument()
    })

    // Check stats
    expect(screen.getByText('Total Evaluations')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // total count

    // Check table content (2 table rows + 1 filter dropdown option)
    expect(screen.getAllByText('OrderPlaced')).toHaveLength(3)
    expect(screen.getByText('ALLOW')).toBeInTheDocument()
    expect(screen.getByText('BLOCK')).toBeInTheDocument()
    expect(screen.getByText('SAFE')).toBeInTheDocument()
    expect(screen.getByText('BREAK')).toBeInTheDocument()
  })

  it('filters records when search query is entered', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValueOnce(mockRecords)

    renderWithClient(<ReleaseHistoryView />)

    await waitFor(() => {
      expect(screen.getByText('ALLOW')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search audit records/i)
    fireEvent.change(searchInput, { target: { value: 'rec-002' } })

    expect(screen.queryByText('ALLOW')).not.toBeInTheDocument()
    expect(screen.getByText('BLOCK')).toBeInTheDocument()
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
})
