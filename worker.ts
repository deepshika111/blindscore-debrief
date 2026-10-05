/**
 * App Worker — explicit assembly for DeepSpace app routes and Durable Objects.
 *
 * Route implementations live under src/server. Keep their registration order
 * here: specific API and WebSocket handlers must precede the SPA fallback.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  armCronRoom,
  CanvasRoom,
  CronRoom,
  PresenceRoom,
  RecordRoom,
  workerErrorHandler,
  YjsRoom,
} from 'deepspace/worker'
import type { DOBindings, DOManifest } from 'deepspace/worker'
import { schemas } from './src/schemas.js'
import { registerActionRoutes } from './src/server/action-routes.js'
import {
  registerAuthAndIntegrationRoutes,
  registerPlatformProxyRoutes,
  registerStaticRoutes,
  resolveAuth,
} from './src/server/http-routes.js'
import { registerRealtimeRoutes } from './src/server/realtime-routes.js'
import { securityHeaders } from './src/lib/security-headers.js'
import { tasks as cronTasks, runTask as runCronTask } from './src/cron.js'

// Dynamic deploy reads this manifest to create the app's DO bindings.
export const __DO_MANIFEST__ = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
  { binding: 'CANVAS_ROOMS', className: 'AppCanvasRoom', sqlite: true },
  { binding: 'PRESENCE_ROOMS', className: 'AppPresenceRoom', sqlite: true },
  { binding: 'CRON_ROOMS', className: 'AppCronRoom', sqlite: true },
] as const satisfies DOManifest

export class AppRecordRoom extends RecordRoom<Env> {
  private readonly storage: DurableObjectStorage

  constructor(state: DurableObjectState, env: Env) {
    super(state, env, schemas, { ownerUserId: env.OWNER_USER_ID })
    this.storage = state.storage
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/blindscore/rate-limit' && request.method === 'POST') {
      return this.charge(request)
    }
    if (url.pathname === '/blindscore/claim-invite' && request.method === 'POST') {
      return this.claimInvite(request)
    }
    return super.fetch(request)
  }

  /** One request, so two callers cannot both pass the same window. */
  private async charge(request: Request): Promise<Response> {
    const body = (await request.json()) as { key?: unknown; limit?: unknown; windowMs?: unknown }
    const key = typeof body.key === 'string' ? body.key.slice(0, 200) : ''
    const limit = typeof body.limit === 'number' ? body.limit : 0
    const windowMs = typeof body.windowMs === 'number' ? body.windowMs : 0
    if (!key || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1) {
      return Response.json({ allowed: false })
    }
    const sql = this.storage.sql
    sql.exec(
      `CREATE TABLE IF NOT EXISTS blindscore_rate (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL
      )`,
    )
    const now = Date.now()
    const rows = sql
      .exec<{ window_start: number; count: number }>(
        `SELECT window_start, count FROM blindscore_rate WHERE key = ?`,
        key,
      )
      .toArray()
    const row = rows[0]
    if (!row || now - row.window_start >= windowMs) {
      sql.exec(
        `INSERT INTO blindscore_rate (key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
        key,
        now,
      )
      return Response.json({ allowed: true })
    }
    if (row.count >= limit) return Response.json({ allowed: false })
    sql.exec(`UPDATE blindscore_rate SET count = count + 1 WHERE key = ?`, key)
    return Response.json({ allowed: true })
  }

  /** Pending and unexpired rows only. A second caller sees the first claim. */
  private async claimInvite(request: Request): Promise<Response> {
    const body = (await request.json()) as { inviteId?: unknown; userId?: unknown; now?: unknown }
    const inviteId = typeof body.inviteId === 'string' ? body.inviteId : ''
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const now = typeof body.now === 'string' ? body.now : ''
    if (!inviteId || !userId || !now) return Response.json({ claimed: false })
    const sql = this.storage.sql
    try {
      sql.exec(
        `UPDATE "c_invites" SET "col_status" = 'claimed', "col_claimedby" = ?, "_updated_at" = ? WHERE "_row_id" = ? AND "col_status" = 'pending' AND "col_expiresat" > ?`,
        userId,
        now,
        inviteId,
        now,
      )
      const rows = sql
        .exec<{ claimed: string }>(`SELECT "col_claimedby" AS claimed FROM "c_invites" WHERE "_row_id" = ?`, inviteId)
        .toArray()
      return Response.json({ claimed: rows[0]?.claimed === userId })
    } catch {
      return Response.json({ claimed: false })
    }
  }
}

export class AppYjsRoom extends YjsRoom<Env> {}
export class AppCanvasRoom extends CanvasRoom<Env> {}
export class AppPresenceRoom extends PresenceRoom<Env> {}

export class AppCronRoom extends CronRoom<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, { tasks: cronTasks })
  }

  protected async onTask(taskName: string): Promise<void> {
    await runCronTask(taskName, this.env)
  }
}

export interface Env extends DOBindings<typeof __DO_MANIFEST__> {
  ASSETS: Fetcher
  /**
   * Platform service binding in production; deepspace dev supplies the URL
   * fallback. Standard app files use the platform's shared, app-scoped R2
   * bucket rather than a local binding.
   */
  PLATFORM_WORKER?: Fetcher
  PLATFORM_WORKER_URL?: string
  /**
   * HMAC app credential minted on first deploy. Proxy routes omit identity
   * headers when it is absent so upstream services fail closed.
   */
  APP_IDENTITY_TOKEN?: string
  /** API service binding in production with a deepspace-dev URL fallback. */
  API_WORKER?: Fetcher
  API_WORKER_URL?: string
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_JWT_ISSUER: string
  AUTH_WORKER_URL: string
  /** Comma-separated exact Expo/native callback URIs (for example, veriluma://auth/callback). */
  NATIVE_AUTH_REDIRECT_URIS?: string
  APP_NAME: string
  /** Immutable record-scope and platform identity. */
  DEEPSPACE_APP_ID: string
  OWNER_USER_ID: string
  /**
   * Long-lived owner JWT used for developer-billed server calls. User-billed
   * calls always forward the signed-in caller's JWT instead.
   */
  APP_OWNER_JWT: string
  /** Worker secret. Never commit the value. Sending stays off until both are set. */
  RESEND_API_KEY?: string
  /** Verified From address, for example "BlindScore <invites@example.com>". */
  RESEND_FROM?: string
  /**
   * Enables /api/debug/* only when exactly "true". The route still requires
   * an authenticated app owner/admin. deepspace dev/test set it locally.
   */
  ALLOW_DEBUG_ROUTES?: string
}

export type AppContext = { Bindings: Env }

function withSecurityHeaders(response: Response, pageUrl: string): Response {
  const headers = new Headers(response.headers)
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) {
    headers.delete('set-cookie')
    for (const cookie of cookies) headers.append('set-cookie', cookie)
  }
  for (const [name, value] of Object.entries(securityHeaders(pageUrl))) headers.set(name, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

const app = new Hono<AppContext>()
app.use('/api/*', cors())
// A Durable Object exists only once something fetches it, and CronRoom arms
// its alarm on that first fetch. Wake it from the request path so a deployed
// day can delete expired rooms without waiting for a visitor.
app.use('*', async (c, next) => {
  armCronRoom(c.executionCtx, c.env.CRON_ROOMS, `app:${c.env.DEEPSPACE_APP_ID}`, cronTasks)
  await next()
  if (c.res.status === 101 || c.res.webSocket) return
  c.res = withSecurityHeaders(c.res, c.req.url)
})

// Registration order is part of the worker contract. The wildcard auth route
// follows its special cases, and static is last. There is no assistant route:
// the only model call is generateDebrief, and only the hiring manager can make it.
// The cron room deletes expired rooms. It does not call the model.
registerAuthAndIntegrationRoutes(app)
registerRealtimeRoutes(app)
registerActionRoutes(app, resolveAuth)
registerPlatformProxyRoutes(app)
registerStaticRoutes(app)

// Hono registers ONE error handler (last onError wins), and its default is
// `console.error(err)` — whose message Workers Logs drops, keeping only the
// stack frames. workerErrorHandler logs the string form instead (message
// first, frames and bounded cause chain, method + path for context), keeps a
// response-bearing error's (HTTPException — auth 401s, upload 413s) own
// answer, and returns a generic 500 for the rest.
app.onError(workerErrorHandler('error'))

export default app
