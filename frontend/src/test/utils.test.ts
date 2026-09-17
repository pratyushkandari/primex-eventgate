import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional class names', () => {
    const isPrimary = true
    const isSmall = false
    expect(cn('base', isPrimary && 'bg-blue-600', isSmall && 'text-sm')).toBe('base bg-blue-600')
  })

  it('resolves tailwind conflicts via tailwind-merge', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})
