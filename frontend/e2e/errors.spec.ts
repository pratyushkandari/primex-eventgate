import { expect, test } from './fixtures.ts'
import { API_PORT, BUS_DOWN_PORT } from './ports.ts'

test.describe('Form validation', () => {
  test('developer tools needs two different versions', async ({ page }) => {
    await page.goto('/#/devtools')
    await page.getByLabel('Current version').selectOption('2')
    await page.getByLabel('Proposed version').selectOption('2')
    await expect(page.getByText('Choose two different versions.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run assertion' })).toBeDisabled()

    await page.getByLabel('Proposed version').selectOption('3')
    await expect(page.getByText('Choose two different versions.')).toBeHidden()
  })

  test('contract filters show an empty state and can be cleared', async ({ page }) => {
    await page.goto('/#/contracts')
    const events = page.getByLabel('Filter event types')
    await events.fill('NoSuchEvent')
    await expect(page.getByText('No event types match "NoSuchEvent"')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filter' }).click()
    await expect(events).toHaveValue('')
    await expect(page.getByRole('list', { name: 'Event types' }).getByRole('listitem')).toHaveCount(3)

    await page.getByRole('button', { name: 'Consumer contracts' }).click()
    const consumers = page.getByLabel('Filter consumers')
    await consumers.fill('billing')
    await expect(page.getByRole('list', { name: 'Consumers' }).getByRole('listitem')).toHaveCount(1)
    await consumers.fill('nobody')
    await expect(page.getByText('No consumers match "nobody"')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filter' }).click()
    await expect(page.getByRole('list', { name: 'Consumers' }).getByRole('listitem')).toHaveCount(5)
  })

  test('history filters narrow the records and can be cleared', async ({ page }) => {
    await page.goto('/#/review')
    await page.getByRole('button', { name: /Analyze compatibility/ }).click()
    await expect(page.getByText('Safe to publish')).toBeVisible()

    await page.goto('/#/history')
    const search = page.getByLabel('Search')
    await search.fill('no-such-record')
    await expect(page.getByText('No records match these filters')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).first().click()
    await expect(search).toHaveValue('')
    await expect(page.getByText(/Showing \d+ of \d+ matching records/)).toBeVisible()
  })
})

test.describe('Error messages', () => {
  test('an analysis that cannot reach the API shows the error and retries', async ({ page, consoleGuard }) => {
    consoleGuard.allow(/net::ERR_FAILED/)
    await page.goto('/#/review')
    await expect(page.getByText('3 registered consumers')).toBeVisible()
    // Simulated network failure: the browser aborts the first analyze request.
    await page.route('**/api/v1/analyze', (route) => route.abort(), { times: 1 })
    await page.getByRole('button', { name: /Analyze compatibility/ }).click()

    const alert = page.getByRole('alert').filter({ hasText: 'Analysis failed' })
    await expect(alert).toContainText('Could not reach the EventGate API')
    await alert.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('Safe to publish')).toBeVisible()
    await expect(alert).toBeHidden()
  })

  test('a publish the event bus rejects shows the bus error and is recorded', async ({ page, consoleGuard }) => {
    consoleGuard.allow(/status of 503/)
    // Send the console's API calls to the backend whose event bus is unreachable.
    // The 503 comes from that real backend; nothing is stubbed.
    await page.route(`http://127.0.0.1:${API_PORT}/**`, (route) =>
      route.continue({ url: route.request().url().replace(`:${API_PORT}`, `:${BUS_DOWN_PORT}`) })
    )
    await page.goto('/#/review')
    await page.getByRole('button', { name: /Analyze compatibility/ }).click()
    await expect(page.getByText('Safe to publish')).toBeVisible()
    await page.getByRole('button', { name: 'Publish event' }).click()
    await page.getByRole('dialog', { name: 'Publish to production?' }).getByRole('button', { name: 'Publish event' }).click()

    const alert = page.getByRole('alert').filter({ hasText: 'Event bus unavailable' })
    await expect(alert).toContainText('HTTP 503')
    await expect(alert).toContainText('The attempt is recorded in History')

    await page.goto('/#/history')
    await expect(page.getByText('Publish failed').filter({ visible: true }).first()).toBeVisible()
  })
})
