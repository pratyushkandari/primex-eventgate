import type { ConsumerFinding, ConsumerStatus } from '@/types/api'

const RANK: Record<ConsumerStatus, number> = { SAFE: 0, RISK: 1, BREAK: 2 }

export interface ConsumerImpact {
  consumerId: string
  status: ConsumerStatus
  /** Findings for this consumer, worst first. */
  findings: ConsumerFinding[]
}

/**
 * One entry per consumer, combining the subscribed consumer list with the
 * analysis findings. A consumer's status is its worst finding; consumers with
 * no findings (before an analysis runs) are SAFE.
 */
export function consumerImpacts(consumerIds: string[], findings: ConsumerFinding[]): ConsumerImpact[] {
  const ids = new Set([...consumerIds, ...findings.map((f) => f.consumerId)])
  return [...ids].sort().map((consumerId) => {
    const own = findings
      .filter((f) => f.consumerId === consumerId)
      .sort((a, b) => RANK[b.status] - RANK[a.status])
    return { consumerId, status: own[0]?.status ?? 'SAFE', findings: own }
  })
}

export function countByStatus(impacts: ConsumerImpact[]) {
  return {
    total: impacts.length,
    safe: impacts.filter((i) => i.status === 'SAFE').length,
    risk: impacts.filter((i) => i.status === 'RISK').length,
    break: impacts.filter((i) => i.status === 'BREAK').length,
  }
}
