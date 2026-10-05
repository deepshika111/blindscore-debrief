import type { Env } from '../../worker'

/** One Durable Object update. Only a still-pending, unexpired invite changes. */
export async function claimInvite(env: Env, inviteId: string, userId: string): Promise<boolean> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const now = new Date().toISOString()
  const res = await stub.fetch(
    new Request('https://internal/blindscore/claim-invite', {
      method: 'POST',
      body: JSON.stringify({ inviteId, userId, now }),
    }),
  )
  const body = (await res.json().catch(() => null)) as { claimed?: boolean } | null
  return body?.claimed === true
}
