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

// jsdom has no matchMedia. Tests run at a desktop width unless they override it.
export function setViewportWide(wide: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: wide && /min-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
setViewportWide(true)

afterEach(() => {
  setViewportWide(true)
  cleanup()
  window.location.hash = ''
})
