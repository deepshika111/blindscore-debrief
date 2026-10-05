import { describe, expect, it } from 'vitest'
import { markdownDebrief, plainDebrief, type DebriefExport } from './export'

const report: DebriefExport = {
  candidate: 'Ada',
  role: 'Engineer',
  rubric: 'SWE',
  metrics: [{ label: 'Technical', scores: 'Alex 4, Sam 2' }],
  discussFirst: ['Technical'],
  divergences: [{ label: 'Technical', note: 'Failure modes are still unowned.' }],
  questions: ['Which failure mode is still unowned?'],
  decision: { label: 'Hold', reason: 'Need one more conversation.' },
}

describe('debrief export', () => {
  it('includes the room, the split, the model notes, and the human decision', () => {
    const plain = plainDebrief(report)
    const markdown = markdownDebrief(report)
    for (const text of [plain, markdown]) {
      expect(text).toContain('Ada')
      expect(text).toContain('Engineer')
      expect(text).toContain('SWE')
      expect(text).toContain('Technical')
      expect(text).toContain('Alex 4, Sam 2')
      expect(text).toContain('Discuss first')
      expect(text).toContain('Failure modes are still unowned.')
      expect(text).toContain('Which failure mode is still unowned?')
      expect(text).toContain('Hold')
      expect(text).toContain('Need one more conversation.')
    }
    expect(markdown.startsWith('# Ada')).toBe(true)
  })
})