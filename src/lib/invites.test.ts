import { describe, expect, it } from 'vitest'
import { classifyInvite, hashToken, inviteMessage, mailtoHref, normalizeEmail } from './invites'

const future = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

describe('invites', () => {
  it('lowercases a valid email and rejects a bad one', () => {
    expect(normalizeEmail('Ada@Example.com')).toBe('ada@example.com')
    expect(normalizeEmail('')).toBe('')
    expect(normalizeEmail('not-an-email')).toBeNull()
  })

  it('hashes a token without keeping the raw value', async () => {
    const hash = await hashToken('token-a')
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain('token-a')
    expect(await hashToken('token-a')).toBe(hash)
    expect(await hashToken('token-b')).not.toBe(hash)
  })

  it('builds a mailto for one person and one link', () => {
    const message = inviteMessage('Ada', 'Engineer', 'https://blindscore.app.space/join/room?t=only-ada')
    expect(message.subject).toBe('Score Ada for Engineer')
    expect(message.body).toContain('only-ada')
    expect(message.body.match(/only-ada/g)).toHaveLength(1)
    const href = mailtoHref('Ada@Example.com', 'Ada', 'Engineer', 'https://blindscore.app.space/join/room?t=only-ada')
    expect(href.startsWith('mailto:Ada%40Example.com?')).toBe(true)
    expect(href).not.toContain('someone-else')
  })

  it('lets the same person reopen and rejects everyone else, revoked, and expired', () => {
    const now = Date.now()
    expect(classifyInvite({ status: 'pending', claimedBy: '', expiresAt: future }, 'ada', now)).toBe('claim')
    expect(classifyInvite({ status: 'claimed', claimedBy: 'ada', expiresAt: future }, 'ada', now)).toBe('reopen')
    expect(classifyInvite({ status: 'claimed', claimedBy: 'ada', expiresAt: future }, 'bob', now)).toBe('used')
    expect(classifyInvite({ status: 'revoked', claimedBy: '', expiresAt: future }, 'ada', now)).toBe('used')
    expect(classifyInvite({ status: 'pending', claimedBy: '', expiresAt: past }, 'ada', now)).toBe('used')
  })
})
