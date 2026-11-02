/**
 * Zod schemas for every API response. The client validates responses so a
 * backend contract change fails loudly at the boundary instead of rendering
 * undefined values deep inside a component.
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

const TypeChangeSchema = z.object({ field: z.string(), fromType: z.string(), toType: z.string() })

const RequirednessChangeSchema = z.object({
  field: z.string(),
  fromRequired: z.boolean(),
  toRequired: z.boolean(),
})

const ChangeSetSchema = z.object({
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
  expectedType: z.string().nullable().default(null),
  proposedType: z.string().nullable().default(null),
  severity: SeveritySchema,
  reason: z.string(),
})

export const AnalysisResponseSchema = z.object({
  analysisId: z.string(),
  eventType: z.string(),
  currentVersion: z.number(),
  proposedVersion: z.number(),
  environment: EnvironmentSchema,
  compatibilityResult: ConsumerStatusSchema,
  policyName: z.string(),
  policyReason: z.string(),
  warnings: z.array(z.string()),
  changeSet: ChangeSetSchema,
  findings: z.array(ConsumerFindingSchema),
  decision: DecisionSchema,
  severity: SeveritySchema,
  summary: z.string(),
  timestamp: z.string(),
  requestId: z.string().nullable().optional(),
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

const FieldSpecSchema = z.object({ name: z.string(), type: z.string(), required: z.boolean() })

const EventContractVersionSchema = z.object({
  eventType: z.string(),
  version: z.number(),
  fields: z.record(z.string(), FieldSpecSchema),
})

export const ConsumerDetailSchema = z.object({
  consumerId: z.string(),
  eventType: z.string(),
  expectedFields: z.record(z.string(), FieldSpecSchema),
})

export const EventDetailSchema = z.object({
  eventType: z.string(),
  versionCount: z.number(),
  versions: z.array(z.number()),
  latestVersion: z.number(),
  contracts: z.array(EventContractVersionSchema),
  consumers: z.array(ConsumerDetailSchema),
})

export const ConsumerSummarySchema = z.object({
  consumerId: z.string(),
  eventType: z.string(),
  expectedFieldsCount: z.number(),
})

export const ReleaseRecordSchema = z.object({
  recordId: z.string(),
  analysisId: z.string(),
  eventType: z.string(),
  currentVersion: z.number(),
  proposedVersion: z.number(),
  // Records written before the API validated environments may hold any string;
  // accepting it keeps one legacy record from hiding the whole history.
  environment: z.string(),
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
  format: z.enum(['markdown', 'json']),
  content: z.string(),
})

export const PolicyInspectionResponseSchema = z.object({
  activeEngine: z.string(),
  engineName: z.string(),
  description: z.string(),
  matrix: z.array(
    z.object({ environment: z.string(), low: z.string(), medium: z.string(), high: z.string() })
  ),
  cedarPolicyAvailable: z.boolean(),
  cedarPolicyText: z.string().nullable().optional(),
})

export const RuntimeConfigResponseSchema = z.object({
  serviceVersion: z.string(),
  storageBackend: z.string(),
  storageBackendType: z.string(),
  contractsSource: z.string(),
  historyStore: z.string(),
  publisherBackend: z.string(),
  publisherBackendType: z.string(),
  eventBridgeBus: z.string().nullable(),
  awsRegion: z.string(),
  policyEngine: z.string(),
  policyEngineType: z.string(),
})

/**
 * Parse `data` with `schema`, throwing an Error that names the response and the
 * offending fields when it does not match.
 */
export function validateResponse<T>(
  schema: z.ZodType<T, unknown>,
  data: unknown,
  contextName: string
): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join(', ')
    throw new Error(`Unexpected ${contextName} response from the EventGate API (${issues}).`)
  }
  return result.data
}
