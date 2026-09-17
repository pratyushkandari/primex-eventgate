/**
 * EventGate API client service.
 * Connects to the AWS Lambda / API Gateway backend.
 */

import { API_CONFIG } from '@/config/env'
import {
  type AnalysisRequest,
  type AnalysisResponse,
  EventGateApiError,
  type HealthResponse,
  type PublishRequest,
  type PublishResponse,
} from '@/types/api'

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
    return request<HealthResponse>('/health', { method: 'GET' })
  },

  /**
   * Advisory schema compatibility analysis. Does NOT publish to EventBridge.
   */
  async analyzeCompatibility(req: AnalysisRequest): Promise<AnalysisResponse> {
    return request<AnalysisResponse>('/api/v1/analyze', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  /**
   * Evaluates payload schema, executes consumer analysis, and publishes to EventBridge if ALLOW.
   * Returns PublishResponse even on 409 (BLOCK/REVIEW domain outcomes).
   */
  async publishEvent(req: PublishRequest): Promise<PublishResponse> {
    return request<PublishResponse>(
      '/api/v1/events/publish',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      true // allow409AsJson
    )
  },
}
