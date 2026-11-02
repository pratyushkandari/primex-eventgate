import { afterEach, describe, expect, it, vi } from 'vitest'
import { cn, downloadText, formatTimestamp, toneFor } from '@/lib/utils'
import { consumerImpacts, countByStatus } from '@/lib/findings'
import { DEMO_SCENARIOS, expectedDecisionFor, findScenario, payloadTemplate } from '@/data/scenarios'
import { finding, orderPlacedDetail } from './fixtures'

describe('cn', () => {
  it('merges conditional classes and resolves Tailwind conflicts', () => {
    const hidden = false
    expect(cn('px-2', hidden && 'hidden', 'px-4')).toBe('px-4')
  })
})

describe('toneFor', () => {
  it.each([
    ['ALLOW', 'success'],
    ['SAFE', 'success'],
    ['LOW', 'success'],
    ['REVIEW', 'warning'],
    ['RISK', 'warning'],
    ['MEDIUM', 'warning'],
    ['BLOCK', 'danger'],
    ['BREAK', 'danger'],
    ['HIGH', 'danger'],
    ['other', 'neutral'],
    [null, 'neutral'],
  ])('%s -> %s', (value, tone) => {
    expect(toneFor(value)).toBe(tone)
  })
})

describe('formatTimestamp', () => {
  it('formats ISO timestamps and passes through bad input', () => {
    expect(formatTimestamp('2026-11-02T08:00:00Z')).toMatch(/Nov/)
    expect(formatTimestamp('not a date')).toBe('not a date')
    expect(formatTimestamp(null)).toBe('-')
  })
})

describe('downloadText', () => {
  afterEach(() => vi.useRealTimers())

  it('clicks a temporary link and revokes the URL afterwards', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadText('report.md', '# hi', 'text/markdown')

    expect(click).toHaveBeenCalledOnce()
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:x')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})

describe('consumerImpacts', () => {
  it('reports each consumer once with its worst status', () => {
    const impacts = consumerImpacts(
      ['billing-service', 'inventory-service'],
      [
        finding({ consumerId: 'inventory-service', status: 'RISK', field: 'a' }),
        finding({ consumerId: 'inventory-service', status: 'BREAK', field: 'b' }),
      ]
    )
    expect(impacts.map((i) => [i.consumerId, i.status])).toEqual([
      ['billing-service', 'SAFE'],
      ['inventory-service', 'BREAK'],
    ])
    expect(impacts[1].findings[0].status).toBe('BREAK')
    expect(countByStatus(impacts)).toEqual({ total: 2, safe: 1, risk: 0, break: 1 })
  })

  it('includes consumers that only appear in findings', () => {
    expect(consumerImpacts([], [finding({ consumerId: 'x' })]).map((i) => i.consumerId)).toEqual(['x'])
  })
})

describe('scenarios', () => {
  it('finds samples by exact change', () => {
    expect(findScenario('OrderPlaced', 1, 3)?.id).toBe('breaking')
    expect(findScenario('OrderPlaced', 2, 3)).toBeUndefined()
  })

  it('expects REVIEW for the risky sample except in development', () => {
    const risk = DEMO_SCENARIOS.risk
    expect(expectedDecisionFor(risk, 'production')).toBe('REVIEW')
    expect(expectedDecisionFor(risk, 'development')).toBe('ALLOW')
    expect(expectedDecisionFor(DEMO_SCENARIOS.breaking, 'development')).toBe('BLOCK')
    expect(expectedDecisionFor({ eventType: 'UserCreated', currentVersion: 1, proposedVersion: 2 }, 'production')).toBeNull()
  })

  it('builds a payload with a value of the declared type for every field', () => {
    const payload = payloadTemplate(orderPlacedDetail.contracts[2])
    expect(payload).toEqual({
      orderId: 'example-orderId',
      amount: 1.5,
      shippingMethod: {},
      couponCode: 'example-couponCode',
    })
  })
})
