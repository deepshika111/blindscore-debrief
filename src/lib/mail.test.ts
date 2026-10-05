import { describe, expect, it } from 'vitest'
import { inviteMail, safeOrigin } from './mail'

describe('invite mail', () => {
  it('keeps each person on their own link', () => {
    const ada = inviteMail({
      candidate: 'Ada',
      role: 'Engineer',
      link: 'https://blindscore.app.space/join/room?t=ada-token',
      ics: 'BEGIN:VCALENDAR\nURL:https://blindscore.app.space/c/room\nEND:VCALENDAR\n',
    })
    const bo = inviteMail({
      candidate: 'Ada',
      role: 'Engineer',
      link: 'https://blindscore.app.space/join/room?t=bo-token',
    })
    expect(ada.text).toContain('ada-token')
    expect(ada.text).not.toContain('bo-token')
    expect(bo.text).not.toContain('ada-token')
    expect(ada.attachment?.content).toContain('/c/room')
    expect(ada.attachment?.content).not.toContain('ada-token')
    expect(ada.subject).toBe('Score Ada for Engineer')
  })

  it('accepts only an origin', () => {
    expect(safeOrigin('https://blindscore.app.space')).toBe('https://blindscore.app.space')
    expect(safeOrigin('https://blindscore.app.space/join/room?t=secret')).toBeNull()
    expect(safeOrigin('javascript:alert(1)')).toBeNull()
  })
})