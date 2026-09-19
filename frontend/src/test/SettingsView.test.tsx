import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsView } from '@/components/settings/SettingsView'
import * as queries from '@/services/queries'

vi.mock('@/services/queries', () => ({
  useRuntimeConfig: vi.fn(),
}))

describe('SettingsView component', () => {
  it('renders explicit RUNTIME CONFIGURATION heading and actual platform settings without fake telemetry', () => {
    vi.mocked(queries.useRuntimeConfig).mockReturnValue({
      data: {
        environment: 'production',
        storageBackend: 'Amazon DynamoDB (Single-Table Indexed Access)',
        storageBackendType: 'dynamodb',
        publisherBackend: 'Amazon EventBridge (Production Bus Ingestion)',
        publisherBackendType: 'eventbridge',
        awsRegion: 'ap-south-1',
        eventBridgeBus: 'primex-eventgate-dev-bus',
        policyEngine: 'Standard Deterministic Engine',
        policyEngineType: 'standard',
        contractsDirectory: 'C:/primex-eventgate/contracts',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof queries.useRuntimeConfig>)

    render(<SettingsView />)

    // Per Section 28: Settings page must say: RUNTIME CONFIGURATION (Not telemetry)
    expect(screen.getByText('RUNTIME CONFIGURATION')).toBeInTheDocument()
    expect(screen.queryByText(/telemetry/i)).not.toBeInTheDocument()

    // Assert actual values
    expect(screen.getByText('Target Environment')).toBeInTheDocument()
    expect(screen.getByText('Amazon DynamoDB (Single-Table Indexed Access)')).toBeInTheDocument()
    expect(screen.getByText('Amazon EventBridge (Production Bus Ingestion)')).toBeInTheDocument()
    expect(screen.getAllByText('ap-south-1').length).toBeGreaterThan(0)
    expect(screen.getByText('primex-eventgate-dev-bus')).toBeInTheDocument()
    expect(screen.getByText('Standard Deterministic Engine')).toBeInTheDocument()
    expect(screen.getByText('C:/primex-eventgate/contracts')).toBeInTheDocument()
  })

  it('renders loading indicator when config is loading', () => {
    vi.mocked(queries.useRuntimeConfig).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof queries.useRuntimeConfig>)

    render(<SettingsView />)
    expect(screen.getByText(/Inspecting runtime configuration/)).toBeInTheDocument()
  })
})
