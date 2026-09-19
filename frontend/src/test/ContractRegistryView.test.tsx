import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContractRegistryView } from '@/components/contracts/ContractRegistryView'
import { eventGateApi } from '@/services/api'
import type { EventCatalogSummary, EventDetail } from '@/types/api'

vi.mock('@/services/api', () => ({
  eventGateApi: {
    listEventCatalog: vi.fn(),
    getEventDetail: vi.fn(),
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

describe('ContractRegistryView component', () => {
  const mockCatalog: EventCatalogSummary[] = [
    {
      eventType: 'OrderPlaced',
      versionCount: 4,
      versions: [1, 2, 3, 4],
      latestVersion: 4,
      consumerCount: 3,
    },
    {
      eventType: 'PaymentCompleted',
      versionCount: 2,
      versions: [1, 2],
      latestVersion: 2,
      consumerCount: 1,
    },
  ]

  const mockDetail: EventDetail = {
    eventType: 'OrderPlaced',
    versionCount: 4,
    versions: [1, 2, 3, 4],
    latestVersion: 4,
    contracts: [
      {
        eventType: 'OrderPlaced',
        version: 4,
        fields: {
          orderId: { name: 'orderId', type: 'string', required: true },
          amount: { name: 'amount', type: 'number', required: true },
        },
      },
      {
        eventType: 'OrderPlaced',
        version: 1,
        fields: {
          orderId: { name: 'orderId', type: 'string', required: true },
          notes: { name: 'notes', type: 'string', required: false },
        },
      },
    ],
    consumers: [
      {
        consumerId: 'inventory-service',
        eventType: 'OrderPlaced',
        expectedFields: {
          orderId: { name: 'orderId', type: 'string', required: true },
        },
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(eventGateApi.listEventCatalog).mockResolvedValue(mockCatalog)
    vi.mocked(eventGateApi.getEventDetail).mockResolvedValue(mockDetail)
  })

  it('renders event catalog list from server', async () => {
    renderWithClient(<ContractRegistryView />)

    expect(screen.getByText(/loading event contracts/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('OrderPlaced').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('PaymentCompleted')).toBeInTheDocument()
    expect(screen.getByText('4 versions')).toBeInTheDocument()
  })

  it('renders schema fields for active version and supports switching versions', async () => {
    renderWithClient(<ContractRegistryView />)

    await waitFor(() => {
      expect(screen.getByText('orderId')).toBeInTheDocument()
    })

    expect(screen.getByText('amount')).toBeInTheDocument()

    // Click version v1 pill
    const v1Button = screen.getByRole('button', { name: /^v1/i })
    fireEvent.click(v1Button)

    await waitFor(() => {
      expect(screen.getByText('notes')).toBeInTheDocument()
    })
  })

  it('filters event list when typing in search input', async () => {
    renderWithClient(<ContractRegistryView />)

    await waitFor(() => {
      expect(screen.getByText('PaymentCompleted')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/filter event types/i)
    fireEvent.change(searchInput, { target: { value: 'Payment' } })

    expect(screen.getByRole('button', { name: /PaymentCompleted/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /OrderPlaced/i })).not.toBeInTheDocument()
  })
})
