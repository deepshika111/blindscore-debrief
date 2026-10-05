export const ROOM_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export const SAMPLE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export interface RetentionRoom {
  id: string
  createdAt: string
  isDemo: boolean
}

export interface RetentionRow {
  collection: string
  id: string
  candidateId: string
}

export function expiredRoom(room: { createdAt: string; isDemo: boolean }, now: number): boolean {
  const created = Date.parse(room.createdAt)
  if (!Number.isFinite(created)) return false
  const window = room.isDemo ? SAMPLE_RETENTION_MS : ROOM_RETENTION_MS
  return now - created >= window
}

export function retentionPlan(rooms: RetentionRoom[], related: RetentionRow[], now: number): { rooms: string[]; rows: RetentionRow[] } {
  const doomed = new Set(rooms.filter((room) => expiredRoom(room, now)).map((room) => room.id))
  return {
    rooms: [...doomed],
    rows: related.filter((row) => doomed.has(row.candidateId)),
  }
}
