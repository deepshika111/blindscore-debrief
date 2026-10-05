/**
 * Records demo/*.webm of the three-account reveal.
 * Skipped unless PLAYWRIGHT_DEMO=1, so a normal Playwright run does not
 * spend a model call or rewrite the videos.
 */
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { test, expect, ensureStorageState, findTestAccountByName } from 'deepspace/testing'
import type { Browser, BrowserContext, Page, Video } from '@playwright/test'

test.skip(process.env.PLAYWRIGHT_DEMO !== '1', 'Set PLAYWRIGHT_DEMO=1 to record demo/*.webm')

test('record the hiring-manager, interviewer, and outsider screens', async ({ browser, baseURL }) => {
  test.setTimeout(150_000)
  if (!baseURL) throw new Error('baseURL is required')
  const dir = path.resolve(process.cwd(), '..', 'demo')
  await mkdir(dir, { recursive: true })

  const hm = await open(browser, baseURL, 'hm', dir)
  const interviewer = await open(browser, baseURL, 'interviewer', dir)
  const outsider = await open(browser, baseURL, 'outsider', dir)

  const candidateName = `__test-${Date.now()}__`
  await hm.page.goto('/dashboard')
  await hm.page.getByTestId('new-candidate').click()
  await hm.page.getByRole('textbox', { name: 'Candidate', exact: true }).fill(candidateName)
  await hm.page.getByLabel('Role').fill('Backend engineer')
  await hm.page.getByLabel('Panel size').fill('3')
  await hm.page.getByRole('button', { name: 'Open room' }).click()
  await expect(hm.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })
  await hm.page.getByRole('button', { name: 'Allow force reveal to panel members' }).click()
  await expect(hm.page.getByText('The panel can force reveal.')).toBeVisible()
  await hm.page.waitForTimeout(1200)

  const invite = await hm.page.getByTestId('invite-link').inputValue()
  await interviewer.page.goto(invite)
  await interviewer.page.getByLabel('Name on the panel').fill('Interviewer')
  await interviewer.page.getByTestId('join-panel').click()
  await expect(hm.page.getByRole('button', { name: 'Approve Interviewer' })).toBeVisible({ timeout: 20_000 })
  await hm.page.getByRole('button', { name: 'Approve Interviewer' }).click()
  await expect(interviewer.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })
  await interviewer.page.waitForTimeout(800)

  for (const dimension of ['Technical', 'System design', 'Communication']) {
    await hm.page.getByRole('group', { name: dimension }).getByRole('button', { name: /Strong yes/ }).click()
  }
  await hm.page.getByLabel('Recommendation').click()
  await hm.page.getByRole('option', { name: 'Lean yes' }).click()
  await hm.page.getByLabel('Strengths').fill('Clear on the data model.')
  await hm.page.getByLabel('Concerns').fill('Needs a clearer rollout plan.')
  await hm.page.getByTestId('seal-scorecard').click()
  await hm.page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(hm.page.getByTestId('submission-progress')).toHaveText('1 / 3 submitted', { timeout: 20_000 })

  const roomPath = new URL(hm.page.url()).pathname
  await outsider.page.goto(roomPath)
  await expect(outsider.page.getByTestId('room-not-found')).toBeVisible({ timeout: 20_000 })
  await outsider.page.waitForTimeout(1200)

  await hm.page.getByTestId('force-reveal').click()
  await hm.page.getByRole('button', { name: 'Reveal', exact: true }).click()
  await expect(hm.page.getByText('Needs a clearer rollout plan.')).toBeVisible({ timeout: 20_000 })
  await hm.page.getByText(/AI summary unavailable|Consensus/).waitFor({ timeout: 45_000 }).catch(() => undefined)
  await hm.page.waitForTimeout(1500)

  await save(hm, path.join(dir, 'hiring-manager.webm'))
  await save(interviewer, path.join(dir, 'interviewer.webm'))
  await save(outsider, path.join(dir, 'outsider.webm'))
})

async function open(browser: Browser, baseURL: string, name: string, dir: string) {
  const account = findTestAccountByName(name)
  const storageState = await ensureStorageState(browser, account, baseURL)
  const context = await browser.newContext({
    storageState,
    baseURL,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir, size: { width: 1280, height: 800 } },
  })
  const page = await context.newPage()
  return { context, page, video: page.video() }
}

async function save(session: { context: BrowserContext; page: Page; video: Video | null }, dest: string) {
  const video = session.video
  const raw = video ? await video.path() : null
  await session.context.close()
  if (video) await video.saveAs(dest)
  if (raw && raw !== dest) await unlink(raw).catch(() => undefined)
}
