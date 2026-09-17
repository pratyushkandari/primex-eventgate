import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PublishResultPanel } from '@/components/workspace/PublishResultPanel'
import type { PublishResponse } from '@/types/api'

describe('PublishResultPanel component', () => {
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
