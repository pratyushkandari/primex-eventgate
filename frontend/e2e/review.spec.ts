import { expect, test, type Page } from '@playwright/test'

async function selectEnvironment(page: Page, env: string) {
  await page.getByLabel('Release target environment').selectOption(env)
}

async function analyze(page: Page) {
  await page.getByRole('button', { name: /Analyze compatibility/ }).click()
}

test.describe('Review workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/review')
    await expect(page.getByRole('heading', { name: 'Review a contract change' })).toBeVisible()
    await expect(page.getByText('3 registered consumers')).toBeVisible()
  })

  test('safe change: analyze, confirm, publish, and find it in history', async ({ page }) => {
    await analyze(page)
    await expect(page.getByText('Safe to publish')).toBeVisible()

    await page.getByRole('button', { name: 'Publish event' }).click()
    const confirm = page.getByRole('dialog', { name: 'Publish to production?' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Publish event' }).click()

    await expect(page.getByText('Published to the local in-memory publisher')).toBeVisible()
    const eventId = await page.getByRole('region', { name: 'Publish result' }).locator('dd').first().textContent()

    await page.goto('/#/history')
    await page.getByLabel('Search').fill(eventId ?? '')
    await expect(page.getByText('Showing 1 of')).toBeVisible()
    await expect(page.getByText(/Published/).filter({ visible: true }).first()).toBeVisible()
  })

  test('breaking change is blocked and cannot be published', async ({ page }) => {
    await page.getByRole('button', { name: /Change field type/ }).click()
    await analyze(page)
    await expect(page.getByText('Blocked', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publishing not allowed' })).toBeDisabled()
    await expect(page.getByText('Not reached')).toBeVisible()
  })

  test('risky change needs review in production but is allowed in development', async ({ page }) => {
    await page.getByRole('button', { name: /Remove optional field/ }).click()
    await analyze(page)
    await expect(page.getByText('Held for review')).toBeVisible()

    await selectEnvironment(page, 'development')
    await expect(page.getByText('No analysis yet')).toBeVisible()
    await analyze(page)
    await expect(page.getByText('Safe to publish')).toBeVisible()
    await expect(page.getByText(/Medium-risk change permitted in development/)).toBeVisible()

    // Outside production the publish goes straight through.
    await page.getByRole('button', { name: 'Publish event' }).click()
    await expect(page.getByText('Published to the local in-memory publisher')).toBeVisible()
  })

  test('a payload missing a required field is rejected with guidance', async ({ page }) => {
    await selectEnvironment(page, 'staging')
    await page.getByLabel('Event payload (JSON)').fill('{"orderId": "ord-1"}')
    await analyze(page)
    await page.getByRole('button', { name: 'Publish event' }).click()
    await expect(page.getByText('Payload does not match the proposed contract')).toBeVisible()
    await expect(page.getByText("Missing required field: 'amount'.")).toBeVisible()
  })

  test('invalid JSON blocks analysis until fixed', async ({ page }) => {
    const editor = page.getByLabel('Event payload (JSON)')
    await editor.fill('{"orderId": ')
    await expect(page.getByText(/Invalid JSON/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Analyze compatibility/ })).toBeDisabled()
    await editor.fill('{"orderId": "x"}')
    await expect(page.getByRole('button', { name: /Analyze compatibility/ })).toBeEnabled()
  })

  test('exports the stored report for an analysis', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Downloads are covered on desktop')
    await analyze(page)
    await page.getByRole('button', { name: 'Export report' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('dialog').getByRole('button', { name: 'Download Markdown' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('eventgate-OrderPlaced-v1-v2.md')
  })

  test('keyboard: Ctrl+Enter analyzes and Ctrl+K opens commands', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard shortcuts target desktop')
    await page.keyboard.press('Control+Enter')
    await expect(page.getByText('Safe to publish')).toBeVisible()
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox', { name: 'Search commands' }).fill('Go to Policies')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/policies$/)
  })
})
