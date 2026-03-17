import { describe, expect, it } from 'bun:test'
import { SITE_URL } from '../constants'

describe('SITE_URL', () => {
  it('equals the production site URL', () => {
    expect(SITE_URL).toBe('https://salvageunion.io')
  })
})
