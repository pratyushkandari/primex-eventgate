/**
 * Sample changes backed by the OrderPlaced contracts in contracts/events/order-placed,
 * with a payload that is valid for each proposed version. Other event types get a
 * payload generated from their contract (see payloadTemplate).
 */

import type { ConsumerStatus, Decision, Environment, EventContractVersion } from '@/types/api'

export type ScenarioId = 'safe' | 'breaking' | 'risk'

export interface DemoScenario {
  id: ScenarioId
  label: string
  action: string
  eventType: string
  currentVersion: number
  proposedVersion: number
  /** Compatibility verdict; the same in every environment. */
  compatibility: ConsumerStatus
  /** Decision in production; development allows the risky change with a warning. */
  expectedDecision: Decision
  description: string
  samplePayload: Record<string, unknown>
}

const ORDER_BASE = {
  orderId: 'ord-101',
  amount: 149.99,
  items: ['ITEM-A', 'ITEM-B'],
  shippingMethod: 'standard',
}

export const DEMO_SCENARIOS: Record<ScenarioId, DemoScenario> = {
  safe: {
    id: 'safe',
    label: 'Safe',
    action: 'Add optional field',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 2,
    compatibility: 'SAFE',
    expectedDecision: 'ALLOW',
    description: 'v2 adds an optional metadata object. No consumer reads it.',
    samplePayload: { ...ORDER_BASE, couponCode: 'SAVE10', metadata: { source: 'web-checkout' } },
  },
  breaking: {
    id: 'breaking',
    label: 'Breaking',
    action: 'Change field type',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 3,
    compatibility: 'BREAK',
    expectedDecision: 'BLOCK',
    description: 'v3 changes shippingMethod from string to object. inventory-service reads it as a string.',
    samplePayload: { ...ORDER_BASE, shippingMethod: { carrier: 'express', trackingNumber: 'TRK-987' }, couponCode: 'SAVE10' },
  },
  risk: {
    id: 'risk',
    label: 'Risky',
    action: 'Remove optional field',
    eventType: 'OrderPlaced',
    currentVersion: 1,
    proposedVersion: 4,
    compatibility: 'RISK',
    expectedDecision: 'REVIEW',
    description: 'v4 removes the optional couponCode field that analytics-service reads.',
    samplePayload: { ...ORDER_BASE },
  },
}

export const SCENARIO_LIST: DemoScenario[] = Object.values(DEMO_SCENARIOS)

/** The demo scenario for this exact change, if there is one. */
export function findScenario(
  eventType: string,
  currentVersion: number,
  proposedVersion: number
): DemoScenario | undefined {
  return SCENARIO_LIST.find(
    (s) =>
      s.eventType === eventType &&
      s.currentVersion === currentVersion &&
      s.proposedVersion === proposedVersion
  )
}

/**
 * Decision a sample change should get in an environment, or null when the change
 * is not a sample. Mirrors the policy matrix: RISK is allowed in development.
 */
export function expectedDecisionFor(
  change: { eventType: string; currentVersion: number; proposedVersion: number },
  environment: Environment
): Decision | null {
  const sample = findScenario(change.eventType, change.currentVersion, change.proposedVersion)
  if (!sample) return null
  if (sample.compatibility === 'RISK' && environment === 'development') return 'ALLOW'
  return sample.expectedDecision
}

const SAMPLE_VALUES: Record<string, unknown> = {
  string: 'example',
  number: 1.5,
  integer: 1,
  boolean: true,
  object: {},
  array: [],
  null: null,
}

/** A payload with one placeholder value per field of the contract. */
export function payloadTemplate(contract: EventContractVersion): Record<string, unknown> {
  return Object.fromEntries(
    Object.values(contract.fields).map((field) => [
      field.name,
      field.type === 'string' ? `example-${field.name}` : SAMPLE_VALUES[field.type] ?? null,
    ])
  )
}
