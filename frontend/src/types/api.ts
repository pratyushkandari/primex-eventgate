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

export type Environment = 'development' | 'staging' | 'production'

export interface AnalysisRequest {
  eventType: string
  currentVersion: number
  proposedVersion: number
  environment?: Environment
}

export interface EventCatalogSummary {
  eventType: string
  versionCount: number
  versions: number[]
  latestVersion: number
  consumerCount: number
}

export interface EventFieldSchema {
  name: string
  type: string
  required: boolean
}

export interface EventContractVersion {
  eventType: string
  version: number
  fields: Record<string, EventFieldSchema>
}

export interface SubscribedConsumer {
  consumerId: string
  eventType: string
  expectedFields: Record<string, { name: string; type: string; required: boolean }>
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

export interface ConsumerDetail {
  consumerId: string
  eventType: string
  expectedFields: Record<string, { name: string; type: string; required: boolean }>
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
  environment?: Environment
  compatibilityResult?: string
  policyName?: string
  policyReason?: string
  warnings?: string[]
  changeSet: ChangeSet
  findings: ConsumerFinding[]
  decision: Decision
  severity: Severity
  summary: string
  timestamp: string
  requestId?: string
}

export interface PublishRequest {
  eventType: string
  currentVersion: number
  proposedVersion: number
  payload: Record<string, unknown>
  environment?: Environment
  analysisId?: string
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
  environment: Environment
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

export interface ReportExportResponse {
  recordId: string
  format: string
  content: string
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
    Object.setPrototypeOf(this, EventGateApiError.prototype)
  }
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
  environment: string
  storageBackend: string
  storageBackendType: string
  publisherBackend: string
  publisherBackendType: string
  awsRegion: string
  eventBridgeBus: string
  policyEngine: string
  policyEngineType: string
  contractsDirectory: string
}

