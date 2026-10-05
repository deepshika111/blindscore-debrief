import { describe, expect, it } from 'vitest'
import { calibrate, calibrationSentence } from './calibration'

const room = (mine: number, others: number[]) => ({
  metrics: [{ key: 'technical', label: 'Technical', mine, others }],
})

describe('calibration', () => {
  it('hides the numbers until there are three revealed rooms', () => {
    expect(calibrate([room(4, [2]), room(3, [3])])).toEqual({ ready: false })
  })

  it('averages this score minus the median of the other panelists, and skips a metric with no other scores', () => {
    const report = calibrate([
      room(4, [2, 3]),
      room(3, [3]),
      { metrics: [{ key: 'technical', label: 'Technical', mine: 2, others: [] }] },
    ])
    expect(report).toEqual({
      ready: true,
      lines: [{ key: 'technical', label: 'Technical', delta: 0.75 }],
    })
    expect(calibrationSentence('Technical', 0.75)).toBe('On Technical you score about 0.8 higher than your panels.')
  })
})