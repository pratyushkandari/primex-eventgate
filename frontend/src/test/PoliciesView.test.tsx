import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PoliciesView } from '@/components/policies/PoliciesView'
import { SettingsView } from '@/components/settings/SettingsView'
import { eventGateApi } from '@/services/api'
import { mockApi, runtimeConfig } from './fixtures'
import { renderWithProviders } from './render'

vi.mock('@/services/api', async (importOriginal) => {
  const { mockApi } = await import('./fixtures')
  return { ...(await importOriginal<object>()), eventGateApi: mockApi() }
})

const policy = {
  activeEngine: 'standard',
  engineName: 'Standard policy engine',
  description: 'Applies the environment and severity matrix in Python.',
  matrix: [
    { environment: 'production', low: 'ALLOW', medium: 'REVIEW', high: 'BLOCK' },
    { environment: 'development', low: 'ALLOW', medium: 'ALLOW with warning', high: 'BLOCK' },
  ],
  cedarPolicyAvailable: true,
  cedarPolicyText: '@id("PROD_BLOCK_BREAK")\nforbid (principal, action, resource);',
}

describe('PoliciesView', () => {
  beforeEach(() => Object.assign(eventGateApi, mockApi()))

  it('renders the matrix from the API and the Cedar source', async () => {
    vi.mocked(eventGateApi.getPolicies).mockResolvedValue(policy)
    renderWithProviders(<PoliciesView />)
    const table = await screen.findByRole('table', { name: /Release decision by environment/ })
    const dev = within(table).getByRole('rowheader', { name: 'development' }).closest('tr') as HTMLElement
    expect(within(dev).getByText('with warning')).toBeInTheDocument()
    expect(screen.getByText('Active engine: Standard policy engine')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Show policy source'))
    expect(screen.getByText(/PROD_BLOCK_BREAK/)).toBeVisible()
  })

  it('says when the Cedar file is not deployed', async () => {
    vi.mocked(eventGateApi.getPolicies).mockResolvedValue({ ...policy, cedarPolicyAvailable: false, cedarPolicyText: null })
    renderWithProviders(<PoliciesView />)
    expect(await screen.findByText(/not available on this deployment/)).toBeInTheDocument()
  })

  it('shows loading and error states', async () => {
    vi.mocked(eventGateApi.getPolicies).mockRejectedValue(new Error('HTTP 500'))
    renderWithProviders(<PoliciesView />)
    expect(screen.getByRole('status', { name: 'Loading release policy' })).toBeInTheDocument()
    expect(await screen.findByText('Could not load the release policy')).toBeInTheDocument()
  })
})

describe('SettingsView', () => {
  beforeEach(() => Object.assign(eventGateApi, mockApi()))

  it('shows the adapters reported by the API, without the bus row locally', async () => {
    renderWithProviders(<SettingsView />)
    expect(await screen.findByText('Local JSON files')).toBeInTheDocument()
    expect(screen.getByText('In-memory (local)')).toBeInTheDocument()
    expect(screen.queryByText('EventBridge bus')).toBeNull()
    expect(screen.getByText('API base URL')).toBeInTheDocument()
  })

  it('shows the bus on AWS', async () => {
    vi.mocked(eventGateApi.getRuntimeConfig).mockResolvedValue({
      ...runtimeConfig,
      publisherBackend: 'Amazon EventBridge',
      publisherBackendType: 'eventbridge',
      eventBridgeBus: 'primex-eventgate-dev-bus',
    })
    renderWithProviders(<SettingsView />)
    expect(await screen.findByText('primex-eventgate-dev-bus')).toBeInTheDocument()
  })

  it('shows an error with retry', async () => {
    vi.mocked(eventGateApi.getRuntimeConfig).mockRejectedValue(new Error('down'))
    renderWithProviders(<SettingsView />)
    expect(await screen.findByText('Could not load the runtime configuration')).toBeInTheDocument()
  })
})
