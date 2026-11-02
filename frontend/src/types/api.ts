/**
 * Wire types for the EventGate HTTP API. Field names match the backend's
 * camelCase JSON; runtime validation lives in src/schemas/api.ts.
 */

export type Decision = 'ALLOW' | 'REVIEW' | 'BLOCK'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH'
export type ConsumerStatus = 'SAFE' | 'RISK' | 'BREAK'
export type Environment = 'development' | 'staging' | 'production'

export const ENVIRONMENTS: readonly Environment[] = ['production', 'staging', 'development']

export interface HealthResponse {
  status: string
  service: string
  version: string
}

export interface ChangeRequest {
  eventType: string
  currentVersion: number
  proposedVersion: number
  environment?: Environment
}

export type AnalysisRequest = ChangeRequest

export interface PublishRequest extends ChangeRequest {
  payload: Record<string, unknown>
  analysisId?: string
}

export interface EventCatalogSummary {
  eventType: string
  versionCount: number
  versions: number[]
  latestVersion: number
  consumerCount: number
}

export interface FieldSpec {
  name: string
  type: string
  required: boolean
}

export interface EventContractVersion {
  eventType: string
  version: number
  fields: Record<string, FieldSpec>
}

export interface SubscribedConsumer {
  consumerId: string
  eventType: string
  expectedFields: Record<string, FieldSpec>
}

export interface EventDetail {
  eventType: string
  versionCount: number
  versions: number[]
  latestVersion: number
  contracts: EventContractVersion[]
  consumers: SubscribedConsumer[]
}

export interface ConsumerSummary {
  consumerId: string
  eventType: string
  expectedFieldsCount: number
}

export type ConsumerDetail = SubscribedConsumer

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
  environment: Environment
  compatibilityResult: ConsumerStatus
  policyName: string
  policyReason: string
  warnings: string[]
  changeSet: ChangeSet
  findings: ConsumerFinding[]
  decision: Decision
  severity: Severity
  summary: string
  timestamp: string
  requestId?: string | null
}

export interface PublishResponse {
  eventId: string
  published: boolean
  decision: Decision
  severity: Severity
  eventBridgeEventId: string | null
  analysis: AnalysisResponse
}

export interface ReleaseRecord {
  recordId: string
  analysisId: string
  eventType: string
  currentVersion: number
  proposedVersion: number
  /** Normally an Environment; older records may hold other strings. */
  environment: string
  compatibilityResult: string
  severity: Severity
  policyName: string
  policyReason: string
  decision: Decision
  affectedConsumers: string[]
  findingsSummary: ConsumerFinding[]
  published: boolean
  attemptedPublish: boolean
  eventId?: string | null
  eventBridgeEventId?: string | null
  requestId?: string | null
  timestamp: string
  publishedAt?: string | null
  error?: string | null
}

export type ReportFormat = 'markdown' | 'json'

export interface ReportExportResponse {
  recordId: string
  format: ReportFormat
  content: string
}

export interface PolicyMatrixRow {
  environment: string
  low: string
  medium: string
  high: string
}

export interface PolicyInspectionResponse {
  activeEngine: string
  engineName: string
  description: string
  matrix: PolicyMatrixRow[]
  cedarPolicyAvailable: boolean
  cedarPolicyText?: string | null
}

export interface RuntimeConfigResponse {
  serviceVersion: string
  storageBackend: string
  storageBackendType: string
  contractsSource: string
  historyStore: string
  publisherBackend: string
  publisherBackendType: string
  eventBridgeBus: string | null
  awsRegion: string
  policyEngine: string
  policyEngineType: string
}

export interface ApiErrorDetail {
  code: string
  message: string
  requestId?: string
  details?: Array<{ field: string; message: string }>
}

/** Error raised by the API client for any non-success response or network failure. */
export class EventGateApiError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly requestId?: string
  public readonly details?: ApiErrorDetail['details']

  constructor(statusCode: number, errorDetail: ApiErrorDetail) {
    super(errorDetail.message)
    this.name = 'EventGateApiError'
    this.statusCode = statusCode
    this.code = errorDetail.code
    this.requestId = errorDetail.requestId
    this.details = errorDetail.details
    Object.setPrototypeOf(this, EventGateApiError.prototype)
  }
}
