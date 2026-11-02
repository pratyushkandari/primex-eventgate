/**
 * HTTP client for the EventGate API. Every method validates the response body
 * and throws EventGateApiError (with the API's error code and request ID) for
 * non-success responses and network failures.
 */

import { z } from 'zod'
import { API_CONFIG } from '@/config/env'
import {
  type AnalysisRequest,
  type AnalysisResponse,
  type ApiErrorDetail,
  type ConsumerDetail,
  type ConsumerSummary,
  type EventCatalogSummary,
  type EventDetail,
  EventGateApiError,
  type HealthResponse,
  type PolicyInspectionResponse,
  type PublishRequest,
  type PublishResponse,
  type ReleaseRecord,
  type ReportExportResponse,
  type ReportFormat,
  type RuntimeConfigResponse,
} from '@/types/api'
import {
  AnalysisResponseSchema,
  ConsumerDetailSchema,
  ConsumerSummarySchema,
  EventCatalogSummarySchema,
  EventDetailSchema,
  HealthResponseSchema,
  PolicyInspectionResponseSchema,
  PublishResponseSchema,
  ReleaseRecordSchema,
  ReportExportResponseSchema,
  RuntimeConfigResponseSchema,
  validateResponse,
} from '@/schemas/api'

async function readErrorDetail(res: Response): Promise<ApiErrorDetail> {
  const fallback: ApiErrorDetail = {
    code: `HTTP_${res.status}`,
    message: `The API responded with HTTP ${res.status}.`,
  }
  try {
    const body = await res.json()
    if (body?.error?.code && body?.error?.message) return body.error as ApiErrorDetail
  } catch {
    // Non-JSON error body (e.g. an HTML gateway page): keep the fallback.
  }
  return fallback
}

/**
 * Send a request and return the parsed JSON body.
 * `acceptConflict` treats 409 as a normal result; the publish endpoint uses it
 * for BLOCK and REVIEW decisions.
 */
async function request(path: string, init: RequestInit = {}, acceptConflict = false) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${API_CONFIG.baseUrl}${path}`, { ...init, headers })
  } catch {
    throw new EventGateApiError(0, {
      code: 'NETWORK_ERROR',
      message: `Could not reach the EventGate API at ${API_CONFIG.baseUrl}.`,
    })
  }

  if (res.ok || (acceptConflict && res.status === 409)) {
    return res.json() as Promise<unknown>
  }
  throw new EventGateApiError(res.status, await readErrorDetail(res))
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const eventGateApi = {
  async checkHealth(): Promise<HealthResponse> {
    return validateResponse(HealthResponseSchema, await request('/health'), 'health')
  },

  /** Analyze a version change. Does not publish anything. */
  async analyzeCompatibility(req: AnalysisRequest): Promise<AnalysisResponse> {
    const data = await request('/api/v1/analyze', post(req))
    return validateResponse(AnalysisResponseSchema, data, 'analysis')
  },

  /**
   * Run the gate and publish when the decision is ALLOW. BLOCK and REVIEW come
   * back as a normal result with published=false (HTTP 409).
   */
  async publishEvent(req: PublishRequest): Promise<PublishResponse> {
    const data = await request('/api/v1/events/publish', post(req), true)
    return validateResponse(PublishResponseSchema, data, 'publish')
  },

  async listEventCatalog(): Promise<EventCatalogSummary[]> {
    const data = await request('/api/v1/contracts/events')
    return validateResponse(z.array(EventCatalogSummarySchema), data, 'event catalog')
  },

  async getEventDetail(eventType: string): Promise<EventDetail> {
    const data = await request(`/api/v1/contracts/events/${encodeURIComponent(eventType)}`)
    return validateResponse(EventDetailSchema, data, 'event detail')
  },

  async listConsumers(): Promise<ConsumerSummary[]> {
    const data = await request('/api/v1/contracts/consumers')
    return validateResponse(z.array(ConsumerSummarySchema), data, 'consumer catalog')
  },

  async getConsumerDetail(consumerId: string): Promise<ConsumerDetail> {
    const data = await request(`/api/v1/contracts/consumers/${encodeURIComponent(consumerId)}`)
    return validateResponse(ConsumerDetailSchema, data, 'consumer detail')
  },

  // The console loads the newest 100 records (the API allows 1-200, default 50);
  // History shows them 25 at a time. See docs/decisions.md, section 10.
  async listHistory(eventType?: string, limit = 100): Promise<ReleaseRecord[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (eventType) params.set('eventType', eventType)
    const data = await request(`/api/v1/history?${params}`)
    return validateResponse(z.array(ReleaseRecordSchema), data, 'release history')
  },

  /** Render a stored record (by record ID or analysis ID) as Markdown or JSON. */
  async getReport(recordId: string, format: ReportFormat = 'markdown'): Promise<ReportExportResponse> {
    const data = await request(
      `/api/v1/history/${encodeURIComponent(recordId)}/report?format=${format}`
    )
    return validateResponse(ReportExportResponseSchema, data, 'report')
  },

  async getPolicies(): Promise<PolicyInspectionResponse> {
    return validateResponse(
      PolicyInspectionResponseSchema,
      await request('/api/v1/policies'),
      'policy'
    )
  },

  async getRuntimeConfig(): Promise<RuntimeConfigResponse> {
    return validateResponse(
      RuntimeConfigResponseSchema,
      await request('/api/v1/config/runtime'),
      'runtime configuration'
    )
  },
}

/** A message for display: the API's own message, or the error text. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Something went wrong. Try again.'
}
