import { describe, expect, it } from 'vitest'
import { dueLabel, nudgeText } from './due'

describe('due label', () => {
  const now = Date.parse('2026-10-05T12:00:00.000Z')

  it('counts forward and switches to overdue after the time', () => {
    expect(dueLabel('2026-10-05T18:00:00.000Z', now)).toBe('Scores due in 6 hours')
    expect(dueLabel('2026-10-08T12:00:00.000Z', now)).toBe('Scores due in 3 days')
    expect(dueLabel('2026-10-05T11:00:00.000Z', now)).toBe('Overdue')
  })

  it('puts only the room link in a nudge', () => {
    const text = nudgeText('Ada', 'Engineer', 'https://blindscore.app.space/c/room-1')
    expect(text).toContain('/c/room-1')
    expect(text).not.toContain('?t=')
  })
})