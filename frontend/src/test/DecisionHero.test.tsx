import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DecisionHero } from '@/components/workspace/DecisionHero'
import type { AnalysisResponse } from '@/types/api'

describe('DecisionHero component', () => {
  const createMockAnalysis = (decision: 'ALLOW' | 'BLOCK' | 'REVIEW', severity: 'LOW' | 'HIGH' | 'MEDIUM'): AnalysisResponse => ({
    analysisId: 'test-an-id',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 2,
    decision,
    severity,
    summary: `Summary for ${decision}`,
    timestamp: '2026-09-18T00:00:00Z',
    requestId: 'req-1',
    findings: [],
    changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
  })

  it('renders Ready to Analyze in initial idle state', () => {
    render(<DecisionHero analysis={null} isAnalyzing={false} isPublishing={false} onPublish={vi.fn()} />)
    expect(screen.getByText('Ready to Analyze')).toBeInTheDocument()
  })

  it('renders loading state when isAnalyzing is true', () => {
    render(<DecisionHero analysis={null} isAnalyzing={true} isPublishing={false} onPublish={vi.fn()} />)
    expect(screen.getByText('Analyzing Compatibility')).toBeInTheDocument()
  })

  it('renders ALLOW state with active Publish button', () => {
    const handlePublish = vi.fn()
    const analysis = createMockAnalysis('ALLOW', 'LOW')
    render(
      <DecisionHero
        analysis={analysis}
        isAnalyzing={false}
        isPublishing={false}
        onPublish={handlePublish}
      />
    )

    expect(screen.getAllByText('ALLOW').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Safe to Publish')).toBeInTheDocument()
    expect(screen.getByText('SEVERITY: LOW')).toBeInTheDocument()

    const publishBtn = screen.getByRole('button', { name: /Publish Event to EventBridge/i })
    expect(publishBtn).toBeEnabled()
    fireEvent.click(publishBtn)
    expect(handlePublish).toHaveBeenCalledTimes(1)
  })

  it('renders BLOCK state with disabled publish button and prevented warning', () => {
    const handlePublish = vi.fn()
    const analysis = createMockAnalysis('BLOCK', 'HIGH')
    render(
      <DecisionHero
        analysis={analysis}
        isAnalyzing={false}
        isPublishing={false}
        onPublish={handlePublish}
      />
    )

    expect(screen.getAllByText('BLOCK').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Breaking Change Intercepted')).toBeInTheDocument()
    expect(screen.getByText('SEVERITY: HIGH')).toBeInTheDocument()
    expect(screen.getByText('EventBridge publication is prevented.')).toBeInTheDocument()

    const publishBtn = screen.getByRole('button', { name: /Publication Prevented by Gate/i })
    expect(publishBtn).toBeDisabled()
  })

  it('renders REVIEW state with disabled publish button', () => {
    const handlePublish = vi.fn()
    const analysis = createMockAnalysis('REVIEW', 'MEDIUM')
    render(
      <DecisionHero
        analysis={analysis}
        isAnalyzing={false}
        isPublishing={false}
        onPublish={handlePublish}
      />
    )

    expect(screen.getAllByText('REVIEW').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Review Required')).toBeInTheDocument()
    expect(screen.getByText('SEVERITY: MEDIUM')).toBeInTheDocument()
    expect(screen.getByText('Publication prevented pending future review.')).toBeInTheDocument()

    const publishBtn = screen.getByRole('button', { name: /Publication Prevented by Gate/i })
    expect(publishBtn).toBeDisabled()
  })

  it('renders Invalid Payload state when hasJsonError is true with disabled publish button', () => {
    render(
      <DecisionHero
        analysis={null}
        isAnalyzing={false}
        isPublishing={false}
        hasJsonError={true}
        onPublish={vi.fn()}
      />
    )

    expect(screen.getByText('Invalid Payload')).toBeInTheDocument()
    expect(screen.getByText('Fix JSON syntax to analyze.')).toBeInTheDocument()
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument()

    const publishBtn = screen.getByRole('button', { name: /Fix invalid JSON before publishing/i })
    expect(publishBtn).toBeDisabled()
  })
})
