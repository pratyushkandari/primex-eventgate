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

  it('renders branding and displays API Live on health success', async () => {
    vi.mocked(eventGateApi.checkHealth).mockResolvedValue({
      status: 'ok',
      service: 'eventgate',
      version: '0.1.0',
    })

    render(<Header />)

    expect(screen.getByText('PrimeX EventGate')).toBeInTheDocument()
    expect(screen.getByText(/Connecting.../i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('API Live')).toBeInTheDocument()
      expect(screen.getByText('v0.1.0')).toBeInTheDocument()
    })
  })

  it('displays Offline when health check fails', async () => {
    vi.mocked(eventGateApi.checkHealth).mockRejectedValue(new Error('Connection refused'))

    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument()
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
      expect(screen.getByText('API Live')).toBeInTheDocument()
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
})
