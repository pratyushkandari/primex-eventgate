import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PoliciesView } from '@/components/policies/PoliciesView'
import * as queries from '@/services/queries'

vi.mock('@/services/queries', () => ({
  usePolicies: vi.fn(),
}))

describe('PoliciesView component', () => {
  it('renders environment release policy matrix and Cedar code block', () => {
    vi.mocked(queries.usePolicies).mockReturnValue({
      data: {
        activeEngine: 'standard',
        engineName: 'Standard Deterministic Engine',
        description: 'Deterministic pure policy engine evaluating 3x3 matrix',
        matrix: [
          { environment: 'production', low: 'ALLOW', medium: 'REVIEW', high: 'BLOCK' },
          { environment: 'staging', low: 'ALLOW', medium: 'REVIEW', high: 'BLOCK' },
          {
            environment: 'development',
            low: 'ALLOW',
            medium: 'ALLOW with warning',
            high: 'BLOCK',
          },
        ],
        cedarPolicyAvailable: true,
        cedarPolicyText: '@id("PROD_BLOCK_BREAK")\nforbid ( principal, action == Action::"Release", resource );',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof queries.usePolicies>)

    render(<PoliciesView />)

    expect(screen.getByText('Release Policies')).toBeInTheDocument()
    expect(screen.getAllByText('Standard Deterministic Engine').length).toBeGreaterThan(0)
    expect(screen.getByText('Environment Release Policy Matrix')).toBeInTheDocument()

    // Assert environment rows
    expect(screen.getByText('production')).toBeInTheDocument()
    expect(screen.getByText('staging')).toBeInTheDocument()
    expect(screen.getByText('development')).toBeInTheDocument()

    // Assert Cedar policy code view
    expect(screen.getByText('Cedar Language Policy Specification')).toBeInTheDocument()
    expect(screen.getByText(/PROD_BLOCK_BREAK/)).toBeInTheDocument()
  })

  it('renders loading state when query is active', () => {
    vi.mocked(queries.usePolicies).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof queries.usePolicies>)

    render(<PoliciesView />)
    expect(screen.getByText(/Loading authoritative release policies/)).toBeInTheDocument()
  })
})
