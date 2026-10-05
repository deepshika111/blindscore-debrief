import type { Env } from '../../worker'

/** Counts the call inside the record Durable Object. Over the limit returns false. */
export async function chargeRate(env: Env, key: string, limit: number, windowMs: number): Promise<boolean> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await stub.fetch(
    new Request('https://internal/blindscore/rate-limit', {
      method: 'POST',
      body: JSON.stringify({ key, limit, windowMs }),
    }),
  )
  const body = (await res.json().catch(() => null)) as { allowed?: boolean } | null
  return body?.allowed === true
}
