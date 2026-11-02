import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContractsHub } from '@/components/contracts/ContractsHub'
import { eventGateApi } from '@/services/api'
import { mockApi } from './fixtures'
import { renderWithProviders } from './render'

vi.mock('@/services/api', async (importOriginal) => {
  const { mockApi } = await import('./fixtures')
  return { ...(await importOriginal<object>()), eventGateApi: mockApi() }
})

describe('Contracts page', () => {
  beforeEach(() => {
    Object.assign(eventGateApi, mockApi())
    vi.mocked(eventGateApi.listConsumers).mockResolvedValue([
      { consumerId: 'billing-service', eventType: 'OrderPlaced', expectedFieldsCount: 2 },
      { consumerId: 'fraud-detection-service', eventType: 'PaymentCompleted', expectedFieldsCount: 1 },
    ])
    vi.mocked(eventGateApi.getConsumerDetail).mockImplementation(async (id: string) => ({
      consumerId: id,
      eventType: id === 'billing-service' ? 'OrderPlaced' : 'PaymentCompleted',
      expectedFields: { orderId: { name: 'orderId', type: 'string', required: true } },
    }))
  })

  it('lists event types and shows the latest version’s fields with their readers', async () => {
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /PaymentCompleted/ })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: /Fields of OrderPlaced v4/ })
    const row = within(table).getByText('shippingMethod').closest('tr') as HTMLElement
    expect(within(row).getByText('inventory-service')).toBeInTheDocument()
  })

  it('switches versions and opens the change in Review', async () => {
    const onOpenReview = vi.fn()
    renderWithProviders(<ContractsHub onOpenReview={onOpenReview} />)
    fireEvent.click(await screen.findByRole('button', { name: /^v3/ }))
    expect(await screen.findByRole('table', { name: /OrderPlaced v3/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review v2 → v3' }))
    expect(onOpenReview).toHaveBeenCalledWith({ eventType: 'OrderPlaced', currentVersion: 2, proposedVersion: 3 })
  })

  it('opens the selected event, not a hard-coded one', async () => {
    const onOpenReview = vi.fn()
    renderWithProviders(<ContractsHub onOpenReview={onOpenReview} />)
    fireEvent.click(await screen.findByRole('button', { name: /PaymentCompleted/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review v1 → v2' }))
    expect(onOpenReview).toHaveBeenCalledWith({ eventType: 'PaymentCompleted', currentVersion: 1, proposedVersion: 2 })
  })

  it('filters event types and offers to clear an empty result', async () => {
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    const input = await screen.findByLabelText('Filter event types')
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('No event types match "zzz"')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    expect(screen.getByRole('button', { name: /OrderPlaced/ })).toBeInTheDocument()
  })

  it('shows an error with retry when the catalog fails', async () => {
    vi.mocked(eventGateApi.listEventCatalog).mockRejectedValue(new Error('HTTP 500'))
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    expect(await screen.findByText('Could not load event contracts')).toBeInTheDocument()
    vi.mocked(eventGateApi.listEventCatalog).mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No event contracts registered')).toBeInTheDocument()
  })

  it('consumer contracts link back to the consumer’s own event', async () => {
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Consumer contracts' }))
    fireEvent.click(await screen.findByRole('button', { name: /fraud-detection-service/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'View PaymentCompleted' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /PaymentCompleted/ })).toHaveAttribute('aria-current', 'true')
    )
  })

  it('filters consumers', async () => {
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Consumer contracts' }))
    fireEvent.change(await screen.findByLabelText('Filter consumers'), { target: { value: 'fraud' } })
    expect(screen.queryByRole('button', { name: /billing-service/ })).toBeNull()
  })

  it('shows the event detail error with a retry', async () => {
    vi.mocked(eventGateApi.getEventDetail).mockRejectedValue(new Error('HTTP 500'))
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    expect(await screen.findByText('Could not load OrderPlaced')).toBeInTheDocument()
    vi.mocked(eventGateApi.getEventDetail).mockImplementation(async () => (await import('./fixtures')).orderPlacedDetail)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: /Fields of OrderPlaced v4/ })).toBeInTheDocument()
  })

  it('shows consumer list and detail errors and an empty registry', async () => {
    vi.mocked(eventGateApi.listConsumers).mockRejectedValueOnce(new Error('HTTP 503'))
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Consumer contracts' }))
    expect(await screen.findByText('Could not load consumer contracts')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    vi.mocked(eventGateApi.getConsumerDetail).mockRejectedValue(new Error('HTTP 404'))
    expect(await screen.findByText('Could not load billing-service')).toBeInTheDocument()
  })

  it('explains how to add consumers when none are registered', async () => {
    vi.mocked(eventGateApi.listConsumers).mockResolvedValue([])
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Consumer contracts' }))
    expect(await screen.findByText('No consumer contracts registered')).toBeInTheDocument()
  })

  it('clears an empty consumer filter', async () => {
    renderWithProviders(<ContractsHub onOpenReview={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Consumer contracts' }))
    fireEvent.change(await screen.findByLabelText('Filter consumers'), { target: { value: 'zzz' } })
    expect(screen.getByText('No consumers match "zzz"')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    expect(screen.getByRole('button', { name: /billing-service/ })).toBeInTheDocument()
  })
})
