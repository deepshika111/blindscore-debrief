import { describe, expect, it } from 'vitest'
import { debriefIcs, debriefUid, unfoldIcs } from './calendar'

const room = 'https://blindscore.app.space/c/room-1'

function field(lines: string[], name: string): string {
  const line = lines.find((entry) => entry.startsWith(`${name}:`))
  return line?.slice(name.length + 1) ?? ''
}

describe('debrief calendar', () => {
  it('writes one UTC event with a stable id and the room url', () => {
    const ics = debriefIcs({
      candidateId: 'room-1',
      candidate: 'Ada',
      role: 'Engineer',
      meetingAt: '2026-10-06T15:30:00.000Z',
      meetingMinutes: 45,
      sequence: 0,
      roomUrl: room,
      now: '2026-10-05T12:00:00.000Z',
    })
    const lines = unfoldIcs(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines.at(-1)).toBe('END:VCALENDAR')
    expect(field(lines, 'UID')).toBe(debriefUid('room-1'))
    expect(field(lines, 'DTSTART')).toBe('20261006T153000Z')
    expect(field(lines, 'DTEND')).toBe('20261006T161500Z')
    expect(field(lines, 'SUMMARY')).toBe('Debrief: Ada — Engineer')
    expect(field(lines, 'DESCRIPTION')).toContain(room)
    expect(field(lines, 'URL')).toBe(room)
    expect(field(lines, 'SEQUENCE')).toBe('0')
    expect(ics).not.toContain('?t=')
  })

  it('keeps the same id and raises the sequence when the time changes', () => {
    const first = debriefIcs({
      candidateId: 'room-1',
      candidate: 'Ada',
      role: 'Engineer',
      meetingAt: '2026-10-06T15:30:00.000Z',
      meetingMinutes: 30,
      sequence: 0,
      roomUrl: room,
      now: '2026-10-05T12:00:00.000Z',
    })
    const next = debriefIcs({
      candidateId: 'room-1',
      candidate: 'Ada',
      role: 'Engineer',
      meetingAt: '2026-10-07T16:00:00.000Z',
      meetingMinutes: 30,
      sequence: 1,
      roomUrl: room,
      now: '2026-10-05T13:00:00.000Z',
    })
    expect(field(unfoldIcs(first), 'UID')).toBe(field(unfoldIcs(next), 'UID'))
    expect(field(unfoldIcs(next), 'SEQUENCE')).toBe('1')
    expect(field(unfoldIcs(next), 'DTSTART')).toBe('20261007T160000Z')
  })
})
