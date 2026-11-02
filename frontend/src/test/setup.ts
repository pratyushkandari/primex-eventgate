import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// findBy*/waitFor give up after 1 s by default. The first render of the whole
// console can take longer when coverage and parallel workers load the machine,
// which failed tests on main as well; wait up to 5 s (still well under the 15 s
// test timeout in vite.config.ts).
configure({ asyncUtilTimeout: 5000 })

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
