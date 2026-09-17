import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '@/components/ui/Badge'

describe('Badge component', () => {
  it('renders badge content', () => {
    render(<Badge>Status</Badge>)
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('applies allow / safe emerald styles', () => {
    render(<Badge variant="allow">ALLOW</Badge>)
    const badge = screen.getByText('ALLOW')
    expect(badge.className).toContain('text-emerald-400')
  })

  it('applies block / break rose styles', () => {
    render(<Badge variant="block">BLOCK</Badge>)
    const badge = screen.getByText('BLOCK')
    expect(badge.className).toContain('text-rose-400')
  })

  it('applies review / risk amber styles', () => {
    render(<Badge variant="review">REVIEW</Badge>)
    const badge = screen.getByText('REVIEW')
    expect(badge.className).toContain('text-amber-400')
  })
})
