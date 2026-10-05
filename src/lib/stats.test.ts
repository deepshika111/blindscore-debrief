import { describe, expect, it } from 'vitest'
import { computeStats, discussFirst, metricSplit, panelVote, type StatCard } from './stats'

function card(technical: number, systemDesign: number, communication: number): StatCard {
  return { name: 'A', scores: { technical, systemDesign, communication } }
}

describe('computeStats', () => {
  it('maps spreads of 0, 1, and 3', () => {
    const none = computeStats([card(3, 3, 3), card(3, 3, 3)])
    const moderate = computeStats([card(3, 2, 4), card(4, 2, 4)])
    const high = computeStats([card(1, 4, 2), card(4, 4, 2)])

    expect(none.find((row) => row.dim === 'technical')).toMatchObject({ spread: 0, level: 'none', mean: 3 })
    expect(moderate.find((row) => row.dim === 'technical')).toMatchObject({ spread: 1, level: 'moderate', mean: 3.5 })
    expect(high.find((row) => row.dim === 'technical')).toMatchObject({ spread: 3, level: 'high', mean: 2.5 })
    expect(moderate.find((row) => row.dim === 'systemDesign')?.level).toBe('none')
  })

  it('reports one overall yes or no from the panel recommendations', () => {
    expect(panelVote([{ recommendation: 'lean_yes' }, { recommendation: 'strong_yes' }])).toMatchObject({
      verdict: 'Yes',
      yesPercent: 100,
      noPercent: 0,
    })
    expect(panelVote([{ recommendation: 'lean_yes' }, { recommendation: 'strong_no' }])).toMatchObject({
      verdict: 'Split',
      yesPercent: 50,
      noPercent: 50,
    })
  })

  it('divides a metric into the share who agreed and the share who disagreed', () => {
    expect(metricSplit([3, 3])).toMatchObject({ total: 2, agreedPercent: 100, disagreedPercent: 0 })
    expect(metricSplit([1, 3])).toMatchObject({ total: 2, agreed: 1, disagreed: 1, agreedPercent: 50, disagreedPercent: 50 })
    expect(metricSplit([3, 3, 1])).toMatchObject({ total: 3, agreed: 2, disagreed: 1, agreedPercent: 67, disagreedPercent: 33 })
  })

  it('puts a split of 2 or more first, widest gap at the top', () => {
    expect(discussFirst([card(4, 2, 3), card(2, 4, 3), card(3, 3, 4)])).toEqual(['technical', 'systemDesign'])
    expect(discussFirst([card(4, 1, 3), card(2, 4, 3)])).toEqual(['systemDesign', 'technical'])
    expect(discussFirst([card(3, 3, 3), card(4, 3, 3)])).toEqual([])
  })
})
