import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom has no ResizeObserver; @xyflow/react needs one.
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
globalThis.ResizeObserver ??= ResizeObserverMock as unknown as typeof ResizeObserver

afterEach(() => {
  cleanup()
  window.location.hash = ''
})
