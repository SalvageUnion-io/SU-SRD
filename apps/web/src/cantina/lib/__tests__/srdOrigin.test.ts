import { describe, expect, it } from 'bun:test'
import { srdOrigin } from '../srdOrigin'

describe('srdOrigin', () => {
  it("is the page's own origin: production, a Preview or the dev server alike", () => {
    expect(srdOrigin('http://localhost:4321')).toBe('http://localhost:4321')
    expect(srdOrigin('https://pr-7-su-srd.example.workers.dev')).toBe(
      'https://pr-7-su-srd.example.workers.dev'
    )
  })

  it("is production's outside a page", () => {
    expect(srdOrigin(undefined)).toBe('https://salvageunion.io')
    expect(srdOrigin('null')).toBe('https://salvageunion.io')
  })
})
