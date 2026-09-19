import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConsumerExplorerView } from '@/components/contracts/ConsumerExplorerView'
import { eventGateApi } from '@/services/api'
import type { ConsumerDetail, ConsumerSummary } from '@/types/api'

vi.mock('@/services/api', () => ({
  eventGateApi: {
    listConsumers: vi.fn(),
    getConsumerDetail: vi.fn(),
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

describe('ConsumerExplorerView component', () => {
  const mockConsumers: ConsumerSummary[] = [
    { consumerId: 'inventory-service', eventType: 'OrderPlaced', expectedFieldsCount: 3 },
    { consumerId: 'billing-service', eventType: 'OrderPlaced', expectedFieldsCount: 2 },
  ]

  const mockDetail: ConsumerDetail = {
    consumerId: 'inventory-service',
    eventType: 'OrderPlaced',
    expectedFields: {
      orderId: { name: 'orderId', type: 'string', required: true },
      items: { name: 'items', type: 'array', required: true },
      shippingMethod: { name: 'shippingMethod', type: 'string', required: true },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(eventGateApi.listConsumers).mockResolvedValue(mockConsumers)
    vi.mocked(eventGateApi.getConsumerDetail).mockResolvedValue(mockDetail)
  })

  it('renders consumers list and consumer detail', async () => {
    renderWithClient(<ConsumerExplorerView />)

    expect(screen.getByText(/loading consumer contracts/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('inventory-service').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('billing-service')).toBeInTheDocument()
    expect(screen.getByText('shippingMethod')).toBeInTheDocument()
    expect(screen.getAllByText('Strictly Required').length).toBe(3)
  })

  it('filters consumer list by search query', async () => {
    renderWithClient(<ConsumerExplorerView />)

    await waitFor(() => {
      expect(screen.getByText('billing-service')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search consumers or events/i)
    fireEvent.change(searchInput, { target: { value: 'billing' } })

    expect(screen.getByRole('button', { name: /billing-service/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /inventory-service/i })).not.toBeInTheDocument()
  })
})
