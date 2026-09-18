import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublishResultPanel } from '@/components/workspace/PublishResultPanel'
import type { PublishResponse } from '@/types/api'

describe('PublishResultPanel component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders nothing when result and error are null', () => {
    const { container } = render(<PublishResultPanel publishResult={null} publishError={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders successful publication with EventBridge ID', () => {
    const mockPublishResponse: PublishResponse = {
      eventId: 'evt-12345',
      published: true,
      decision: 'ALLOW',
      severity: 'LOW',
      eventBridgeEventId: 'eb-entry-999',
      analysis: {
        analysisId: 'an-1',
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 2,
        decision: 'ALLOW',
        severity: 'LOW',
        summary: 'Safe',
        timestamp: '2026-09-18T00:00:00Z',
        requestId: 'req-trace-101',
        findings: [],
        changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
      },
    }

    render(<PublishResultPanel publishResult={mockPublishResponse} publishError={null} />)

    expect(screen.getByText(/Published to Amazon EventBridge/i)).toBeInTheDocument()
    expect(screen.getByText('evt-12345')).toBeInTheDocument()
    expect(screen.getByText('eb-entry-999')).toBeInTheDocument()
    expect(screen.getByText(/Request ID: req-trace-101/i)).toBeInTheDocument()
    expect(screen.getByText('INGESTED')).toBeInTheDocument()
  })

  it('copies event ID and request ID on button click', async () => {
    const mockPublishResponse: PublishResponse = {
      eventId: 'evt-copy-test-101',
      published: true,
      decision: 'ALLOW',
      severity: 'LOW',
      eventBridgeEventId: 'eb-entry-copy-202',
      analysis: {
        analysisId: 'an-copy-1',
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 2,
        decision: 'ALLOW',
        severity: 'LOW',
        summary: 'Safe',
        timestamp: '2026-09-18T00:00:00Z',
        requestId: 'req-copy-303',
        findings: [],
        changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
      },
    }

    render(<PublishResultPanel publishResult={mockPublishResponse} publishError={null} />)

    const copyEventBtn = screen.getByTitle('Copy event ID')
    fireEvent.click(copyEventBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('evt-copy-test-101')

    const copyEbBtn = screen.getByTitle('Copy EventBridge ID')
    fireEvent.click(copyEbBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('eb-entry-copy-202')

    const copyReqBtn = screen.getByTitle('Copy request ID')
    fireEvent.click(copyReqBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('req-copy-303')

    await waitFor(() => {
      expect(screen.getAllByText('Copied').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders publication error when publishError is present', () => {
    render(
      <PublishResultPanel
        publishResult={null}
        publishError="Invalid Event Payload: Missing required field: orderId"
      />
    )

    expect(screen.getByText(/EventGate Publication Error/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing required field: orderId/i)).toBeInTheDocument()
    expect(screen.getByText('FAILED')).toBeInTheDocument()
  })
})
