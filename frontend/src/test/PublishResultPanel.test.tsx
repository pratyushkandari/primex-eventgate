import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PublishResultPanel } from '@/components/workspace/PublishResultPanel'
import { EventPath } from '@/components/workspace/EventPath'
import { publishResponse } from './fixtures'

const destination = 'EventBridge bus primex-eventgate-dev-bus'

describe('PublishResultPanel', () => {
  it('renders nothing before a publish', () => {
    const { container } = render(<PublishResultPanel publishResult={null} publishError={null} destination={destination} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows where the event went and copyable IDs', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<PublishResultPanel publishResult={publishResponse()} publishError={null} destination={destination} />)
    expect(screen.getByText(`Published to ${destination}`)).toBeInTheDocument()
    expect(screen.getByText('evt-123')).toBeInTheDocument()
    expect(screen.getByText('local-eb-abc')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy event id' })))
    expect(writeText).toHaveBeenCalledWith('evt-123')
  })

  it.each([
    [422, 'Payload does not match the proposed contract'],
    [400, 'Publish request rejected'],
    [503, 'Event bus unavailable'],
    [0, 'Publish failed'],
  ])('explains HTTP %s failures with a next step', (status, title) => {
    render(
      <PublishResultPanel
        publishResult={null}
        publishError={{ status, code: 'X', message: 'server message' }}
        destination={destination}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(title)
    expect(screen.getByText('server message')).toBeInTheDocument()
  })
})

describe('EventPath', () => {
  it('waits for analysis', () => {
    render(<EventPath decision={null} isPublished={false} busLabel="in-memory publisher" consumerCount={3} />)
    expect(screen.getByText('Waiting for analysis')).toBeInTheDocument()
  })

  it('shows the event stopping at the gate on BLOCK', () => {
    render(<EventPath decision="BLOCK" isPublished={false} busLabel="bus" consumerCount={3} />)
    expect(screen.getByText(/stopped here \(HTTP 409\)/)).toBeInTheDocument()
    expect(screen.getByText('Not called')).toBeInTheDocument()
    expect(screen.getByText('Not reached')).toBeInTheDocument()
  })

  it('shows delivery after a publish', () => {
    render(<EventPath decision="ALLOW" isPublished busLabel="bus" consumerCount={1} />)
    expect(screen.getByText('Accepted by bus')).toBeInTheDocument()
    expect(screen.getByText('Delivered to 1 subscribed consumer')).toBeInTheDocument()
  })
})
