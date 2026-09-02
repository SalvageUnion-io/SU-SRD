import { describe, expect, test } from 'bun:test'
import type { CoreRollBand } from 'salvageunion-reference/rules'
import { diePlate, STATUS_LED, tierBanner } from '../ornament.js'

/** The four shades and two half blocks — the whole sanctioned vocabulary. */
const ALLOWED = /^[░▒▓█]+$/

describe('tierBanner', () => {
  test('marks only the two extremes', () => {
    expect(tierBanner('cascade')).not.toBeNull()
    expect(tierBanner('nailed')).not.toBeNull()
    for (const band of ['success', 'tough', 'failure'] as CoreRollBand[]) {
      expect(tierBanner(band)).toBeNull()
    }
  })

  test('uses only proven Block Element shades — no quadrants', () => {
    // ▚ (U+259A) and friends are the weakest-covered glyphs in the block; a
    // font fallback mid-run shows as gaps, which is the one thing a tiled
    // banner cannot survive. gauge() proves █ and ░ render everywhere.
    for (const band of ['cascade', 'nailed'] as CoreRollBand[]) {
      const banner = tierBanner(band)
      expect(banner).toMatch(ALLOWED)
      expect(banner).not.toContain('▚')
    }
  })

  test('the two banners are different rhythms, not the same run', () => {
    expect(tierBanner('cascade')).not.toBe(tierBanner('nailed'))
  })

  test('cascade repeats — that is what reads as alarm', () => {
    const banner = tierBanner('cascade') ?? ''
    expect(banner.slice(0, 3)).toBe('▓▒░')
    expect(banner.slice(3, 6)).toBe('▓▒░')
  })

  test('nailed swells to a centre and is symmetric — the inverse motion', () => {
    const banner = tierBanner('nailed') ?? ''
    expect([...banner].reverse().join('')).toBe(banner)
    expect(banner.startsWith('░')).toBe(true)
    expect(banner).toContain('█')
    // the peak is in the middle, not at an edge
    expect(banner.indexOf('█')).toBeGreaterThan(banner.length / 4)
  })

  test('both run the same width, so they read as one system', () => {
    expect(tierBanner('cascade')?.length).toBe(tierBanner('nailed')?.length)
  })
})

describe('diePlate', () => {
  test('stamps the number between half blocks', () => {
    expect(diePlate(20)).toBe('▌20▐')
    expect(diePlate(1)).toBe('▌1▐')
  })

  test('the number survives verbatim, so a screen reader still reads digits', () => {
    expect(diePlate(14)).toContain('14')
  })

  test('accepts a string for the cases that are not a single d20', () => {
    expect(diePlate('??')).toBe('▌??▐')
  })
})

test('the status LED is one lit block', () => {
  expect(STATUS_LED).toBe('█')
})
