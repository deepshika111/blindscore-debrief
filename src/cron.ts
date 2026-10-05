import { buildCronContext, type CronTask } from 'deepspace/worker'
import { expiredRoom } from './lib/retention'
import type { Env } from '../worker'

export const tasks: CronTask[] = [
  { name: 'retain-rooms', schedule: '0 9 * * *', timezone: 'America/New_York' },
]

const RELATED = ['scorecards', 'submissions', 'invites', 'events', 'auditLog'] as const
const BY_ID = ['reveals', 'debriefs', 'decisions'] as const

interface StoredRow {
  recordId: string
  createdAt: string
  data: { isDemo?: unknown }
}

function asRows(value: unknown): StoredRow[] {
  if (!Array.isArray(value)) return []
  const rows: StoredRow[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { recordId?: unknown; createdAt?: unknown; data?: unknown }
    if (typeof row.recordId !== 'string') continue
    const createdAt = typeof row.createdAt === 'string' ? row.createdAt : ''
    const data = row.data && typeof row.data === 'object' ? row.data as { isDemo?: unknown } : {}
    rows.push({ recordId: row.recordId, createdAt, data })
  }
  return rows
}

function isDemo(value: unknown): boolean {
  return value === true || value === 1 || value === 'yes'
}

export async function runTask(taskName: string, env: Env): Promise<void> {
  if (taskName !== 'retain-rooms') return
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
  const rooms = asRows(await ctx.records.query('candidates', { limit: 200 }))
  const now = Date.now()
  for (const room of rooms) {
    if (!room.createdAt || !expiredRoom({ createdAt: room.createdAt, isDemo: isDemo(room.data.isDemo) }, now)) continue
    for (const collection of RELATED) {
      const rows = asRows(await ctx.records.query(collection, { where: { candidateId: room.recordId }, limit: 100 }))
      for (const row of rows) await ctx.records.delete(collection, row.recordId)
    }
    for (const collection of BY_ID) await ctx.records.delete(collection, room.recordId)
    await ctx.records.delete('candidates', room.recordId)
  }
}
