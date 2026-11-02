/**
 * Shared Playwright fixtures. Every test fails if the page logs a console error
 * or throws an uncaught exception. A test that provokes an error on purpose
 * (an HTTP 4xx/5xx or an aborted request makes the browser log one) allows
 * that message with consoleGuard.allow(pattern).
 */
import { expect, test as base } from '@playwright/test'

export interface ConsoleGuard {
  allow: (pattern: RegExp) => void
}

export const test = base.extend<{ consoleGuard: ConsoleGuard }>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = []
      const allowed: RegExp[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      page.on('pageerror', (err) => errors.push(`Uncaught: ${err.message}`))
      await use({ allow: (pattern) => allowed.push(pattern) })
      expect(errors.filter((text) => !allowed.some((p) => p.test(text))), 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
