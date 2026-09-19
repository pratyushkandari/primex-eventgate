import { describe, it, expect } from 'vitest'
import {
  AnalysisResponseSchema,
  PublishResponseSchema,
  ReleaseRecordSchema,
  RuntimeConfigResponseSchema,
  validateResponse,
} from '@/schemas/api'

describe('API Zod Schemas & Validation', () => {
  it('validates a valid AnalysisResponse structure', () => {
    const validAnalysis = {
      analysisId: 'an-val-1',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      environment: 'production',
      compatibilityResult: 'SAFE',
      policyName: 'Production Policy',
      policyReason: 'All consumers compatible',
      changeSet: {
        addedFields: ['loyaltyTier'],
        removedFields: [],
        typeChanges: [],
        requirednessChanges: [],
      },
      findings: [
        {
          consumerId: 'billing-service',
          status: 'SAFE',
          ruleId: 'EVT008',
          field: 'loyaltyTier',
          expectedType: null,
          proposedType: 'string',
          severity: 'LOW',
          reason: 'Optional field added',
        },
      ],
      decision: 'ALLOW',
      severity: 'LOW',
      summary: 'Safe addition of optional field',
      timestamp: '2026-09-19T00:00:00Z',
      requestId: 'req-val-1',
    }

    const validated = validateResponse(AnalysisResponseSchema, validAnalysis, 'Analysis')
    expect(validated.analysisId).toBe('an-val-1')
    expect(validated.decision).toBe('ALLOW')
  })

  it('rejects an invalid AnalysisResponse missing required fields', () => {
    const invalidAnalysis = {
      // missing analysisId, eventType, etc.
      decision: 'UNKNOWN_DECISION',
    }

    expect(() => {
      validateResponse(AnalysisResponseSchema, invalidAnalysis, 'Analysis')
    }).toThrow(/Invalid Analysis response structure from EventGate API/i)
  })

  it('validates a valid PublishResponse', () => {
    const validPublish = {
      eventId: 'evt-val-101',
      published: true,
      decision: 'ALLOW',
      severity: 'LOW',
      eventBridgeEventId: 'eb-val-202',
      analysis: {
        analysisId: 'an-val-1',
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 2,
        changeSet: {
          addedFields: [],
          removedFields: [],
          typeChanges: [],
          requirednessChanges: [],
        },
        findings: [],
        decision: 'ALLOW',
        severity: 'LOW',
        summary: 'Safe',
        timestamp: '2026-09-19T00:00:00Z',
      },
    }

    const validated = validateResponse(PublishResponseSchema, validPublish, 'Publish')
    expect(validated.eventId).toBe('evt-val-101')
    expect(validated.published).toBe(true)
  })

  it('validates a valid ReleaseRecord structure', () => {
    const validRecord = {
      recordId: 'rec-1',
      analysisId: 'an-1',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      environment: 'production',
      compatibilityResult: 'BREAK',
      severity: 'HIGH',
      policyName: 'Production Gating Policy',
      policyReason: 'Breaking changes blocked in production',
      decision: 'BLOCK',
      affectedConsumers: ['inventory-service'],
      findingsSummary: [],
      published: false,
      attemptedPublish: true,
      timestamp: '2026-09-19T00:00:00Z',
    }

    const validated = validateResponse(ReleaseRecordSchema, validRecord, 'ReleaseRecord')
    expect(validated.recordId).toBe('rec-1')
    expect(validated.decision).toBe('BLOCK')
  })

  it('validates RuntimeConfigResponse', () => {
    const validConfig = {
      environment: 'production',
      storageBackend: 'DynamoDB',
      storageBackendType: 'dynamodb',
      publisherBackend: 'Amazon EventBridge',
      publisherBackendType: 'eventbridge',
      awsRegion: 'ap-south-1',
      eventBridgeBus: 'primex-eventgate-dev-bus',
      policyEngine: 'Standard Deterministic Engine',
      policyEngineType: 'standard',
      contractsDirectory: 'contracts',
    }

    const validated = validateResponse(RuntimeConfigResponseSchema, validConfig, 'RuntimeConfig')
    expect(validated.awsRegion).toBe('ap-south-1')
  })
})
