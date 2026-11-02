import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReviewContextBar } from '@/components/workspace/ReviewContextBar'
import { consumerImpacts } from '@/lib/findings'
import { analysis, finding } from './fixtures'

describe('ReviewContextBar', () => {
  it('summarizes per consumer, not per finding', () => {
    const a = analysis('BLOCK', {
      findings: [
        finding({ consumerId: 'inventory-service', status: 'BREAK', field: 'a' }),
        finding({ consumerId: 'inventory-service', status: 'BREAK', field: 'b' }),
        finding({ consumerId: 'billing-service' }),
      ],
    })
    render(
      <ReviewContextBar
        analysis={a}
        impacts={consumerImpacts([], a.findings)}
        onSelectConsumer={vi.fn()}
        onExportReport={vi.fn()}
      />
    )
    expect(screen.getByText(/1 safe · 0 at risk · 1 broken/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1 safe, 0 at risk, 1 broken' })).toBeInTheDocument()
  })

  it('links to the first affected consumer and opens the export dialog', () => {
    const onSelect = vi.fn()
    const onExport = vi.fn()
    const a = analysis('REVIEW')
    render(<ReviewContextBar analysis={a} impacts={consumerImpacts([], a.findings)} onSelectConsumer={onSelect} onExportReport={onExport} />)
    fireEvent.click(screen.getByRole('button', { name: 'analytics-service' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export report' }))
    expect(onSelect).toHaveBeenCalledWith('analytics-service')
    expect(onExport).toHaveBeenCalled()
  })
})
