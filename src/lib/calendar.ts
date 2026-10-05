export interface DebriefEvent {
  candidateId: string
  candidate: string
  role: string
  meetingAt: string
  meetingMinutes: number
  sequence: number
  roomUrl: string
  now?: string
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function icsStamp(iso: string): string {
  const date = new Date(iso)
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function icsText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
}

function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  parts.push(line.slice(0, 75))
  let rest = line.slice(75)
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  return parts.join('\r\n')
}

export function debriefUid(candidateId: string): string {
  return `debrief-${candidateId}@blindscore.app.space`
}

export function debriefIcs(event: DebriefEvent): string {
  const start = new Date(event.meetingAt)
  const end = new Date(start.getTime() + event.meetingMinutes * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BlindScore//Debrief//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${debriefUid(event.candidateId)}`,
    `DTSTAMP:${icsStamp(event.now ?? new Date().toISOString())}`,
    `DTSTART:${icsStamp(start.toISOString())}`,
    `DTEND:${icsStamp(end.toISOString())}`,
    `SUMMARY:${icsText(`Debrief: ${event.candidate} — ${event.role}`)}`,
    `DESCRIPTION:${icsText(`Debrief room: ${event.roomUrl}`)}`,
    `URL:${event.roomUrl}`,
    `SEQUENCE:${event.sequence}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export function unfoldIcs(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n').filter((line) => line.length > 0)
}
