export interface CalibrationMetric {
  key: string
  label: string
  mine: number
  others: number[]
}

export interface CalibrationRoom {
  metrics: CalibrationMetric[]
}

export interface CalibrationLine {
  key: string
  label: string
  delta: number
}

export type Calibration = { ready: false } | { ready: true; lines: CalibrationLine[] }

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Average, per metric, of this person's score minus the median of the other panelists. */
export function calibrate(rooms: CalibrationRoom[]): Calibration {
  if (rooms.length < 3) return { ready: false }
  const byKey = new Map<string, { label: string; deltas: number[] }>()
  for (const room of rooms) {
    for (const metric of room.metrics) {
      if (metric.others.length === 0) continue
      const bucket = byKey.get(metric.key) ?? { label: metric.label, deltas: [] }
      bucket.deltas.push(metric.mine - median(metric.others))
      byKey.set(metric.key, bucket)
    }
  }
  return {
    ready: true,
    lines: [...byKey.entries()].map(([key, bucket]) => ({
      key,
      label: bucket.label,
      delta: bucket.deltas.reduce((sum, value) => sum + value, 0) / bucket.deltas.length,
    })),
  }
}

export function calibrationSentence(label: string, delta: number): string {
  if (Math.abs(delta) < 0.05) return `On ${label} you score about the same as your panels.`
  const direction = delta > 0 ? 'higher' : 'lower'
  return `On ${label} you score about ${Math.abs(delta).toFixed(1)} ${direction} than your panels.`
}
