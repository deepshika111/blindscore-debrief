const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type InviteView = 'claim' | 'reopen' | 'used'

/** Empty string means no email. Null means the value is not an email. */
export function normalizeEmail(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email) return ''
  if (email.length > 200 || !EMAIL.test(email)) return null
  return email
}

export function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function inviteMessage(candidate: string, role: string, url: string): { subject: string; body: string } {
  return {
    subject: `Score ${candidate} for ${role}`,
    body: `Your link is only for you. Open it to score ${candidate} for ${role}:\n${url}`,
  }
}

export function mailtoHref(email: string, candidate: string, role: string, url: string): string {
  const message = inviteMessage(candidate, role, url)
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`
}

export function classifyInvite(
  row: { status: string; claimedBy: string; expiresAt: string },
  userId: string,
  now: number,
): InviteView {
  if (row.status === 'revoked') return 'used'
  if (row.status === 'claimed') return row.claimedBy === userId ? 'reopen' : 'used'
  const expires = Date.parse(row.expiresAt)
  if (!Number.isFinite(expires) || expires <= now) return 'used'
  if (row.status === 'pending') return 'claim'
  return 'used'
}
