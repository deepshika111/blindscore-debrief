/**
 * Multi-user collaboration spec — verifies two users sign in into
 * separate browser contexts and the app distinguishes them.
 *
 * `users(2)` takes any two accounts from your pool, so this spec passes on a
 * fresh app with no setup beyond having two test accounts:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Ask for accounts *by name* (`users(['Alice', 'Bob'])`) only when the
 * behaviour under test depends on which identity acts — otherwise naming them
 * couples the spec to one machine's pool.
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

// A machine that has never created test accounts is the normal state of a
// fresh checkout, and there `users()` throws — turning "you have no pool yet"
// into three red tests about the app, which it is not. Skip the file instead
// and say what creates the pool. The count is of accounts usable HERE: the
// pool is global per developer, but passwords live only on the machine that
// created the account.
const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

test('each browser renders its own signed-in account', async ({ users }) => {
  const [a, b] = await users(2)

  // /home is dynamic (under src/pages/(app)/), so it mounts the nav shell;
  // '/' is the static landing and has no navigation.
  await Promise.all([a.page.goto('/home'), b.page.goto('/home')])

  // Email, not name. The page renders the *session's* `name || email`, while
  // `user.name` here comes from the LOCAL account registry — and the two are
  // not the same fact: a display name is optional, and an account recovered on
  // another machine has none stored locally at all. The email is the credential
  // the context signed in with, so it is the one identity both sides agree on,
  // and asserting it proves the page is showing THIS browser's account.
  // The two accounts are distinct, so two exact matches is also the proof that
  // the contexts are not sharing one session.
  for (const user of [a, b]) {
    await expect(user.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })

    // The identity chip shows `name || email`. Its text is not predictable, but
    // its presence is: something must be there once the profile has loaded.
    // (It is `hidden sm:inline` in some templates, so assert text, not
    // visibility.)
    await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })

    await user.page.getByRole('button', { name: 'Account menu' }).click()
    await expect(user.page.getByTestId('nav-user-email')).toHaveText(user.email, {
      timeout: 15_000,
    })
  }
})

test('API status page renders loading success and error states', async ({ users }) => {
  const [user] = await users(1)
  let shouldFail = false
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    if (shouldFail) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
      })
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { integrations: { openai: {}, wikipedia: {} } } }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()
  await expect(user.page.getByText('2 integrations available.')).toBeVisible()

  shouldFail = true
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect(user.page.getByText('Catalog unavailable')).toBeVisible()
  await expect(user.page.getByText('Showing the last loaded catalog')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})

test('API status page shows local retry after first-load API failure', async ({ users }) => {
  const [user] = await users(1)
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Could not load API data')).toBeVisible()
  await expect(user.page.getByText('Retried 1 time automatically.')).toBeVisible()

  const retryButton = user.page.getByRole('button', { name: 'Retry' })
  await expect(retryButton).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await retryButton.click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})

test('an outsider socket never receives a sealed scorecard phrase', async ({ users }) => {
  test.skip(
    usableTestAccounts < 3,
    `Needs 3 usable test accounts, found ${usableTestAccounts}.`,
  )

  const [hm, interviewer, outsider] = await users(3)
  const stamp = Date.now()
  const candidateName = `__test-${stamp}__`
  const sentinel = `SENTINEL-BOB-${stamp}`
  const hmFrames: string[] = []
  const outsiderFrames: string[] = []

  const collect = (frames: string[]) => (payload: string | Buffer) => {
    frames.push(typeof payload === 'string' ? payload : payload.toString())
  }
  hm.page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => collect(hmFrames)(frame.payload))
  })
  outsider.page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => collect(outsiderFrames)(frame.payload))
  })

  await hm.page.goto('/dashboard')
  await hm.page.getByTestId('new-candidate').click()
  await hm.page.getByLabel('Candidate').fill(candidateName)
  await hm.page.getByLabel('Role').fill('Backend engineer')
  await hm.page.getByLabel('Panel size').fill('3')
  await hm.page.getByRole('button', { name: 'Open room' }).click()
  await expect(hm.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })

  const invite = await hm.page.getByTestId('invite-link').inputValue()
  await interviewer.page.goto(invite)
  await interviewer.page.getByTestId('join-panel').click()
  await expect(interviewer.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })

  for (const dimension of ['Technical', 'System design', 'Communication']) {
    await hm.page.getByRole('group', { name: dimension }).getByRole('button', { name: /Strong yes/ }).click()
  }
  await hm.page.getByLabel('Recommendation').click()
  await hm.page.getByRole('option', { name: 'Lean yes' }).click()
  await hm.page.getByLabel('Strengths').fill(sentinel)
  await hm.page.getByLabel('Concerns').fill('Needs a clearer rollout plan.')
  await hm.page.getByTestId('seal-scorecard').click()
  await hm.page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(hm.page.getByTestId('submission-progress')).toHaveText('1 / 3 submitted', { timeout: 20_000 })

  const roomPath = new URL(hm.page.url()).pathname
  await outsider.page.goto(roomPath)
  await expect(outsider.page.getByTestId('room-not-found')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => outsiderFrames.length, { timeout: 15_000 }).toBeGreaterThan(0)
  expect(outsiderFrames.join('\n')).not.toContain(sentinel)

  await hm.page.getByTestId('force-reveal').click()
  await hm.page.getByRole('button', { name: 'Reveal', exact: true }).click()
  await expect(hm.page.getByText(sentinel)).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => hmFrames.join('\n').includes(sentinel), { timeout: 15_000 }).toBe(true)
  expect(outsiderFrames.join('\n')).not.toContain(sentinel)
})
