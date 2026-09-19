import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Header } from '@/components/layout/Header'
import { eventGateApi } from '@/services/api'

vi.mock('@/services/api', () => ({
  eventGateApi: {
    checkHealth: vi.fn(),
  },
}))

describe('Header component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders branding and displays API ONLINE on health success', async () => {
    vi.mocked(eventGateApi.checkHealth).mockResolvedValue({
      status: 'ok',
      service: 'eventgate',
      version: '0.1.0',
    })

    render(<Header />)

    expect(screen.getByText('EventGate')).toBeInTheDocument()
    expect(screen.getByText('Event compatibility and release gating')).toBeInTheDocument()
    expect(screen.getByText(/Connecting.../i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('API ONLINE')).toBeInTheDocument()
    })
    expect(screen.queryByText('v0.1.0')).not.toBeInTheDocument()
  })

  it('displays API OFFLINE when health check fails', async () => {
    vi.mocked(eventGateApi.checkHealth).mockRejectedValue(new Error('Connection refused'))

    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText('API OFFLINE')).toBeInTheDocument()
    })
  })

  it('allows clicking health badge to re-verify status', async () => {
    vi.mocked(eventGateApi.checkHealth).mockResolvedValueOnce({
      status: 'ok',
      service: 'eventgate',
      version: '0.1.0',
    })

    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText('API ONLINE')).toBeInTheDocument()
    })

    vi.mocked(eventGateApi.checkHealth).mockResolvedValueOnce({
      status: 'ok',
      service: 'eventgate',
      version: '0.1.0',
    })

    const healthBtn = screen.getByTitle(/Click to re-verify live backend health/i)
    fireEvent.click(healthBtn)

    await waitFor(() => {
      expect(eventGateApi.checkHealth).toHaveBeenCalledTimes(2)
    })
  })

  it('renders environment selector with default production and allows changing environment', async () => {
    vi.mocked(eventGateApi.checkHealth).mockResolvedValue({
      status: 'ok',
      service: 'eventgate',
      version: '0.1.0',
    })

    const onEnvChange = vi.fn()
    render(<Header environment="production" onEnvironmentChange={onEnvChange} />)

    await waitFor(() => {
      expect(screen.getByText('API ONLINE')).toBeInTheDocument()
    })

    const envBtn = screen.getByLabelText(/Target Environment: production/i)
    expect(envBtn).toBeInTheDocument()

    // Open dropdown menu
    fireEvent.click(envBtn)

    // Select staging environment
    const stagingOption = screen.getByRole('menuitem', { name: /staging/i })
    fireEvent.click(stagingOption)

    expect(onEnvChange).toHaveBeenCalledWith('staging')
  })
})
