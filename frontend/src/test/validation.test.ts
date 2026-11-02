import { describe, expect, it } from 'vitest'
import {
  AnalysisResponseSchema,
  PublishResponseSchema,
  ReleaseRecordSchema,
  RuntimeConfigResponseSchema,
  validateResponse,
} from '@/schemas/api'
import { analysis, publishResponse, record, runtimeConfig } from './fixtures'

describe('response schemas', () => {
  it('accepts a full analysis response', () => {
    expect(validateResponse(AnalysisResponseSchema, analysis('BLOCK'), 'analysis').decision).toBe('BLOCK')
  })

  it('names the missing fields when an analysis is incomplete', () => {
    const { findings: _unused, ...partial } = analysis('ALLOW')
    expect(() => validateResponse(AnalysisResponseSchema, partial, 'analysis')).toThrow(/findings/)
  })

  it('fills absent finding types with null', () => {
    const raw = analysis('ALLOW')
    const finding: Record<string, unknown> = { ...raw.findings[0] }
    delete finding.expectedType
    const parsed = validateResponse(AnalysisResponseSchema, { ...raw, findings: [finding] }, 'analysis')
    expect(parsed.findings[0].expectedType).toBeNull()
  })

  it('accepts publish responses without a bus event ID', () => {
    expect(PublishResponseSchema.safeParse(publishResponse({ eventBridgeEventId: null })).success).toBe(true)
  })

  it('keeps history readable when an old record has a non-standard environment', () => {
    // Regression: one record with environment "Prod" used to fail the whole list.
    expect(ReleaseRecordSchema.safeParse(record({ environment: 'Prod' })).success).toBe(true)
  })

  it('rejects an unknown decision value', () => {
    expect(ReleaseRecordSchema.safeParse({ ...record(), decision: 'MAYBE' }).success).toBe(false)
  })

  it('accepts the runtime configuration shape', () => {
    expect(RuntimeConfigResponseSchema.safeParse(runtimeConfig).success).toBe(true)
    expect(RuntimeConfigResponseSchema.safeParse({ ...runtimeConfig, eventBridgeBus: 'bus' }).success).toBe(true)
  })
})
