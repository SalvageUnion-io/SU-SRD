import { describe, expect, test } from 'bun:test'
import { paintFor } from '../parts/paint'

/**
 * The name's paper chip is contrast-driven (ruleset §3.8): a band prints its
 * name in whichever of ink or paper reaches 4.5:1, and wears the chip only
 * where neither does.
 */
describe('paintFor: the name on paper', () => {
  test('a tech-level band that carries ink or paper prints the name bare', () => {
    for (const tone of ['tl-1', 'tl-2', 'tl-4', 'tl-5', 'tl-6']) {
      expect({ tone, onPaper: paintFor(tone, { texture: false }).nameOnPaper }).toEqual({
        tone,
        onPaper: false,
      })
    }
  })

  test('ink on TL1 and TL2, paper from TL4 up', () => {
    expect(paintFor('tl-1', { texture: false }).color).toBe('var(--color-ink)')
    expect(paintFor('tl-2', { texture: false }).color).toBe('var(--color-ink)')
    expect(paintFor('tl-4', { texture: false }).color).toBe('var(--color-paper)')
  })

  test('TL3, where neither foreground reaches 4.5:1, sets the name on paper', () => {
    expect(paintFor('tl-3', { texture: false }).nameOnPaper).toBe(true)
  })

  test('a kind tone that carries text never wears the chip', () => {
    for (const tone of ['pilot', 'mech', 'ink', 'adversary']) {
      expect(paintFor(tone, { texture: false }).nameOnPaper).toBe(false)
    }
  })
})
