import { describe, expect, test } from 'bun:test'
import type { Flag } from '../flags'
import { FLAGS, flagOn, flagsOnAt } from '../flags'

/** ADR-060: flagged surfaces are dark in production and lit everywhere else. */
describe('feature flags', () => {
  test('are off on production’s origin, with or without a trailing slash', () => {
    expect(flagsOnAt('https://salvageunion.io')).toBe(false)
    expect(flagsOnAt('https://salvageunion.io/')).toBe(false)
    expect(flagsOnAt('')).toBe(false)
  })

  test('are on on a Worker Preview and the dev server', () => {
    expect(flagsOnAt('https://pr-1732-su-srd.alxjrvs.workers.dev')).toBe(true)
    expect(flagsOnAt('http://localhost:4321')).toBe(true)
  })

  test('are on in a test-seam build, which never deploys', () => {
    expect(flagsOnAt('https://salvageunion.io', true)).toBe(true)
  })

  test('a flag reads the build it is in: a unit test builds for production', () => {
    expect(flagOn('anything' as Flag)).toBe(false)
  })

  test('each flag says what it hides', () => {
    for (const [flag, hides] of Object.entries(FLAGS) as [string, string][]) {
      expect(flag).toMatch(/^[a-z][a-zA-Z0-9]*$/)
      expect(hides.length).toBeGreaterThan(0)
    }
  })
})
