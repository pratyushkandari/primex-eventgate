import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eventGateApi } from '@/services/api'
import { EventGateApiError } from '@/types/api'

describe('eventGateApi service', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('checkHealth returns operational service information', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', service: 'eventgate', version: '0.1.0' }),
    } as Response)

    const res = await eventGateApi.checkHealth()
    expect(res.status).toBe('ok')
    expect(res.service).toBe('eventgate')
    expect(res.version).toBe('0.1.0')
  })

  it('analyzeCompatibility sends POST request with correct payload', async () => {
    const mockResponse = {
      analysisId: 'test-analysis-123',
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      decision: 'ALLOW',
      severity: 'LOW',
      findings: [],
      changeSet: { addedFields: ['metadata'], removedFields: [], typeChanges: [], requirednessChanges: [] },
      summary: 'All consumers are safe',
      timestamp: '2026-09-18T00:00:00Z',
      requestId: 'test-req-id',
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const result = await eventGateApi.analyzeCompatibility({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
    })

    expect(result.decision).toBe('ALLOW')
    expect(result.analysisId).toBe('test-analysis-123')
  })

  it('publishEvent handles HTTP 409 Conflict as valid domain PublishResponse', async () => {
    const mockBlockResponse = {
      eventId: 'evt-block-123',
      published: false,
      decision: 'BLOCK',
      severity: 'HIGH',
      eventBridgeEventId: null,
      analysis: {
        analysisId: 'an-block-123',
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 3,
        decision: 'BLOCK',
        severity: 'HIGH',
        findings: [],
        changeSet: { addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] },
        summary: 'Publication blocked',
        timestamp: '2026-09-18T00:00:00Z',
        requestId: 'req-block-123',
      },
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => mockBlockResponse,
    } as Response)

    const result = await eventGateApi.publishEvent({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      payload: { orderId: 'O1' },
    })

    expect(result.published).toBe(false)
    expect(result.decision).toBe('BLOCK')
    expect(result.eventBridgeEventId).toBeNull()
  })

  it('throws EventGateApiError on HTTP 422 Invalid Payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: {
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'Missing required field: orderId',
          requestId: 'test-req-422',
        },
      }),
    } as Response)

    await expect(
      eventGateApi.publishEvent({
        eventType: 'OrderPlaced',
        currentVersion: 1,
        proposedVersion: 2,
        payload: {},
      })
    ).rejects.toThrow(EventGateApiError)
  })

  it('throws EventGateApiError with NETWORK_ERROR on connection failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    try {
      await eventGateApi.checkHealth()
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(EventGateApiError)
      if (err instanceof EventGateApiError) {
        expect(err.code).toBe('NETWORK_ERROR')
      }
    }
  })
})
