import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/layout/Header'
import { eventGateApi } from '@/services/api'
import { mockApi } from './fixtures'
import { renderWithProviders } from './render'

vi.mock('@/services/api', async (importOriginal) => {
  const { mockApi } = await import('./fixtures')
  return { ...(await importOriginal<object>()), eventGateApi: mockApi() }
})

function setup() {
  const props = {
    route: 'history' as const,
    onNavigate: vi.fn(),
    environment: 'production' as const,
    onEnvironmentChange: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onOpenHelp: vi.fn(),
  }
  renderWithProviders(<Header {...props} />)
  return props
}

describe('Header', () => {
  beforeEach(() => Object.assign(eventGateApi, mockApi()))

  it('marks the current page and navigates with links', () => {
    const props = setup()
    const current = screen.getAllByRole('link', { name: 'History' })[0]
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current).toHaveAttribute('href', '#/history')
    fireEvent.click(screen.getAllByRole('link', { name: 'Policies' })[0])
    expect(props.onNavigate).toHaveBeenCalledWith('policies')
  })

  it('changes the release target environment', () => {
    const props = setup()
    const select = screen.getByLabelText('Release target environment')
    expect(select).toHaveValue('production')
    fireEvent.change(select, { target: { value: 'development' } })
    expect(props.onEnvironmentChange).toHaveBeenCalledWith('development')
  })

  it('shows the API as online when the health check passes', async () => {
    setup()
    expect((await screen.findAllByText('API online')).length).toBeGreaterThan(0)
  })

  it('shows the API as unreachable and retries on click', async () => {
    vi.mocked(eventGateApi.checkHealth).mockRejectedValue(new Error('down'))
    setup()
    const status = (await screen.findAllByText('API unreachable'))[0].closest('button') as HTMLButtonElement
    vi.mocked(eventGateApi.checkHealth).mockResolvedValue({ status: 'ok', service: 'eventgate', version: '0.1.0' })
    fireEvent.click(status)
    await waitFor(() => expect(screen.getAllByText('API online').length).toBeGreaterThan(0))
  })

  it('opens the command palette and help', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: /Commands/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts and help' }))
    expect(props.onOpenCommandPalette).toHaveBeenCalled()
    expect(props.onOpenHelp).toHaveBeenCalled()
  })
})
