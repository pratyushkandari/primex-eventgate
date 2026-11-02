import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DecisionHero } from '@/components/workspace/DecisionHero'
import { analysis } from './fixtures'

const base = { isAnalyzing: false, isPublishing: false, onPublish: vi.fn(), destination: 'the local in-memory publisher' }

describe('DecisionHero', () => {
  it('explains what to do before any analysis and keeps publishing disabled', () => {
    render(<DecisionHero {...base} analysis={null} />)
    expect(screen.getByText('No analysis yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish event' })).toBeDisabled()
  })

  it('asks for a JSON fix first when the payload is invalid', () => {
    render(<DecisionHero {...base} analysis={null} hasJsonError />)
    expect(screen.getByText(/Fix the payload JSON/)).toBeInTheDocument()
  })

  it('shows a loading state while analyzing', () => {
    render(<DecisionHero {...base} analysis={null} isAnalyzing />)
    expect(screen.getByRole('status', { name: 'Analyzing compatibility' })).toBeInTheDocument()
  })

  it('enables publishing on ALLOW and names the destination', () => {
    const onPublish = vi.fn()
    render(<DecisionHero {...base} onPublish={onPublish} analysis={analysis('ALLOW')} />)
    expect(screen.getByText('Safe to publish')).toBeInTheDocument()
    expect(screen.getByText('Sends to the local in-memory publisher')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Publish event' }))
    expect(onPublish).toHaveBeenCalled()
  })

  it('blocks publishing on BLOCK and names the broken consumer field', () => {
    render(<DecisionHero {...base} analysis={analysis('BLOCK')} />)
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('inventory-service')).toBeInTheDocument()
    expect(screen.getByText(/string → object/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publishing not allowed' })).toBeDisabled()
    expect(screen.getByText(/HTTP 409 for BLOCK/)).toBeInTheDocument()
  })

  it('holds REVIEW and shows the policy reason and warnings', () => {
    render(
      <DecisionHero
        {...base}
        analysis={analysis('REVIEW', { warnings: ['Review downstream impacts before promoting.'] })}
      />
    )
    expect(screen.getByText('Held for review')).toBeInTheDocument()
    expect(screen.getByText(/requires manual engineering review/)).toBeInTheDocument()
    expect(screen.getByText('Review downstream impacts before promoting.')).toBeInTheDocument()
  })

  it('disables publishing while a publish is in flight', () => {
    render(<DecisionHero {...base} isPublishing analysis={analysis('ALLOW')} />)
    expect(screen.getByRole('button', { name: 'Publish event' })).toBeDisabled()
  })
})
