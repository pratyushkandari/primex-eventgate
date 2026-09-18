/**
 * Canonical test scenarios and sample payloads matching repository contracts.
 */

export interface DemoScenario {
  id: 'safe' | 'breaking' | 'risk'
  name: string
  label: string
  action: string
  transition: string
  currentVersion: number
  proposedVersion: number
  expectedDecision: 'ALLOW' | 'BLOCK' | 'REVIEW'
  description: string
  samplePayload: Record<string, unknown>
}

export const DEMO_SCENARIOS: Record<'safe' | 'breaking' | 'risk', DemoScenario> = {
  safe: {
    id: 'safe',
    name: 'Safe change',
    label: 'Safe',
    action: 'Add optional field',
    transition: 'v1 → v2',
    currentVersion: 1,
    proposedVersion: 2,
    expectedDecision: 'ALLOW',
    description: 'Adds optional metadata field. All 3 consumers remain unaffected.',
    samplePayload: {
      orderId: 'ord-101',
      amount: 149.99,
      items: ['ITEM-A', 'ITEM-B'],
      shippingMethod: 'standard',
      couponCode: 'SAVE10',
      metadata: {
        source: 'web-checkout',
      },
    },
  },
  breaking: {
    id: 'breaking',
    name: 'Breaking change',
    label: 'Breaking',
    action: 'Change field type',
    transition: 'v1 → v3',
    currentVersion: 1,
    proposedVersion: 3,
    expectedDecision: 'BLOCK',
    description: "shippingMethod type changed from string to object. inventory-service breaks.",
    samplePayload: {
      orderId: 'ord-101',
      amount: 149.99,
      items: ['ITEM-A', 'ITEM-B'],
      shippingMethod: {
        carrier: 'express',
        trackingNumber: 'TRK-987',
      },
      couponCode: 'SAVE10',
    },
  },
  risk: {
    id: 'risk',
    name: 'Risky change',
    label: 'Risk',
    action: 'Remove optional field',
    transition: 'v1 → v4',
    currentVersion: 1,
    proposedVersion: 4,
    expectedDecision: 'REVIEW',
    description: "Optional couponCode removed. analytics-service telemetry flagged for review.",
    samplePayload: {
      orderId: 'ord-101',
      amount: 149.99,
      items: ['ITEM-A', 'ITEM-B'],
      shippingMethod: 'standard',
    },
  },
}
