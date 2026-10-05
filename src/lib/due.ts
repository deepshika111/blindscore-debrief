export function dueLabel(dueAt: string, now: number): string {
  const due = Date.parse(dueAt)
  if (!Number.isFinite(due)) return ''
  if (due <= now) return 'Overdue'
  const hours = Math.max(1, Math.ceil((due - now) / 3_600_000))
  if (hours < 48) return `Scores due in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const days = Math.ceil(hours / 24)
  return `Scores due in ${days} days`
}

export function nudgeText(candidate: string, role: string, roomUrl: string): string {
  return `Scores for ${candidate} (${role}) are still open. Your room: ${roomUrl}`
}
