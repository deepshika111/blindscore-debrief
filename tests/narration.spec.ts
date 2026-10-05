/**
 * Records demo/raw.webm for the narrated walkthrough.
 * Skipped unless PLAYWRIGHT_NARRATE=1.
 */
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { test, expect, ensureStorageState, findTestAccountByName } from 'deepspace/testing'

test.skip(process.env.PLAYWRIGHT_NARRATE !== '1', 'Set PLAYWRIGHT_NARRATE=1 to record the narrated demo')

test('record the sample debrief walkthrough', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  if (!baseURL) throw new Error('baseURL is required')
  const dir = path.resolve(process.cwd(), '..', 'demo')
  await mkdir(dir, { recursive: true })
  const account = findTestAccountByName('hm')
  const storageState = await ensureStorageState(browser, account, baseURL)
  const context = await browser.newContext({
    storageState,
    baseURL,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir, size: { width: 1280, height: 800 } },
  })
  const page = await context.newPage()
  const video = page.video()

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(7000)
  await page.getByTestId('sample-debrief').click()
  await expect(page.getByTestId('room-title')).toHaveText('Sample candidate', { timeout: 20_000 })
  await expect(page.getByTestId('discuss-first')).toBeVisible()
  await page.waitForTimeout(16000)
  await page.getByText('Overall').scrollIntoViewIfNeeded().catch(() => undefined)
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(16000)
  await page.getByRole('heading', { name: 'Debrief' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(18000)
  await page.goto('/funnel')
  await expect(page.getByRole('heading', { name: 'Activation' })).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(22000)

  const dest = path.join(dir, 'raw.webm')
  const raw = video ? await video.path() : null
  await context.close()
  if (video) await video.saveAs(dest)
  if (raw && raw !== dest) await unlink(raw).catch(() => undefined)
})
