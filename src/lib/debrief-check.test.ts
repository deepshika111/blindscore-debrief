import { describe, expect, it } from 'vitest'
import { acceptDebrief } from './debrief-check'

const ok = JSON.stringify({
  consensus: ['Communication is the shared strength.'],
  divergences: [{ dim: 'technical', note: 'Failure modes are still unowned.' }],
  questions: ['What would the first month look like?', 'Which failure mode is still unowned?'],
})

describe('debrief output', () => {
  it('keeps a reply that stays off the hiring decision', () => {
    expect(acceptDebrief(ok)?.questions).toHaveLength(2)
  })

  it('rejects a reply that says to hire, and a reply that is not the schema', () => {
    const hiring = JSON.stringify({
      consensus: ['The panel should hire.'],
      divergences: [],
      questions: ['Why?', 'When?'],
    })
    expect(acceptDebrief(hiring)).toBeNull()
    expect(acceptDebrief('not json')).toBeNull()
  })
})