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
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

async function postAction(page: Page, name: string, params: Record<string, unknown>) {
  return page.evaluate(async ({ name, params }) => {
    const tokenRes = await fetch('/api/auth/token', { method: 'POST', credentials: 'include' })
    const tokenBody = (await tokenRes.json()) as { token?: string }
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBody.token ?? ''}`,
      },
      body: JSON.stringify(params),
    })
    return { status: res.status, text: await res.text() }
  }, { name, params })
}

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

test('sealed scorecards stay off the socket and out of pre-reveal HTTP responses', async ({ users }) => {
  test.setTimeout(120_000)
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
  await hm.page.getByRole('textbox', { name: 'Candidate', exact: true }).fill(candidateName)
  await hm.page.getByLabel('Role').fill('Backend engineer')
  await hm.page.getByLabel('Panelist 1').fill('Interviewer')
  await hm.page.getByRole('button', { name: 'Add panelist' }).click()
  await hm.page.getByLabel('Panelist 2').fill('Spare')
  await hm.page.getByRole('button', { name: 'Open room' }).click()
  await expect(hm.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })

  const invite = await hm.page.getByTestId('invite-link').inputValue()
  await interviewer.page.goto(invite)
  await expect(interviewer.page.getByRole('status')).toContainText(`You're invited to score ${candidateName}`, { timeout: 20_000 })
  await interviewer.page.getByLabel('Name on the panel').fill('Interviewer')
  await interviewer.page.getByTestId('join-panel').click()
  await expect(interviewer.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })
  await interviewer.page.getByRole('button', { name: 'Request force reveal' }).click()
  await expect(hm.page.getByRole('alert').filter({ hasText: 'Interviewer is requesting force reveal' })).toBeVisible({ timeout: 15_000 })

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

  for (const dimension of ['Technical', 'System design', 'Communication']) {
    await interviewer.page.getByRole('group', { name: dimension }).getByRole('button', { name: /Strong yes/ }).click()
  }
  await interviewer.page.getByLabel('Recommendation').click()
  await interviewer.page.getByRole('option', { name: 'Lean yes' }).click()
  await interviewer.page.getByLabel('Strengths').fill('Clear on the data model.')
  await interviewer.page.getByLabel('Concerns').fill('Thin on rollout.')
  await interviewer.page.getByTestId('seal-scorecard').click()
  await interviewer.page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(hm.page.getByRole('alert').filter({ hasText: 'Interviewer submitted' })).toBeVisible({ timeout: 15_000 })

  const roomPath = new URL(hm.page.url()).pathname
  const candidateId = roomPath.split('/').pop() ?? ''
  await outsider.page.goto(roomPath)
  await expect(outsider.page.getByTestId('room-not-found')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => outsiderFrames.length, { timeout: 15_000 }).toBeGreaterThan(0)
  expect(outsiderFrames.join('\n')).not.toContain(sentinel)

  const denied = await postAction(interviewer.page, 'deleteCandidate', { candidateId })
  expect(denied.status).toBe(403)
  expect(denied.text).not.toContain(sentinel)
  for (const name of ['roomShell', 'forceReveal'] as const) {
    const outsiderBody = await postAction(outsider.page, name, { candidateId })
    expect(outsiderBody.status, `outsider ${name}`).toBe(404)
    expect(outsiderBody.text, `outsider ${name}`).not.toContain(sentinel)
    expect(outsiderBody.text, `outsider ${name}`).not.toContain('Needs a clearer rollout plan.')

    const memberBody = await postAction(interviewer.page, name, { candidateId })
    expect(memberBody.text, `panel ${name}`).not.toContain(sentinel)
    expect(memberBody.text, `panel ${name}`).not.toContain('Needs a clearer rollout plan.')
    if (name === 'forceReveal') expect(memberBody.text).toContain('reveal_not_allowed')
  }

  await hm.page.getByTestId('force-reveal').click()
  await hm.page.getByRole('button', { name: 'Reveal', exact: true }).click()
  await expect(hm.page.getByText('Needs a clearer rollout plan.')).toBeVisible({ timeout: 20_000 })
  await expect(interviewer.page.getByText('Needs a clearer rollout plan.')).toBeVisible({ timeout: 20_000 })
  await expect(interviewer.page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect.poll(() => hmFrames.join('\n').includes(sentinel), { timeout: 15_000 }).toBe(true)
  expect(outsiderFrames.join('\n')).not.toContain(sentinel)

  const late = await postAction(interviewer.page, 'submitScorecard', { candidateId })
  expect(late.status).toBe(409)
  expect(late.text).toContain('Room already revealed')
  expect(late.text).not.toContain(sentinel)
})

test('submit stays active and names each missing field', async ({ users }) => {
  test.setTimeout(60_000)
  const [hm] = await users(1)
  const candidateName = `__test-${Date.now()}__`
  await hm.page.goto('/dashboard')
  await hm.page.getByTestId('new-candidate').click()
  await hm.page.getByRole('textbox', { name: 'Candidate', exact: true }).fill(candidateName)
  await hm.page.getByLabel('Role').fill('Backend engineer')
  await hm.page.getByLabel('Panelist 1').fill('Interviewer')
  await hm.page.getByRole('button', { name: 'Open room' }).click()
  await expect(hm.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })

  await expect(hm.page.getByTestId('seal-scorecard')).toBeEnabled()
  await hm.page.getByTestId('seal-scorecard').click()
  await expect(hm.page.getByRole('alert').filter({ hasText: 'Fill in Technical.' })).toBeVisible()
  await expect(hm.page.getByRole('button', { name: 'Submit', exact: true })).toHaveCount(0)

  await hm.page.getByRole('group', { name: 'Technical' }).getByRole('button', { name: /Strong yes/ }).click()
  await hm.page.getByTestId('seal-scorecard').click()
  await expect(hm.page.getByRole('alert').filter({ hasText: 'Fill in System design.' })).toBeVisible()
  await expect(hm.page.getByRole('alert').filter({ hasText: 'Fill in Technical.' })).toHaveCount(0)
})

test('sample debrief opens on the split without a second account', async ({ users }) => {
  test.setTimeout(60_000)
  const [hm] = await users(1)
  await hm.page.goto('/dashboard')
  await hm.page.getByTestId('sample-debrief').click()
  await expect(hm.page.getByTestId('room-title')).toHaveText('Sample candidate', { timeout: 20_000 })
  await expect(hm.page.getByTestId('discuss-first')).toContainText('Technical')
  await expect(hm.page.getByTestId('discuss-first')).toContainText('System design')
  await expect(hm.page.getByTestId('discuss-first')).not.toContainText('Communication')
  await expect(hm.page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await hm.page.goto('/admin/funnel')
  await expect(hm.page.getByRole('heading', { name: 'Activation' })).toBeVisible()
})

test('two last submissions leave one snapshot with both cards', async ({ users }) => {
  test.setTimeout(90_000)
  const [hm, interviewer] = await users(2)
  const candidateName = `__test-${Date.now()}__`
  await hm.page.goto('/dashboard')
  await hm.page.getByTestId('new-candidate').click()
  await hm.page.getByRole('textbox', { name: 'Candidate', exact: true }).fill(candidateName)
  await hm.page.getByLabel('Role').fill('Backend engineer')
  await hm.page.getByLabel('Panelist 1').fill('Interviewer')
  await hm.page.getByRole('button', { name: 'Open room' }).click()
  await expect(hm.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })
  const candidateId = new URL(hm.page.url()).pathname.split('/').pop() ?? ''
  const invite = await hm.page.getByTestId('invite-link').inputValue()
  await interviewer.page.goto(invite)
  await interviewer.page.getByLabel('Name on the panel').fill('Interviewer')
  await interviewer.page.getByTestId('join-panel').click()
  await expect(interviewer.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })

  const card = {
    candidateId,
    scores: { technical: 4, systemDesign: 2, communication: 3 },
    recommendation: 'lean_yes',
    concerns: 'Needs a rollout.',
  }
  const [first, second] = await Promise.all([
    postAction(hm.page, 'submitScorecard', { ...card, strengths: 'Manager note.' }),
    postAction(interviewer.page, 'submitScorecard', { ...card, strengths: 'Interviewer note.' }),
  ])
  expect([first.status, second.status].every((status) => status === 200 || status === 409)).toBe(true)
  const shell = await postAction(hm.page, 'roomShell', { candidateId })
  expect(shell.status).toBe(200)
  const parsed = JSON.parse(shell.text) as { data?: { cards?: Array<{ strengths: string }> } }
  const strengths = (parsed.data?.cards ?? []).map((entry) => entry.strengths).sort()
  expect(strengths).toEqual(['Interviewer note.', 'Manager note.'])
})

test('deny, rotate, leave, and remove stay off the panel, and the funnel is owner-only', async ({ users }) => {
  test.setTimeout(90_000)
  const [hm, interviewer] = await users(2)
  const candidateName = `__test-${Date.now()}__`
  await hm.page.goto('/dashboard')
  await hm.page.getByTestId('new-candidate').click()
  await hm.page.getByRole('textbox', { name: 'Candidate', exact: true }).fill(candidateName)
  await hm.page.getByLabel('Role').fill('Backend engineer')
  await hm.page.getByLabel('Allow open link').check()
  await hm.page.getByLabel('Panelist 1').fill('Spare')
  await hm.page.getByRole('button', { name: 'Open room' }).click()
  await expect(hm.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })
  const candidateId = new URL(hm.page.url()).pathname.split('/').pop() ?? ''
  await expect(hm.page.getByTestId('open-invite-link')).not.toHaveValue('', { timeout: 20_000 })
  const invite = await hm.page.getByTestId('open-invite-link').inputValue()
  const inviteCode = new URL(invite).searchParams.get('code') ?? ''

  await interviewer.page.goto(invite)
  await interviewer.page.getByLabel('Name on the panel').fill('Interviewer')
  await interviewer.page.getByTestId('join-panel').click()
  await expect(interviewer.page.getByTestId('join-waiting')).toBeVisible()

  const waiting = await postAction(hm.page, 'roomShell', { candidateId })
  const waitingBody = JSON.parse(waiting.text) as {
    data?: { pending?: Array<{ userId: string }>; roster?: Array<{ userId: string }> }
  }
  const memberId = waitingBody.data?.pending?.[0]?.userId ?? ''
  expect(memberId).not.toBe('')
  expect(waitingBody.data?.roster ?? []).toEqual([])

  const denied = await postAction(hm.page, 'denyJoin', { candidateId, userId: memberId })
  expect(denied.status).toBe(200)
  expect(JSON.parse(denied.text)).toMatchObject({ success: true, data: { denied: true } })
  const hidden = await postAction(interviewer.page, 'roomShell', { candidateId })
  expect(hidden.status).toBe(404)

  const again = await postAction(interviewer.page, 'joinPanel', { candidateId, inviteCode, displayName: 'Interviewer' })
  expect(JSON.parse(again.text)).toMatchObject({ success: true, data: { pending: true } })
  const approved = await postAction(hm.page, 'approveJoin', { candidateId, userId: memberId })
  expect(approved.status).toBe(200)
  expect(JSON.parse(approved.text)).toMatchObject({ success: true, data: { approved: true } })
  const inside = await postAction(interviewer.page, 'roomShell', { candidateId })
  expect(inside.status).toBe(200)

  const rotated = await postAction(hm.page, 'rotateInvite', { candidateId })
  expect(rotated.status).toBe(200)
  const nextCode = (JSON.parse(rotated.text) as { data?: { inviteCode?: string } }).data?.inviteCode ?? ''
  expect(nextCode).not.toBe(inviteCode)
  const stale = await postAction(interviewer.page, 'joinPanel', { candidateId, inviteCode, displayName: 'Interviewer' })
  expect(stale.text).toContain('bad_code')

  const left = await postAction(interviewer.page, 'leaveRoom', { candidateId })
  expect(left.status).toBe(200)
  expect(JSON.parse(left.text)).toMatchObject({ success: true, data: { left: true } })
  const afterLeave = await postAction(interviewer.page, 'roomShell', { candidateId })
  expect(afterLeave.status).toBe(404)

  const rejoined = await postAction(interviewer.page, 'joinPanel', { candidateId, inviteCode: nextCode, displayName: 'Interviewer' })
  expect(JSON.parse(rejoined.text)).toMatchObject({ success: true, data: { pending: true } })
  const reapproved = await postAction(hm.page, 'approveJoin', { candidateId, userId: memberId })
  expect(reapproved.status).toBe(200)
  const removed = await postAction(hm.page, 'removeMember', { candidateId, userId: memberId })
  expect(removed.status).toBe(200)
  expect(JSON.parse(removed.text)).toMatchObject({ success: true, data: { removed: true } })
  const afterRemove = await postAction(interviewer.page, 'roomShell', { candidateId })
  expect(afterRemove.status).toBe(404)

  const funnel = await postAction(interviewer.page, 'funnelReport', {})
  expect(funnel.status).toBe(403)
})

test('a claimed invite cannot be reused, and the token is not in later reads', async ({ users }) => {
  test.setTimeout(90_000)
  test.skip(usableTestAccounts < 3, `Needs 3 usable test accounts, found ${usableTestAccounts}.`)
  const [hm, interviewer, outsider] = await users(3)
  const candidateName = `__test-${Date.now()}__`
  await hm.page.goto('/dashboard')
  await hm.page.getByTestId('new-candidate').click()
  await hm.page.getByRole('textbox', { name: 'Candidate', exact: true }).fill(candidateName)
  await hm.page.getByLabel('Role').fill('Backend engineer')
  await hm.page.getByLabel('Panelist 1').fill('Interviewer')
  await hm.page.getByRole('button', { name: 'Open room' }).click()
  await expect(hm.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })
  const candidateId = new URL(hm.page.url()).pathname.split('/').pop() ?? ''
  const invite = await hm.page.getByTestId('invite-link').inputValue()
  const token = new URL(invite).searchParams.get('t') ?? ''
  expect(token.length).toBeGreaterThan(20)
  await expect(hm.page.getByTestId('invite-email')).toBeVisible({ timeout: 20_000 })
  const mail = await hm.page.getByTestId('invite-email').getAttribute('href')
  expect(mail).toContain(encodeURIComponent(`Score ${candidateName} for Backend engineer`))
  expect(mail).toContain(token)
  expect(mail?.split(token).length).toBe(2)
  await expect(hm.page.getByTestId('email-next')).toBeVisible()

  await interviewer.page.goto(invite)
  await interviewer.page.getByLabel('Name on the panel').fill('Interviewer')
  await interviewer.page.getByTestId('join-panel').click()
  await expect(interviewer.page.getByTestId('room-title')).toHaveText(candidateName, { timeout: 20_000 })
  expect(interviewer.page.url()).not.toContain('t=')

  await outsider.page.goto('/dashboard')
  const stolen = await postAction(outsider.page, 'joinPanel', { candidateId, token, displayName: 'Outsider' })
  expect(stolen.status).toBe(403)
  expect(stolen.text).toContain('already used')

  const again = await postAction(interviewer.page, 'joinPanel', { candidateId, token, displayName: 'Interviewer' })
  expect(again.status).toBe(200)
  expect(JSON.parse(again.text)).toMatchObject({ success: true, data: { joined: true } })

  const shell = await postAction(hm.page, 'roomShell', { candidateId })
  expect(shell.text).not.toContain(token)
  const inviteId = (JSON.parse(shell.text) as { data?: { invites?: Array<{ id: string }> } }).data?.invites?.[0]?.id ?? ''
  expect(inviteId).not.toBe('')

  const revoked = await postAction(hm.page, 'revokeInvite', { candidateId, inviteId })
  expect(revoked.status).toBe(200)
  const after = await postAction(interviewer.page, 'joinPanel', { candidateId, token, displayName: 'Interviewer' })
  expect(after.status).toBe(403)
})
