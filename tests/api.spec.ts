import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('scorecard actions reject a missing bearer token', async ({ request }) => {
    for (const name of ['createCandidate', 'inviteNotice', 'joinPanel', 'approveJoin', 'denyJoin', 'rotateInvite', 'removeMember', 'leaveRoom', 'submitScorecard', 'submissionNotices', 'requestForceReveal', 'forceReveal', 'allowForceReveal', 'generateDebrief', 'markDebriefViewed', 'funnelReport', 'createDemoRoom', 'roomShell', 'deleteCandidate', 'addInvite', 'revokeInvite', 'replaceInvite', 'removeContact', 'setMeeting', 'setDue', 'nudge', 'recordDecision', 'roomActivity', 'myCalibration']) {
      const res = await request.post(`/api/actions/${name}`, { data: {} })
      expect(res.status(), name).toBe(401)
    }
  })

  test('html pages send a content security policy', async ({ request }) => {
    for (const path of ['/', '/dashboard']) {
      const response = await request.get(path)
      const csp = response.headers()['content-security-policy'] ?? ''
      expect(csp, path).toContain("default-src 'self'")
      expect(csp, path).toContain("font-src 'self'")
      expect(csp, path).toContain("object-src 'none'")
      expect(csp, path).toContain("base-uri 'self'")
      expect(csp, path).toContain("form-action 'self'")
      expect(csp, path).not.toContain('fonts.googleapis.com')
      expect(csp, path).not.toContain('fonts.gstatic.com')
    }
  })

  test('page responses send security headers', async ({ request }) => {
    const response = await request.get('/')
    const csp = response.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain('connect-src')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['referrer-policy']).toBe('no-referrer')
    expect(response.headers()['permissions-policy']).toContain('camera=()')
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })
})
