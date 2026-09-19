/**
 * EventGate API client service.
 * Connects to the AWS Lambda / API Gateway backend.
 */

import { API_CONFIG } from '@/config/env'
import {
  type AnalysisRequest,
  type AnalysisResponse,
  type ConsumerDetail,
  type ConsumerSummary,
  type EventCatalogSummary,
  type EventDetail,
  EventGateApiError,
  type HealthResponse,
  type PublishRequest,
  type PublishResponse,
  type ReleaseRecord,
  type ReportExportResponse,
  type PolicyInspectionResponse,
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
import { z } from 'zod'

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  allow409AsJson = false
): Promise<T> {
  const url = `${API_CONFIG.baseUrl}${endpoint}`
  const headers = new Headers(options.headers || {})
  
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers,
    })
  } catch (err) {
    throw new EventGateApiError(0, {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Failed to connect to EventGate API',
    })
  }

  // Handle 409 Conflict as domain result for publishing when requested
  if (res.status === 409 && allow409AsJson) {
    try {
      const data = await res.json()
      // Verify if response body matches PublishResponse shape
      if (data && 'published' in data && 'decision' in data) {
        return data as T
      }
    } catch {
      // Fall through to standard error handling below
    }
  }

  if (!res.ok) {
    let errorDetail = {
      code: `HTTP_${res.status}`,
      message: `Request failed with status ${res.status}`,
    }

    try {
      const errorJson = await res.json()
      if (errorJson?.error) {
        errorDetail = errorJson.error
      } else if (errorJson?.message) {
        errorDetail.message = errorJson.message
      }
    } catch {
      // Ignore JSON parse error, keep fallback status message
    }

    throw new EventGateApiError(res.status, errorDetail)
  }

  return (await res.json()) as T
}

export const eventGateApi = {
  /**
   * Health probe verifying operational connectivity.
   */
  async checkHealth(): Promise<HealthResponse> {
    const data = await request<HealthResponse>('/health', { method: 'GET' })
    return validateResponse(HealthResponseSchema, data, 'Health')
  },

  /**
   * Advisory schema compatibility analysis. Does NOT publish to EventBridge.
   */
  async analyzeCompatibility(req: AnalysisRequest): Promise<AnalysisResponse> {
    const data = await request<AnalysisResponse>('/api/v1/analyze', {
      method: 'POST',
      body: JSON.stringify(req),
    })
    return validateResponse(AnalysisResponseSchema, data, 'Analysis')
  },

  /**
   * Evaluates payload schema, executes consumer analysis, and publishes to EventBridge if ALLOW.
   * Returns PublishResponse even on 409 (BLOCK/REVIEW domain outcomes).
   */
  async publishEvent(req: PublishRequest): Promise<PublishResponse> {
    const data = await request<PublishResponse>(
      '/api/v1/events/publish',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      true // allow409AsJson
    )
    return validateResponse(PublishResponseSchema, data, 'Publish')
  },

  /**
   * Fetch all registered event types in the catalog.
   */
  async listEventCatalog(): Promise<EventCatalogSummary[]> {
    const data = await request<EventCatalogSummary[]>('/api/v1/contracts/events', { method: 'GET' })
    return validateResponse(z.array(EventCatalogSummarySchema), data, 'EventCatalog')
  },

  /**
   * Fetch full contract detail and schemas for an event type.
   */
  async getEventDetail(eventType: string): Promise<EventDetail> {
    const data = await request<EventDetail>(`/api/v1/contracts/events/${encodeURIComponent(eventType)}`, {
      method: 'GET',
    })
    return validateResponse(EventDetailSchema, data, 'EventDetail')
  },

  /**
   * Fetch all registered downstream consumers.
   */
  async listConsumers(): Promise<ConsumerSummary[]> {
    const data = await request<ConsumerSummary[]>('/api/v1/contracts/consumers', { method: 'GET' })
    return validateResponse(z.array(ConsumerSummarySchema), data, 'ConsumerList')
  },

  /**
   * Fetch consumer contract detail by consumer ID.
   */
  async getConsumerDetail(consumerId: string): Promise<ConsumerDetail> {
    const data = await request<ConsumerDetail>(`/api/v1/contracts/consumers/${encodeURIComponent(consumerId)}`, {
      method: 'GET',
    })
    return validateResponse(ConsumerDetailSchema, data, 'ConsumerDetail')
  },

  /**
   * Fetch persistent release review history.
   */
  async listHistory(eventType?: string, limit = 50): Promise<ReleaseRecord[]> {
    const params = new URLSearchParams()
    if (eventType) params.set('eventType', eventType)
    if (limit) params.set('limit', String(limit))
    const qs = params.toString() ? `?${params.toString()}` : ''
    const data = await request<ReleaseRecord[]>(`/api/v1/history${qs}`, { method: 'GET' })
    return validateResponse(z.array(ReleaseRecordSchema), data, 'ReleaseHistory')
  },

  /**
   * Fetch single release review record by record ID or analysis ID.
   */
  async getReview(recordId: string): Promise<ReleaseRecord> {
    const data = await request<ReleaseRecord>(`/api/v1/history/${encodeURIComponent(recordId)}`, {
      method: 'GET',
    })
    return validateResponse(ReleaseRecordSchema, data, 'ReleaseRecord')
  },

  /**
   * Export release report for a historical record.
   */
  async getReport(recordId: string, format = 'markdown'): Promise<ReportExportResponse> {
    const data = await request<ReportExportResponse>(
      `/api/v1/history/${encodeURIComponent(recordId)}/report?format=${encodeURIComponent(format)}`,
      { method: 'GET' }
    )
    return validateResponse(ReportExportResponseSchema, data, 'ReportExport')
  },

  /**
   * Export report directly from an active in-memory review state.
   */
  async exportActiveReport(data: Record<string, unknown>): Promise<ReportExportResponse> {
    const raw = await request<ReportExportResponse>('/api/v1/reports/export', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return validateResponse(ReportExportResponseSchema, raw, 'ActiveReportExport')
  },

  /**
   * Fetch active policy configuration, matrix, and Cedar specifications.
   */
  async getPolicies(): Promise<PolicyInspectionResponse> {
    const data = await request<PolicyInspectionResponse>('/api/v1/policies', { method: 'GET' })
    return validateResponse(PolicyInspectionResponseSchema, data, 'Policies')
  },

  /**
   * Fetch authoritative runtime configuration.
   */
  async getRuntimeConfig(): Promise<RuntimeConfigResponse> {
    const data = await request<RuntimeConfigResponse>('/api/v1/config/runtime', { method: 'GET' })
    return validateResponse(RuntimeConfigResponseSchema, data, 'RuntimeConfig')
  },
}
