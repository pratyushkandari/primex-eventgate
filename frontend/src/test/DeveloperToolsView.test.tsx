import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeveloperToolsView } from '@/components/devtools/DeveloperToolsView'
import { eventGateApi } from '@/services/api'
import { analysis, finding, mockApi } from './fixtures'
import { renderWithProviders } from './render'

vi.mock('@/services/api', async (importOriginal) => {
  const { mockApi } = await import('./fixtures')
  return { ...(await importOriginal<object>()), eventGateApi: mockApi() }
})

const run = () => fireEvent.click(screen.getByRole('button', { name: 'Run assertion' }))

describe('Developer tools', () => {
  beforeEach(() => Object.assign(eventGateApi, mockApi()))

  it('pre-fills the expected decision for samples and generates matching CLI commands', async () => {
    renderWithProviders(<DeveloperToolsView environment="production" />)
    expect(screen.getByLabelText('Expected decision')).toHaveValue('ALLOW')
    expect(screen.getByText('Filled in from the sample change.')).toBeInTheDocument()
    expect(
      screen.getByText('eventgate check --event OrderPlaced --current 1 --proposed 2 --env production')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /OrderPlaced v1→v4/ }))
    expect(screen.getByLabelText('Expected decision')).toHaveValue('REVIEW')
    fireEvent.change(screen.getByLabelText('Environment'), { target: { value: 'development' } })
    expect(screen.getByLabelText('Expected decision')).toHaveValue('ALLOW')
    expect(await screen.findByText(/--expected ALLOW --env development/)).toBeInTheDocument()
  })

  it('passes when the decision matches and lists consumers from the response', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(analysis('BLOCK'))
    renderWithProviders(<DeveloperToolsView environment="production" />)
    fireEvent.click(screen.getByRole('button', { name: /OrderPlaced v1→v3/ }))
    run()
    expect(await screen.findByText('Pass: expected BLOCK, got BLOCK')).toBeInTheDocument()
    const consumers = screen.getByRole('list', { name: 'Consumer results' })
    expect(within(consumers).getByText('inventory-service')).toBeInTheDocument()
    expect(eventGateApi.analyzeCompatibility).toHaveBeenCalledWith({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      environment: 'production',
    })
  })

  it('fails when the decision differs from an overridden expectation', async () => {
    renderWithProviders(<DeveloperToolsView environment="production" />)
    fireEvent.change(screen.getByLabelText('Expected decision'), { target: { value: 'BLOCK' } })
    expect(screen.getByText("Overriding the sample's expected ALLOW.")).toBeInTheDocument()
    run()
    expect(await screen.findByText('Fail: expected BLOCK, got ALLOW')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Use ALLOW' }))
    expect(screen.getByLabelText('Expected decision')).toHaveValue('ALLOW')
  })

  it('shows the real consumers for non-sample events and requires an expectation', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValue(
      analysis('ALLOW', { eventType: 'PaymentCompleted', findings: [finding({ consumerId: 'fraud-detection-service' })] })
    )
    renderWithProviders(<DeveloperToolsView environment="production" />)
    await screen.findByRole('option', { name: 'PaymentCompleted' })
    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'PaymentCompleted' } })
    expect(screen.getByRole('button', { name: 'Run assertion' })).toBeDisabled()
    expect(screen.getByText(/No sample covers this change/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Expected decision'), { target: { value: 'ALLOW' } })
    run()
    const consumers = await screen.findByRole('list', { name: 'Consumer results' })
    // Regression: results used to list the three OrderPlaced consumers for every event.
    expect(within(consumers).getAllByRole('listitem')).toHaveLength(1)
    expect(within(consumers).getByText('fraud-detection-service')).toBeInTheDocument()
  })

  it('rejects identical versions and reports API errors', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockRejectedValue(new Error('UNSUPPORTED_EVENT_VERSION'))
    renderWithProviders(<DeveloperToolsView environment="production" />)
    fireEvent.change(screen.getByLabelText('Proposed version'), { target: { value: '1' } })
    expect(screen.getByText('Choose two different versions.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Proposed version'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Expected decision'), { target: { value: 'BLOCK' } })
    run()
    expect(await screen.findByText('The assertion could not run')).toBeInTheDocument()
  })

  it('opens the asserted change in Review', async () => {
    const onOpenReview = vi.fn()
    renderWithProviders(<DeveloperToolsView environment="staging" onOpenReview={onOpenReview} />)
    run()
    fireEvent.click(await screen.findByRole('button', { name: 'Open this change in Review' }))
    expect(onOpenReview).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'OrderPlaced', currentVersion: 1, proposedVersion: 2, environment: 'staging' })
    )
  })
})
