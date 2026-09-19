export interface RegisteredConsumer {
  id: string
  name: string
  role: string
  critical: boolean
}

export const REGISTERED_CONSUMERS: RegisteredConsumer[] = [
  { id: 'billing-service', name: 'Billing Service', role: 'Payment processing & invoices', critical: true },
  { id: 'inventory-service', name: 'Inventory Service', role: 'Stock allocation & fulfillment', critical: true },
  { id: 'analytics-service', name: 'Analytics Service', role: 'Metrics, BI & telemetry', critical: false },
]
