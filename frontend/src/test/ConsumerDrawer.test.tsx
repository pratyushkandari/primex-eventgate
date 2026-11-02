import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConsumerDrawer } from '@/components/workspace/ConsumerDrawer'
import { TopologyFallback } from '@/components/workspace/TopologyFallback'
import { DependencyTopology } from '@/components/workspace/DependencyTopology'
import { consumerImpacts } from '@/lib/findings'
import { analysis, orderPlacedDetail } from './fixtures'

const blockImpacts = consumerImpacts([], analysis('BLOCK').findings)
const inventory = blockImpacts.find((i) => i.consumerId === 'inventory-service')!
const inventoryContract = orderPlacedDetail.consumers.find((c) => c.consumerId === 'inventory-service')

describe('ConsumerDrawer', () => {
  it('renders nothing without a consumer', () => {
    render(<ConsumerDrawer impact={null} hasAnalysis onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the findings and the expected fields', () => {
    render(<ConsumerDrawer impact={inventory} contract={inventoryContract} hasAnalysis onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('inventory-service')
    expect(screen.getByText('EVT001_FIELD_TYPE_CHANGED')).toBeInTheDocument()
    expect(screen.getByText(/expects string, proposed object/)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Required' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('asks for an analysis when there is none', () => {
    render(<ConsumerDrawer impact={consumerImpacts(['billing-service'], [])[0]} hasAnalysis={false} onClose={vi.fn()} />)
    expect(screen.getByText(/Run an analysis/)).toBeInTheDocument()
  })

  it('closes from the close button and Escape', () => {
    const onClose = vi.fn()
    render(<ConsumerDrawer impact={inventory} hasAnalysis onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('Topology', () => {
  it('describes the graph in text for screen readers', () => {
    render(<TopologyFallback eventLabel="OrderPlaced v1 → v3" decision="BLOCK" impacts={blockImpacts} hasAnalysis />)
    expect(screen.getByText('EventGate decision: BLOCK.')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toContain(
      "inventory-service: BREAK, field shippingMethod. Inventory Service expects 'shippingMethod' to be string, but the proposed contract defines it as object."
    )
  })

  it('reports consumers as not analyzed before an analysis', () => {
    render(<TopologyFallback eventLabel="x" decision={null} impacts={consumerImpacts(['a'], [])} hasAnalysis={false} />)
    expect(screen.getByText('EventGate decision: not analyzed yet.')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('a: not analyzed')
  })

  it('renders the graph with the text alternative', () => {
    render(
      <DependencyTopology
        eventType="OrderPlaced"
        currentVersion={1}
        proposedVersion={3}
        decision="BLOCK"
        impacts={blockImpacts}
        hasAnalysis
        selectedConsumerId={null}
        onSelectConsumer={vi.fn()}
      />
    )
    expect(screen.getByRole('heading', { name: 'Dependency graph' })).toBeInTheDocument()
    expect(screen.getByText(/the event stops at the gate/)).toBeInTheDocument()
    expect(screen.getByText('Producer: OrderPlaced v1 → v3.')).toBeInTheDocument()
  })
})
