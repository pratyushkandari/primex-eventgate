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
    expect(screen.getByText('Traffic halted')).toBeInTheDocument()
    expect(screen.getByText('Zero propagation')).toBeInTheDocument()
    expect(screen.getByText('✕')).toBeInTheDocument()
  })

  it('renders published fan-out delivery to consumers', () => {
    render(<EventPath decision="ALLOW" isPublished={true} />)
    expect(screen.getByText('Ingested to bus')).toBeInTheDocument()
    expect(screen.getByText('DELIVERED')).toBeInTheDocument()
  })
})
