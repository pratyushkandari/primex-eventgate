/**
 * TypeScript definitions matching PrimeX EventGate backend schemas.
 */

export type Decision = 'ALLOW' | 'REVIEW' | 'BLOCK'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH'
export type ConsumerStatus = 'SAFE' | 'RISK' | 'BREAK'

export interface HealthResponse {
  status: string
  service: string
  version: string
}

export interface AnalysisRequest {
  eventType: string
  currentVersion: number
  proposedVersion: number
}

export interface TypeChange {
  field: string
  fromType: string
  toType: string
}

export interface RequirednessChange {
  field: string
  fromRequired: boolean
  toRequired: boolean
}

export interface ChangeSet {
  addedFields: string[]
  removedFields: string[]
  typeChanges: TypeChange[]
  requirednessChanges: RequirednessChange[]
}

export interface ConsumerFinding {
  consumerId: string
  status: ConsumerStatus
  ruleId: string
  field: string
  expectedType: string | null
  proposedType: string | null
  severity: Severity
  reason: string
}

export interface AnalysisResponse {
  analysisId: string
  eventType: string
  currentVersion: number
  proposedVersion: number
  changeSet: ChangeSet
  findings: ConsumerFinding[]
  decision: Decision
  severity: Severity
  summary: string
  timestamp: string
  requestId: string
}

export interface PublishRequest {
  eventType: string
  currentVersion: number
  proposedVersion: number
  payload: Record<string, unknown>
}

export interface PublishResponse {
  eventId: string
  published: boolean
  decision: Decision
  severity: Severity
  eventBridgeEventId: string | null
  analysis: AnalysisResponse
}

export interface ApiErrorDetail {
  code: string
  message: string
  details?: unknown
  requestId?: string
}

export interface ApiErrorResponse {
  error: ApiErrorDetail
}

export class EventGateApiError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly requestId?: string
  public readonly details?: unknown

  constructor(statusCode: number, errorDetail: ApiErrorDetail) {
    super(errorDetail.message)
    this.name = 'EventGateApiError'
    this.statusCode = statusCode
    this.code = errorDetail.code
    this.requestId = errorDetail.requestId
    this.details = errorDetail.details
  }
}
