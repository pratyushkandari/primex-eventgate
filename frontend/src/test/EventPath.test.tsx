import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EventPath } from '@/components/workspace/EventPath'

describe('EventPath component', () => {
  it('renders idle standby path', () => {
    render(<EventPath decision={null} isPublished={false} />)
    expect(screen.getByText('Event path')).toBeInTheDocument()
    expect(screen.getByText('API Gateway')).toBeInTheDocument()
    expect(screen.getByText('EventGate')).toBeInTheDocument()
    expect(screen.getByText('Awaiting analysis')).toBeInTheDocument()
    expect(screen.getByText('EventBridge')).toBeInTheDocument()
    expect(screen.getByText('Consumers')).toBeInTheDocument()
  })

  it('renders ALLOW progression state', () => {
    render(<EventPath decision="ALLOW" isPublished={false} />)
    expect(screen.getByText('decision: ALLOW')).toBeInTheDocument()
  })

  it('renders BLOCK interception state with halted traffic indicator', () => {
    render(<EventPath decision="BLOCK" isPublished={false} />)
    expect(screen.getByText('decision: BLOCK')).toBeInTheDocument()
    expect(screen.getByText('PREVENTED')).toBeInTheDocument()
    expect(screen.getByText('NOT CALLED')).toBeInTheDocument()
    expect(screen.getAllByText('NOT REACHED').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('⊘').length).toBeGreaterThan(0)
  })

  it('renders published fan-out delivery to consumers', () => {
    render(<EventPath decision="ALLOW" isPublished={true} />)
    expect(screen.getByText('Delivered to bus')).toBeInTheDocument()
    expect(screen.getByText('DELIVERED')).toBeInTheDocument()
  })
})
