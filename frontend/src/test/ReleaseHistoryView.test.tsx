import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReleaseHistoryView } from '@/components/history/ReleaseHistoryView'
import { eventGateApi } from '@/services/api'
import { EventGateApiError } from '@/types/api'
import { finding, mockApi, record } from './fixtures'
import { renderWithProviders } from './render'
import { setViewportWide } from './setup'

vi.mock('@/services/api', async (importOriginal) => {
  const { mockApi } = await import('./fixtures')
  return { ...(await importOriginal<object>()), eventGateApi: mockApi() }
})

const records = [
  record({
    recordId: 'rec-safe',
    published: true,
    attemptedPublish: true,
    eventId: 'evt-1',
    eventBridgeEventId: 'eb-1',
    timestamp: '2026-11-02T08:00:00+00:00',
  }),
  record({
    recordId: 'rec-break',
    proposedVersion: 3,
    compatibilityResult: 'BREAK',
    severity: 'HIGH',
    decision: 'BLOCK',
    affectedConsumers: ['inventory-service'],
    findingsSummary: [finding({ consumerId: 'inventory-service', status: 'BREAK', field: 'shippingMethod', reason: 'type changed' })],
    attemptedPublish: true,
    error: 'Publication prevented by StandardReleasePolicy',
    timestamp: '2026-11-02T09:00:00+00:00',
  }),
  record({
    recordId: 'rec-review',
    eventType: 'PaymentCompleted',
    proposedVersion: 2,
    environment: 'staging',
    compatibilityResult: 'RISK',
    severity: 'MEDIUM',
    decision: 'REVIEW',
    affectedConsumers: ['fraud-detection-service'],
    timestamp: '2026-11-02T07:00:00+00:00',
  }),
]

const table = () => screen.getByRole('table', { name: 'Release history records' })
const rowIds = () => within(table()).getAllByRole('button', { name: /Inspect/ }).map((b) => b.textContent)

describe('Release history', () => {
  beforeEach(() => {
    Object.assign(eventGateApi, mockApi())
    vi.mocked(eventGateApi.listHistory).mockResolvedValue(records)
  })

  it('explains how history fills up when it is empty', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValue([])
    renderWithProviders(<ReleaseHistoryView />)
    expect(await screen.findByText('No releases recorded yet')).toBeInTheDocument()
  })

  it('shows totals and one row per record with every column filled', async () => {
    renderWithProviders(<ReleaseHistoryView />)
    await screen.findByRole('table')
    expect(screen.getByText('Recorded').nextSibling).toHaveTextContent('3')
    expect(screen.getByText('Blocked').nextSibling).toHaveTextContent('1')
    const headers = within(table()).getAllByRole('columnheader')
    const breakRow = within(table()).getByText('inventory-service').closest('tr') as HTMLElement
    // Regression: the body used to have one cell fewer than the header.
    expect(within(breakRow).getAllByRole('cell')).toHaveLength(headers.length)
    expect(within(breakRow).getByText('Prevented')).toBeInTheDocument()
  })

  it('sorts newest first and can flip or sort by decision', async () => {
    renderWithProviders(<ReleaseHistoryView />)
    await screen.findByRole('table')
    expect(rowIds()).toEqual(['Inspect record rec-break', 'Inspect record rec-safe', 'Inspect record rec-review'])
    fireEvent.click(within(table()).getByRole('button', { name: 'Time' }))
    expect(rowIds()[0]).toBe('Inspect record rec-review')
    fireEvent.click(within(table()).getByRole('button', { name: 'Decision' }))
    expect(within(table()).getByRole('columnheader', { name: 'Decision' })).toHaveAttribute('aria-sort', 'descending')
    expect(rowIds()).toEqual(['Inspect record rec-break', 'Inspect record rec-review', 'Inspect record rec-safe'])
  })

  it('combines search, event, environment and decision filters and clears them', async () => {
    renderWithProviders(<ReleaseHistoryView />)
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'OrderPlaced' } })
    fireEvent.change(screen.getByLabelText('Environment'), { target: { value: 'production' } })
    expect(rowIds()).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'BLOCK' } })
    expect(rowIds()).toEqual(['Inspect record rec-break'])
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'nothing-matches' } })
    expect(screen.getByText('No records match these filters')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(rowIds()).toHaveLength(3)
  })

  it('searches by affected consumer', async () => {
    renderWithProviders(<ReleaseHistoryView />)
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'fraud' } })
    expect(rowIds()).toEqual(['Inspect record rec-review'])
  })

  it('keeps working when an old record has a non-standard environment', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValue([record({ environment: 'Prod' })])
    renderWithProviders(<ReleaseHistoryView />)
    expect(await screen.findByRole('table')).toHaveTextContent('Prod')
  })

  it('shows the API error with retry', async () => {
    vi.mocked(eventGateApi.listHistory).mockRejectedValue(new EventGateApiError(0, { code: 'NETWORK_ERROR', message: 'Could not reach the EventGate API.' }))
    renderWithProviders(<ReleaseHistoryView />)
    expect(await screen.findByText('Could not load release history')).toBeInTheDocument()
    expect(screen.getByText('Could not reach the EventGate API.')).toBeInTheDocument()
  })

  it('inspects a record, downloads reports and opens it in Review', async () => {
    const onOpenReview = vi.fn()
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderWithProviders(<ReleaseHistoryView onOpenReview={onOpenReview} />)
    await screen.findByRole('table')
    fireEvent.click(within(table()).getByRole('button', { name: 'Inspect record rec-break' }))

    const drawer = screen.getByRole('dialog', { name: 'OrderPlaced v1 → v3' })
    expect(within(drawer).getByText('Publication prevented by StandardReleasePolicy')).toBeInTheDocument()
    expect(within(drawer).getByText('type changed')).toBeInTheDocument()

    await act(async () => fireEvent.click(within(drawer).getByRole('button', { name: 'Markdown' })))
    expect(eventGateApi.getReport).toHaveBeenCalledWith('rec-break', 'markdown')
    expect(await screen.findByText('Report downloaded')).toBeInTheDocument()

    fireEvent.click(within(drawer).getByRole('button', { name: 'Open in Review' }))
    expect(onOpenReview).toHaveBeenCalledWith({ eventType: 'OrderPlaced', currentVersion: 1, proposedVersion: 3 })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('tells the user when a report cannot be downloaded or copied', async () => {
    vi.mocked(eventGateApi.getReport).mockRejectedValue(new Error('Release record not found'))
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
    renderWithProviders(<ReleaseHistoryView />)
    await screen.findByRole('table')
    fireEvent.click(within(table()).getByRole('button', { name: 'Inspect record rec-safe' }))
    const drawer = screen.getByRole('dialog')
    await act(async () => fireEvent.click(within(drawer).getByRole('button', { name: 'JSON' })))
    expect(await screen.findByText('Could not download the report')).toBeInTheDocument()
    await act(async () => fireEvent.click(within(drawer).getByRole('button', { name: 'Copy Markdown' })))
    await waitFor(() => expect(screen.getByText('Could not copy the report')).toBeInTheDocument())
  })

  it('refreshes on demand', async () => {
    renderWithProviders(<ReleaseHistoryView />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(eventGateApi.listHistory).toHaveBeenCalledTimes(2))
  })

  it('pages long histories 25 at a time', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => record({ recordId: `r-${i}`, timestamp: `2026-11-02T08:${String(i).padStart(2, '0')}:00+00:00` }))
    )
    renderWithProviders(<ReleaseHistoryView />)
    await screen.findByRole('table')
    expect(rowIds()).toHaveLength(25)
    expect(screen.getByText('Showing 25 of 30 matching records (30 loaded)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 5 more' }))
    expect(rowIds()).toHaveLength(30)
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull()
  })

  it('shows a card list instead of the table on narrow screens', async () => {
    setViewportWide(false)
    renderWithProviders(<ReleaseHistoryView />)
    const list = await screen.findByRole('list', { name: 'Release history records' })
    expect(screen.queryByRole('table')).toBeNull()
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(within(list).getAllByRole('button', { name: 'Inspect' })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
