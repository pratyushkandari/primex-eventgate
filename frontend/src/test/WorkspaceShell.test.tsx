import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'

// Mock the API service so Header doesn't perform real network calls during testing
vi.mock('@/services/api', () => ({
  eventGateApi: {
    checkHealth: vi.fn().mockResolvedValue({ status: 'ok', service: 'eventgate', version: '0.1.0' }),
  },
}))

describe('WorkspaceShell component', () => {
  it('renders the header and core sections', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())
    expect(screen.getByText(/PrimeX EventGate/i)).toBeInTheDocument()
    expect(screen.getByText(/Interactive Demo Scenarios/i)).toBeInTheDocument()
    expect(screen.getByText(/Contract & Payload/i)).toBeInTheDocument()
    expect(screen.getByText(/Deterministic Gate/i)).toBeInTheDocument()
    expect(screen.getByText(/Downstream Impact/i)).toBeInTheDocument()
  })

  it('switches between scenarios when demo buttons are clicked', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())

    // Initial state: Safe (ALLOW)
    expect(screen.getByText('ALLOW')).toBeInTheDocument()

    // Click Breaking scenario button
    const breakingBtn = screen.getByRole('button', { name: /2\. BREAKING/i })
    fireEvent.click(breakingBtn)
    expect(screen.getByText('BLOCK')).toBeInTheDocument()
    expect(screen.getByText(/Breaking Change Intercepted/i)).toBeInTheDocument()

    // Click Risk scenario button
    const riskBtn = screen.getByRole('button', { name: /3\. RISK/i })
    fireEvent.click(riskBtn)
    expect(screen.getByText('REVIEW')).toBeInTheDocument()
    expect(screen.getByText(/Review Required/i)).toBeInTheDocument()
  })

  it('displays the three consumer microservices', async () => {
    render(<WorkspaceShell />)
    await waitFor(() => expect(screen.getByText('API Live')).toBeInTheDocument())
    expect(screen.getByText('billing-service')).toBeInTheDocument()
    expect(screen.getByText('inventory-service')).toBeInTheDocument()
    expect(screen.getByText('analytics-service')).toBeInTheDocument()
  })
})
