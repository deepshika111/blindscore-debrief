import { describe, expect, it } from 'vitest'
import assetHeaders from '../../public/_headers?raw'
import { securityHeaders } from './security-headers'

describe('static asset headers', () => {
  it('matches the worker policy for the live origin', () => {
    const expected = securityHeaders('https://blindscore.app.space/')
    for (const [name, value] of Object.entries(expected)) {
      expect(assetHeaders).toContain(`${name}: ${value}`)
    }
    expect(expected['Content-Security-Policy']).toContain("form-action 'self'")
  })
})
