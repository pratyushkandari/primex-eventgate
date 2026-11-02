import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeError, eventGateApi } from '@/services/api'
import { API_CONFIG } from '@/config/env'
import { EventGateApiError } from '@/types/api'
import { analysis, publishResponse, record } from './fixtures'

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('eventGateApi', () => {
  it('posts analysis requests as JSON to the configured base URL', async () => {
    globalThis.fetch = respond(200, analysis('ALLOW'))

    const result = await eventGateApi.analyzeCompatibility({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 2,
      environment: 'staging',
    })

    expect(result.decision).toBe('ALLOW')
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(url).toBe(`${API_CONFIG.baseUrl}/api/v1/analyze`)
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toMatchObject({ environment: 'staging' })
  })

  it('treats a 409 from publish as a normal BLOCK/REVIEW result', async () => {
    globalThis.fetch = respond(409, publishResponse({ published: false, decision: 'BLOCK', eventBridgeEventId: null }))
    const result = await eventGateApi.publishEvent({
      eventType: 'OrderPlaced',
      currentVersion: 1,
      proposedVersion: 3,
      payload: {},
    })
    expect(result.published).toBe(false)
    expect(result.decision).toBe('BLOCK')
  })

  it('does not accept 409 from other endpoints', async () => {
    globalThis.fetch = respond(409, { error: { code: 'CONFLICT', message: 'nope' } })
    await expect(eventGateApi.listEventCatalog()).rejects.toBeInstanceOf(EventGateApiError)
  })

  it('maps the error envelope into EventGateApiError', async () => {
    globalThis.fetch = respond(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request. environment: Input should be ...',
        requestId: 'req-9',
        details: [{ field: 'environment', message: 'Input should be ...' }],
      },
    })
    const err = await eventGateApi
      .analyzeCompatibility({ eventType: 'OrderPlaced', currentVersion: 1, proposedVersion: 2 })
      .catch((e) => e)
    expect(err).toBeInstanceOf(EventGateApiError)
    expect(err.statusCode).toBe(422)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.requestId).toBe('req-9')
    expect(err.details).toHaveLength(1)
  })

  it('falls back to a status message when the error body is not JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)
    await expect(eventGateApi.checkHealth()).rejects.toMatchObject({ code: 'HTTP_502', statusCode: 502 })
  })

  it('reports network failures with the API address', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await eventGateApi.checkHealth().catch((e) => e)
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.statusCode).toBe(0)
    expect(err.message).toContain(API_CONFIG.baseUrl)
  })

  it('rejects responses that do not match the expected shape', async () => {
    globalThis.fetch = respond(200, { analysisId: 'x' })
    await expect(
      eventGateApi.analyzeCompatibility({ eventType: 'OrderPlaced', currentVersion: 1, proposedVersion: 2 })
    ).rejects.toThrow(/Unexpected analysis response/)
  })

  it('requests reports for stored records by ID and format', async () => {
    globalThis.fetch = respond(200, { recordId: 'an-1', format: 'json', content: '{}' })
    await eventGateApi.getReport('an 1', 'json')
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe(
      `${API_CONFIG.baseUrl}/api/v1/history/an%201/report?format=json`
    )
  })

  it('lists history with a limit and optional event filter', async () => {
    globalThis.fetch = respond(200, [record()])
    await eventGateApi.listHistory('OrderPlaced', 20)
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe(
      `${API_CONFIG.baseUrl}/api/v1/history?limit=20&eventType=OrderPlaced`
    )
  })

  it.each([
    ['getEventDetail', 'Order Placed', '/api/v1/contracts/events/Order%20Placed'],
    ['getConsumerDetail', 'billing/service', '/api/v1/contracts/consumers/billing%2Fservice'],
  ] as const)('%s encodes path parameters', async (method, arg, path) => {
    globalThis.fetch = respond(200, {})
    await eventGateApi[method](arg).catch(() => undefined)
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe(`${API_CONFIG.baseUrl}${path}`)
  })
})

describe('describeError', () => {
  it('uses the error message, with a generic fallback', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
    expect(describeError('weird')).toMatch(/Something went wrong/)
  })
})
