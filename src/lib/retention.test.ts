import { describe, expect, it } from 'vitest'
import { ROOM_RETENTION_MS, SAMPLE_RETENTION_MS, retentionPlan } from './retention'

describe('retention', () => {
  const now = Date.parse('2026-10-05T00:00:00.000Z')

  it('deletes an old room and its related rows, and keeps a newer one', () => {
    const old = new Date(now - ROOM_RETENTION_MS - 1000).toISOString()
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
    const sample = new Date(now - SAMPLE_RETENTION_MS - 1000).toISOString()
    const plan = retentionPlan(
      [
        { id: 'old-room', createdAt: old, isDemo: false },
        { id: 'new-room', createdAt: recent, isDemo: false },
        { id: 'sample-room', createdAt: sample, isDemo: true },
      ],
      [
        { collection: 'scorecards', id: 'card-old', candidateId: 'old-room' },
        { collection: 'scorecards', id: 'card-new', candidateId: 'new-room' },
        { collection: 'invites', id: 'invite-sample', candidateId: 'sample-room' },
      ],
      now,
    )
    expect(plan.rooms).toEqual(['old-room', 'sample-room'])
    expect(plan.rows.map((row) => row.id)).toEqual(['card-old', 'invite-sample'])
  })
})