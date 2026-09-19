/**
 * Zod runtime schemas for structural validation of EventGate API responses.
 * Enforces backend schema compliance without duplicating business logic.
 */

import { z } from 'zod'

export const DecisionSchema = z.enum(['ALLOW', 'REVIEW', 'BLOCK'])
export const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])
export const ConsumerStatusSchema = z.enum(['SAFE', 'RISK', 'BREAK'])
export const EnvironmentSchema = z.enum(['development', 'staging', 'production'])

export const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
})

export const TypeChangeSchema = z.object({
  field: z.string(),
  fromType: z.string(),
  toType: z.string(),
})

export const RequirednessChangeSchema = z.object({
  field: z.string(),
  fromRequired: z.boolean(),
  toRequired: z.boolean(),
})

export const ChangeSetSchema = z.object({
  addedFields: z.array(z.string()),
  removedFields: z.array(z.string()),
  typeChanges: z.array(TypeChangeSchema),
  requirednessChanges: z.array(RequirednessChangeSchema),
})

export const ConsumerFindingSchema = z.object({
  consumerId: z.string(),
  status: ConsumerStatusSchema,
  ruleId: z.string(),
  field: z.string(),
  expectedType: z.union([z.string(), z.null()]).or(z.undefined().transform(() => null)),
  proposedType: z.union([z.string(), z.null()]).or(z.undefined().transform(() => null)),
  severity: SeveritySchema,
  reason: z.string(),
})

export const AnalysisResponseSchema = z.object({
  analysisId: z.string(),
  eventType: z.string(),
  currentVersion: z.number(),
  proposedVersion: z.number(),
  environment: EnvironmentSchema.optional(),
  compatibilityResult: z.string().optional(),
  policyName: z.string().optional(),
  policyReason: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  changeSet: ChangeSetSchema,
  findings: z.array(ConsumerFindingSchema),
  decision: DecisionSchema,
  severity: SeveritySchema,
  summary: z.string(),
  timestamp: z.string(),
  requestId: z.string().optional(),
})

export const PublishResponseSchema = z.object({
  eventId: z.string(),
  published: z.boolean(),
  decision: DecisionSchema,
  severity: SeveritySchema,
  eventBridgeEventId: z.string().nullable(),
  analysis: AnalysisResponseSchema,
})

export const EventCatalogSummarySchema = z.object({
  eventType: z.string(),
  versionCount: z.number(),
  versions: z.array(z.number()),
  latestVersion: z.number(),
  consumerCount: z.number(),
})

export const EventFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
})

export const EventContractVersionSchema = z.object({
  eventType: z.string(),
  version: z.number(),
  fields: z.record(z.string(), EventFieldSchema),
})

export const SubscribedConsumerSchema = z.object({
  consumerId: z.string(),
  eventType: z.string(),
  expectedFields: z.record(z.string(), EventFieldSchema),
})

export const EventDetailSchema = z.object({
  eventType: z.string(),
  versionCount: z.number(),
  versions: z.array(z.number()),
  latestVersion: z.number(),
  contracts: z.array(EventContractVersionSchema),
  consumers: z.array(SubscribedConsumerSchema),
})

export const ConsumerSummarySchema = z.object({
  consumerId: z.string(),
  eventType: z.string(),
  expectedFieldsCount: z.number(),
})

export const ConsumerDetailSchema = z.object({
  consumerId: z.string(),
  eventType: z.string(),
  expectedFields: z.record(z.string(), EventFieldSchema),
})

export const ReleaseRecordSchema = z.object({
  recordId: z.string(),
  analysisId: z.string(),
  eventType: z.string(),
  currentVersion: z.number(),
  proposedVersion: z.number(),
  environment: EnvironmentSchema,
  compatibilityResult: z.string(),
  severity: SeveritySchema,
  policyName: z.string(),
  policyReason: z.string(),
  decision: DecisionSchema,
  affectedConsumers: z.array(z.string()),
  findingsSummary: z.array(ConsumerFindingSchema),
  published: z.boolean(),
  attemptedPublish: z.boolean(),
  eventId: z.string().nullable().optional(),
  eventBridgeEventId: z.string().nullable().optional(),
  requestId: z.string().nullable().optional(),
  timestamp: z.string(),
  publishedAt: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
})

export const ReportExportResponseSchema = z.object({
  recordId: z.string(),
  format: z.string(),
  content: z.string(),
})

export const PolicyMatrixRowSchema = z.object({
  environment: z.string(),
  low: z.string(),
  medium: z.string(),
  high: z.string(),
})

export const PolicyInspectionResponseSchema = z.object({
  activeEngine: z.string(),
  engineName: z.string(),
  description: z.string(),
  matrix: z.array(PolicyMatrixRowSchema),
  cedarPolicyAvailable: z.boolean(),
  cedarPolicyText: z.string().nullable().optional(),
})

export const RuntimeConfigResponseSchema = z.object({
  environment: z.string(),
  storageBackend: z.string(),
  storageBackendType: z.string(),
  publisherBackend: z.string(),
  publisherBackendType: z.string(),
  awsRegion: z.string(),
  eventBridgeBus: z.string(),
  policyEngine: z.string(),
  policyEngineType: z.string(),
  contractsDirectory: z.string(),
})

/**
 * Utility to safely validate an API response with a Zod schema.
 * Throws a formatted Error if validation fails.
 */
export function validateResponse<T>(schema: z.ZodType<T>, data: unknown, contextName: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errorIssues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join(', ')
    throw new Error(`Invalid ${contextName} response structure from EventGate API: ${errorIssues}`)
  }
  return result.data
}
