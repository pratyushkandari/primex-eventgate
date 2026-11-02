import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConsumerImpactPanel } from '@/components/workspace/ConsumerImpactPanel'
import { consumerImpacts } from '@/lib/findings'
import { analysis } from './fixtures'

const ids = ['analytics-service', 'billing-service', 'inventory-service']

describe('ConsumerImpactPanel', () => {
  it('lists registered consumers before analysis', () => {
    render(<ConsumerImpactPanel impacts={consumerImpacts(ids, [])} hasAnalysis={false} onSelectConsumer={vi.fn()} />)
    expect(screen.getByText('3 registered consumers')).toBeInTheDocument()
    expect(screen.getAllByText('Not analyzed yet')).toHaveLength(3)
  })

  it('marks the broken consumer and filters to affected ones', () => {
    render(
      <ConsumerImpactPanel
        impacts={consumerImpacts(ids, analysis('BLOCK').findings)}
        hasAnalysis
        onSelectConsumer={vi.fn()}
      />
    )
    expect(screen.getByText('1 of 3 consumers affected')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: /inventory-service/ })
    expect(within(row).getByText('BREAK')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Affected 1' }))
    expect(screen.queryByRole('button', { name: /billing-service/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Safe 2' }))
    expect(screen.queryByRole('button', { name: /inventory-service/ })).toBeNull()
  })

  it('opens a consumer from its row', () => {
    const onSelect = vi.fn()
    render(<ConsumerImpactPanel impacts={consumerImpacts(ids, analysis('REVIEW').findings)} hasAnalysis onSelectConsumer={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /analytics-service/ }))
    expect(onSelect).toHaveBeenCalledWith('analytics-service')
  })

  it('explains the REVIEW outcome when nothing subscribes', () => {
    render(<ConsumerImpactPanel impacts={[]} hasAnalysis={false} onSelectConsumer={vi.fn()} />)
    expect(screen.getByText('No registered consumers')).toBeInTheDocument()
  })
})
