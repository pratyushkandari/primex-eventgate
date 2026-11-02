/** API response fixtures matching contracts/ (OrderPlaced v1..v4 and its three consumers). */

import { vi } from 'vitest'
import type {
  AnalysisResponse,
  ConsumerFinding,
  Decision,
  EventCatalogSummary,
  EventDetail,
  PublishResponse,
  ReleaseRecord,
  RuntimeConfigResponse,
} from '@/types/api'

export function finding(partial: Partial<ConsumerFinding> & { consumerId: string }): ConsumerFinding {
  return {
    status: 'SAFE',
    ruleId: 'EVT008_CONSUMER_UNAFFECTED',
    field: '*',
    expectedType: null,
    proposedType: null,
    severity: 'LOW',
    reason: `${partial.consumerId} is not affected by the proposed changes.`,
    ...partial,
  }
}

const safe = (id: string) => finding({ consumerId: id })

export function analysis(decision: Decision, overrides: Partial<AnalysisResponse> = {}): AnalysisResponse {
  const base: AnalysisResponse = {
    analysisId: `an-${decision.toLowerCase()}`,
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 2,
    environment: 'production',
    compatibilityResult: 'SAFE',
    policyName: 'StandardReleasePolicy',
    policyReason: "Release policy for 'production' permits backward-compatible changes.",
    warnings: [],
    changeSet: { addedFields: ['metadata'], removedFields: [], typeChanges: [], requirednessChanges: [] },
    findings: [safe('analytics-service'), safe('billing-service'), safe('inventory-service')],
    decision,
    severity: 'LOW',
    summary: 'All registered consumers are compatible with the proposed event.',
    timestamp: '2026-11-02T08:00:00+00:00',
    requestId: `req-${decision.toLowerCase()}`,
  }
  if (decision === 'BLOCK') {
    Object.assign(base, {
      proposedVersion: 3,
      compatibilityResult: 'BREAK',
      severity: 'HIGH',
      policyReason: "Release policy for 'production' strictly blocks breaking changes (1 high-severity break detected).",
      summary: 'The proposed event is incompatible with 1 registered consumer.',
      changeSet: {
        addedFields: [],
        removedFields: [],
        typeChanges: [{ field: 'shippingMethod', fromType: 'string', toType: 'object' }],
        requirednessChanges: [],
      },
      findings: [
        safe('analytics-service'),
        safe('billing-service'),
        finding({
          consumerId: 'inventory-service',
          status: 'BREAK',
          ruleId: 'EVT001_FIELD_TYPE_CHANGED',
          field: 'shippingMethod',
          expectedType: 'string',
          proposedType: 'object',
          severity: 'HIGH',
          reason: "Inventory Service expects 'shippingMethod' to be string, but the proposed contract defines it as object.",
        }),
      ],
    })
  }
  if (decision === 'REVIEW') {
    Object.assign(base, {
      proposedVersion: 4,
      compatibilityResult: 'RISK',
      severity: 'MEDIUM',
      policyReason: "Release policy for 'production' requires manual engineering review for medium-risk changes.",
      summary: 'The proposed event requires review because 1 consumer compatibility check is uncertain.',
      changeSet: { addedFields: [], removedFields: ['couponCode'], typeChanges: [], requirednessChanges: [] },
      findings: [
        finding({
          consumerId: 'analytics-service',
          status: 'RISK',
          ruleId: 'EVT006_OPTIONAL_FIELD_REMOVED',
          field: 'couponCode',
          expectedType: 'string',
          severity: 'MEDIUM',
          reason: "Analytics Service uses optional field 'couponCode' (string), but it has been removed.",
        }),
        safe('billing-service'),
        safe('inventory-service'),
      ],
    })
  }
  return { ...base, ...overrides }
}

export function publishResponse(overrides: Partial<PublishResponse> = {}): PublishResponse {
  return {
    eventId: 'evt-123',
    published: true,
    decision: 'ALLOW',
    severity: 'LOW',
    eventBridgeEventId: 'local-eb-abc',
    analysis: analysis('ALLOW'),
    ...overrides,
  }
}

const field = (name: string, type: string, required = true) => ({ name, type, required })

export const orderPlacedDetail: EventDetail = {
  eventType: 'OrderPlaced',
  versionCount: 4,
  versions: [1, 2, 3, 4],
  latestVersion: 4,
  contracts: [1, 2, 3, 4].map((version) => ({
    eventType: 'OrderPlaced',
    version,
    fields: {
      orderId: field('orderId', 'string'),
      amount: field('amount', 'number'),
      shippingMethod: field('shippingMethod', version === 3 ? 'object' : 'string'),
      ...(version !== 4 ? { couponCode: field('couponCode', 'string', false) } : {}),
      ...(version === 2 ? { metadata: field('metadata', 'object', false) } : {}),
    },
  })),
  consumers: [
    { consumerId: 'analytics-service', eventType: 'OrderPlaced', expectedFields: { orderId: field('orderId', 'string'), couponCode: field('couponCode', 'string', false) } },
    { consumerId: 'billing-service', eventType: 'OrderPlaced', expectedFields: { orderId: field('orderId', 'string'), amount: field('amount', 'number') } },
    { consumerId: 'inventory-service', eventType: 'OrderPlaced', expectedFields: { orderId: field('orderId', 'string'), shippingMethod: field('shippingMethod', 'string') } },
  ],
}

export const paymentCompletedDetail: EventDetail = {
  eventType: 'PaymentCompleted',
  versionCount: 2,
  versions: [1, 2],
  latestVersion: 2,
  contracts: [1, 2].map((version) => ({
    eventType: 'PaymentCompleted',
    version,
    fields: {
      paymentId: field('paymentId', 'string'),
      amount: field('amount', 'number'),
      ...(version === 2 ? { transactionFee: field('transactionFee', 'number', false) } : {}),
    },
  })),
  consumers: [
    { consumerId: 'fraud-detection-service', eventType: 'PaymentCompleted', expectedFields: { paymentId: field('paymentId', 'string') } },
  ],
}

export const catalog: EventCatalogSummary[] = [
  { eventType: 'OrderPlaced', versionCount: 4, versions: [1, 2, 3, 4], latestVersion: 4, consumerCount: 3 },
  { eventType: 'PaymentCompleted', versionCount: 2, versions: [1, 2], latestVersion: 2, consumerCount: 1 },
]

export function record(partial: Partial<ReleaseRecord> = {}): ReleaseRecord {
  return {
    recordId: 'rec-1',
    analysisId: 'rec-1',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 2,
    environment: 'production',
    compatibilityResult: 'SAFE',
    severity: 'LOW',
    policyName: 'StandardReleasePolicy',
    policyReason: 'Backward-compatible change.',
    decision: 'ALLOW',
    affectedConsumers: [],
    findingsSummary: [],
    published: false,
    attemptedPublish: false,
    timestamp: '2026-11-02T08:00:00+00:00',
    ...partial,
  }
}

export const runtimeConfig: RuntimeConfigResponse = {
  serviceVersion: '0.1.0',
  storageBackend: 'Local JSON files',
  storageBackendType: 'local',
  contractsSource: 'contracts/ directory',
  historyStore: 'Local JSON file',
  publisherBackend: 'In-memory (local)',
  publisherBackendType: 'local',
  eventBridgeBus: null,
  awsRegion: 'ap-south-1',
  policyEngine: 'Standard',
  policyEngineType: 'standard',
}

/** A complete mock of eventGateApi with sensible defaults for every call. */
export function mockApi() {
  return {
    checkHealth: vi.fn().mockResolvedValue({ status: 'ok', service: 'eventgate', version: '0.1.0' }),
    analyzeCompatibility: vi.fn().mockResolvedValue(analysis('ALLOW')),
    publishEvent: vi.fn().mockResolvedValue(publishResponse()),
    listEventCatalog: vi.fn().mockResolvedValue(catalog),
    getEventDetail: vi.fn((eventType: string) =>
      Promise.resolve(eventType === 'PaymentCompleted' ? paymentCompletedDetail : orderPlacedDetail)
    ),
    listConsumers: vi.fn().mockResolvedValue([]),
    getConsumerDetail: vi.fn(),
    listHistory: vi.fn().mockResolvedValue([]),
    getReport: vi.fn().mockResolvedValue({ recordId: 'rec-1', format: 'markdown', content: '# Report' }),
    getPolicies: vi.fn(),
    getRuntimeConfig: vi.fn().mockResolvedValue(runtimeConfig),
  }
}
