import { describe, expect, it } from 'vitest'
import { lintSchema } from 'deepspace/worker'
import { blindscoreSchemas, scorecardsSchema, submissionsSchema } from './blindscore'

describe('blindscore schemas', () => {
  it('lints clean', () => {
    for (const schema of blindscoreSchemas) {
      expect(lintSchema(schema), schema.name).toEqual([])
    }
  })

  it('keeps scores out of the progress collection and seals scorecards for admins too', () => {
    expect(submissionsSchema.columns.some((column) => column.name === 'score' || column.name === 'scores')).toBe(false)
    expect(scorecardsSchema.permissions.member?.read).toBe('own')
    expect(scorecardsSchema.permissions.admin?.read).toBe('own')
    expect(scorecardsSchema.permissions.member?.create).toBe(false)
    expect(scorecardsSchema.ownerField).toBe('interviewerId')
  })
})
