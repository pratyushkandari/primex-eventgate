import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { eventGateApi } from '@/services/api'
import { EventGateApiError } from '@/types/api'
import { analysis, mockApi, publishResponse, record } from './fixtures'
import { renderWithProviders } from './render'

vi.mock('@/services/api', async (importOriginal) => {
  const { mockApi } = await import('./fixtures')
  return { ...(await importOriginal<object>()), eventGateApi: mockApi() }
})

const editor = () => screen.getByLabelText('Event payload (JSON)') as HTMLTextAreaElement
const analyzeButton = () => screen.getByRole('button', { name: /Analyze compatibility/ })

async function renderApp() {
  renderWithProviders(<WorkspaceShell />)
  await screen.findByRole('option', { name: 'PaymentCompleted' })
}

async function analyzeTo(text: string) {
  fireEvent.click(analyzeButton())
  expect(await screen.findByText(text)).toBeInTheDocument()
}

describe('App shell and Review workflow', () => {
  beforeEach(() => Object.assign(eventGateApi, mockApi()))

  it('starts on Review with the safe sample and the event’s consumers', async () => {
    await renderApp()
    expect(screen.getByRole('heading', { name: 'Review a contract change' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add optional field/ })).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(editor().value)).toHaveProperty('metadata')
    expect(await screen.findByText('3 registered consumers')).toBeInTheDocument()
  })

  it('analyzes, then asks for confirmation before publishing to production', async () => {
    await renderApp()
    await analyzeTo('Safe to publish')
    expect(eventGateApi.analyzeCompatibility).toHaveBeenCalledWith({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      environment: 'production',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Publish event' }))
    const confirm = screen.getByRole('dialog', { name: 'Publish to production?' })
    await act(async () => fireEvent.click(within(confirm).getByRole('button', { name: 'Publish event' })))

    expect(eventGateApi.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ analysisId: 'an-allow', environment: 'production', payload: expect.objectContaining({ orderId: 'ord-101' }) })
    )
    expect(await screen.findByText('Event published')).toBeInTheDocument()
    expect(screen.getByText('Published to the local in-memory publisher')).toBeInTheDocument()
    expect(screen.getByText('Accepted by in-memory publisher')).toBeInTheDocument()
  })

  it('cancelling the confirmation does not publish', async () => {
    await renderApp()
    await analyzeTo('Safe to publish')
    fireEvent.click(screen.getByRole('button', { name: 'Publish event' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(eventGateApi.publishEvent).not.toHaveBeenCalled()
  })

  it('publishes without a confirmation outside production', async () => {
    await renderApp()
    fireEvent.change(screen.getByLabelText('Release target environment'), { target: { value: 'staging' } })
    await analyzeTo('Safe to publish')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Publish event' })))
    expect(eventGateApi.publishEvent).toHaveBeenCalledWith(expect.objectContaining({ environment: 'staging' }))
  })

  it('blocks publishing on BLOCK and REVIEW', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValueOnce(analysis('BLOCK'))
    await renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Change field type/ }))
    expect(JSON.parse(editor().value).shippingMethod).toEqual({ carrier: 'express', trackingNumber: 'TRK-987' })
    await analyzeTo('Blocked')
    expect(screen.getByRole('button', { name: 'Publishing not allowed' })).toBeDisabled()

    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValueOnce(analysis('REVIEW'))
    fireEvent.click(screen.getByRole('button', { name: /Remove optional field/ }))
    await analyzeTo('Held for review')
    expect(screen.getByRole('button', { name: 'Publishing not allowed' })).toBeDisabled()
  })

  it('drops a stale decision when the environment, payload or sample changes', async () => {
    await renderApp()
    await analyzeTo('Safe to publish')
    fireEvent.change(screen.getByLabelText('Release target environment'), { target: { value: 'development' } })
    expect(screen.getByText('No analysis yet')).toBeInTheDocument()

    await analyzeTo('Safe to publish')
    fireEvent.change(editor(), { target: { value: '{"orderId": "x"}' } })
    expect(screen.getByText('No analysis yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add optional field/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('refuses to analyze malformed JSON and recovers when it is fixed', async () => {
    await renderApp()
    fireEvent.change(editor(), { target: { value: '{"orderId": ' } })
    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument()
    expect(analyzeButton()).toBeDisabled()
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(eventGateApi.analyzeCompatibility).not.toHaveBeenCalled()

    fireEvent.change(editor(), { target: { value: '[1, 2]' } })
    expect(screen.getByText(/must be a JSON object/)).toBeInTheDocument()

    fireEvent.change(editor(), { target: { value: '{"orderId":"x"}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Format' }))
    expect(editor().value).toBe('{\n  "orderId": "x"\n}')
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(await screen.findByText('Safe to publish')).toBeInTheDocument()
  })

  it('shows an analysis failure with a retry', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockRejectedValueOnce(new Error('Could not reach the EventGate API.'))
    await renderApp()
    fireEvent.click(analyzeButton())
    expect(await screen.findByText('Analysis failed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Safe to publish')).toBeInTheDocument()
  })

  it.each([
    [new EventGateApiError(422, { code: 'INVALID_EVENT_PAYLOAD', message: "Missing required field: 'amount'." }), 'Payload does not match the proposed contract'],
    [new EventGateApiError(503, { code: 'EVENT_PUBLISH_FAILED', message: 'The event could not be published.' }), 'Event bus unavailable'],
  ])('explains publish failures (%s)', async (error, title) => {
    vi.mocked(eventGateApi.publishEvent).mockRejectedValueOnce(error)
    await renderApp()
    fireEvent.change(screen.getByLabelText('Release target environment'), { target: { value: 'development' } })
    await analyzeTo('Safe to publish')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Publish event' })))
    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.getByText(error.message)).toBeInTheDocument()
  })

  it('records recent reviews and exports the stored report', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    await renderApp()
    await analyzeTo('Safe to publish')
    expect(screen.getByRole('region', { name: 'Recent reviews' })).toHaveTextContent('ALLOW')

    fireEvent.click(screen.getByRole('button', { name: 'Export report' }))
    const dialog = screen.getByRole('dialog', { name: 'Export release report' })
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Copy Markdown' })))
    expect(eventGateApi.getReport).toHaveBeenCalledWith('an-allow', 'markdown')
    expect(await screen.findByText('Report copied')).toBeInTheDocument()
  })

  it('opens a history record in Review with a payload generated from its contract', async () => {
    vi.mocked(eventGateApi.listHistory).mockResolvedValue([
      record({ recordId: 'rec-pay', eventType: 'PaymentCompleted', proposedVersion: 2 }),
    ])
    await renderApp()
    fireEvent.click(screen.getAllByRole('link', { name: 'History' })[0])
    expect(window.location.hash).toBe('#/history')
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect record rec-pay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open in Review' }))

    await waitFor(() => expect(screen.getByLabelText('Event type')).toHaveValue('PaymentCompleted'))
    expect(window.location.hash).toBe('#/review')
    await waitFor(() => expect(JSON.parse(editor().value)).toHaveProperty('transactionFee', 1.5))
    expect(screen.getByRole('button', { name: /fraud-detection-service/ })).toBeInTheDocument()
  })

  it('opens consumer details from the impact list', async () => {
    vi.mocked(eventGateApi.analyzeCompatibility).mockResolvedValueOnce(analysis('BLOCK'))
    await renderApp()
    await analyzeTo('Blocked')
    const impact = screen.getByRole('heading', { name: 'Consumer impact' }).closest('section') as HTMLElement
    fireEvent.click(within(impact).getByRole('button', { name: /inventory-service/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('EVT001_FIELD_TYPE_CHANGED')
  })

  it('supports the keyboard shortcuts', async () => {
    await renderApp()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const palette = screen.getByRole('dialog', { name: 'Command palette' })
    fireEvent.change(within(palette).getByRole('combobox'), { target: { value: 'Go to Policies' } })
    vi.mocked(eventGateApi.getPolicies).mockReturnValue(new Promise(() => {}))
    fireEvent.keyDown(within(palette).getByRole('combobox'), { key: 'Enter' })
    expect(window.location.hash).toBe('#/policies')

    // Ctrl+Enter only analyzes on the Review page.
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(eventGateApi.analyzeCompatibility).not.toHaveBeenCalled()

    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts and rules' })).toBeInTheDocument()
  })

  it('loads a sample from the command palette', async () => {
    await renderApp()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.click(screen.getByText('Sample: Change field type'))
    expect(screen.getByLabelText('Proposed version')).toHaveValue('3')
  })

  it('shows the API publish response flags', async () => {
    vi.mocked(eventGateApi.publishEvent).mockResolvedValueOnce(publishResponse({ eventBridgeEventId: 'eb-real-1' }))
    vi.mocked(eventGateApi.getRuntimeConfig).mockResolvedValue({
      ...(await eventGateApi.getRuntimeConfig()),
      publisherBackendType: 'eventbridge',
      eventBridgeBus: 'primex-eventgate-dev-bus',
    })
    await renderApp()
    fireEvent.change(screen.getByLabelText('Release target environment'), { target: { value: 'development' } })
    await analyzeTo('Safe to publish')
    expect(screen.getByText('Sends to EventBridge bus primex-eventgate-dev-bus')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Publish event' })))
    expect(await screen.findByText('eb-real-1')).toBeInTheDocument()
  })

  it('downloads the stored report from the Review page and reports failures', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await renderApp()
    await analyzeTo('Safe to publish')
    fireEvent.click(screen.getByRole('button', { name: 'Export report' }))
    const dialog = screen.getByRole('dialog', { name: 'Export release report' })

    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Download JSON' })))
    expect(eventGateApi.getReport).toHaveBeenCalledWith('an-allow', 'json')
    expect(await screen.findByText('Report downloaded')).toBeInTheDocument()

    vi.mocked(eventGateApi.getReport).mockRejectedValueOnce(new Error('Release record not found'))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Download Markdown' })))
    expect(await screen.findByText('Could not download the report')).toBeInTheDocument()

    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Copy Markdown' })))
    expect(await screen.findByText('Could not copy the report')).toBeInTheDocument()
  })

  it('runs palette actions: environment, reset and analyze', async () => {
    await renderApp()
    fireEvent.change(editor(), { target: { value: '{"orderId": "edited"}' } })

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByText('Reset payload'))
    expect(JSON.parse(editor().value)).toHaveProperty('metadata')

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByText('Target staging'))
    expect(screen.getByLabelText('Release target environment')).toHaveValue('staging')

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByText('Analyze compatibility', { selector: 'p' }))
    expect(await screen.findByText('Safe to publish')).toBeInTheDocument()
    expect(eventGateApi.analyzeCompatibility).toHaveBeenCalledWith(expect.objectContaining({ environment: 'staging' }))
  })

  it('changes the proposed version and clears the result', async () => {
    await renderApp()
    await analyzeTo('Safe to publish')
    fireEvent.change(screen.getByLabelText('Proposed version'), { target: { value: '3' } })
    expect(screen.getByText('No analysis yet')).toBeInTheDocument()
    expect(JSON.parse(editor().value).shippingMethod).toEqual({ carrier: 'express', trackingNumber: 'TRK-987' })
  })
})

