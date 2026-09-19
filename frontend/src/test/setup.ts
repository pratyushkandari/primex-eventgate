import '@testing-library/jest-dom/vitest'

// ResizeObserver mock for jsdom environment (required by @xyflow/react)
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = window.ResizeObserver || ResizeObserverMock
}
if (typeof global !== 'undefined') {
  ;(global as unknown as { ResizeObserver: unknown }).ResizeObserver =
    (global as unknown as { ResizeObserver: unknown }).ResizeObserver || ResizeObserverMock
}
