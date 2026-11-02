import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures.ts'

test.describe('Other pages', () => {
  test('contracts: browse an event and open a change in Review', async ({ page }) => {
    await page.goto('/#/contracts')
    await page.getByRole('button', { name: /PaymentCompleted/ }).click()
    await expect(page.getByRole('table', { name: /Fields of PaymentCompleted v2/ })).toBeVisible()
    await page.getByRole('button', { name: 'Review v1 → v2' }).click()

    await expect(page).toHaveURL(/#\/review$/)
    await expect(page.getByLabel('Event type')).toHaveValue('PaymentCompleted')
    await expect(page.getByLabel('Event payload (JSON)')).toHaveValue(/transactionFee/)
    await page.getByRole('button', { name: /Analyze compatibility/ }).click()
    await expect(page.getByText('Safe to publish')).toBeVisible()
  })

  test('consumer contracts link to their event', async ({ page }) => {
    await page.goto('/#/contracts')
    await page.getByRole('button', { name: 'Consumer contracts' }).click()
    await page.getByRole('button', { name: /notification-service/ }).click()
    await page.getByRole('button', { name: 'View UserCreated' }).click()
    await expect(page.getByRole('table', { name: /Fields of UserCreated/ })).toBeVisible()
  })

  test('history: inspect a record and download its JSON report', async ({ page, isMobile }) => {
    await page.goto('/#/review')
    await page.getByRole('button', { name: /Change field type/ }).click()
    await page.getByRole('button', { name: /Analyze compatibility/ }).click()
    await expect(page.getByText('Blocked', { exact: true })).toBeVisible()

    await page.goto('/#/history')
    await page.getByLabel('Decision').selectOption('BLOCK')
    await page.getByRole('button', { name: /Inspect/ }).first().click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toContainText('inventory-service')
    test.skip(isMobile, 'Downloads are covered on desktop')
    const downloadPromise = page.waitForEvent('download')
    await drawer.getByRole('button', { name: 'JSON' }).click()
    expect((await downloadPromise).suggestedFilename()).toMatch(/^eventgate-OrderPlaced-v3-.*\.json$/)
  })

  test('developer tools: a sample assertion passes', async ({ page }) => {
    await page.goto('/#/devtools')
    await page.getByRole('button', { name: /OrderPlaced v1→v3/ }).click()
    await page.getByRole('button', { name: 'Run assertion' }).click()
    await expect(page.getByText('Pass: expected BLOCK, got BLOCK')).toBeVisible()
  })

  test('policies and settings read from the API', async ({ page }) => {
    await page.goto('/#/policies')
    await expect(page.getByRole('table', { name: /Release decision by environment/ })).toContainText('with warning')
    await page.goto('/#/settings')
    await expect(page.getByText('Local JSON files')).toBeVisible()
    await expect(page.getByText('In-memory (local)')).toBeVisible()
  })

  test('an unreachable API shows actionable errors', async ({ page, consoleGuard }) => {
    consoleGuard.allow(/net::ERR_FAILED/)
    await page.route('**/127.0.0.1:8017/**', (route) => route.abort())
    await page.goto('/#/history')
    await expect(page.getByText('Could not load release history')).toBeVisible()
    await expect(page.getByText(/Could not reach the EventGate API/)).toBeVisible()
    await expect(page.getByText('API unreachable').filter({ visible: true })).toBeVisible()
  })
})

const HEADINGS: Record<string, string> = {
  review: 'Review a contract change',
  contracts: 'Contracts',
  history: 'Release history',
  devtools: 'Developer tools',
  policies: 'Release policy',
  settings: 'Runtime configuration',
}
const PAGES = Object.keys(HEADINGS)

test.describe('Every page loads without console errors', () => {
  for (const name of PAGES) {
    test(name, async ({ page }) => {
      await page.goto(`/#/${name}`)
      await expect(page.getByRole('heading', { level: 1, name: HEADINGS[name] })).toBeVisible()
      await page.waitForLoadState('networkidle')
    })
  }
})

test.describe('Accessibility (axe, WCAG 2.1 AA)', () => {
  for (const name of PAGES) {
    test(`${name} has no violations`, async ({ page }) => {
      await page.goto(`/#/${name}`)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([])
    })
  }

  test('review after a BREAK analysis and with a dialog open has no violations', async ({ page }) => {
    await page.goto('/#/review')
    await page.getByRole('button', { name: /Change field type/ }).click()
    await page.getByRole('button', { name: /Analyze compatibility/ }).click()
    await expect(page.getByText('Blocked', { exact: true })).toBeVisible()
    let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])

    await page.getByRole('button', { name: 'Export report' }).click()
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])
  })
})
