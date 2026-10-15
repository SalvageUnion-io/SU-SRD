import { describe, expect, test } from 'bun:test'
import { GREY_HEADER } from '../../referenceEntity/card/cardChrome'
import { paintFor } from '../parts/paint'

/**
 * The name's paper chip is contrast-driven (ruleset §3.8): a band prints its
 * name in whichever of ink or paper reaches 4.5:1, and wears the chip only
 * where neither does.
 */
describe('paintFor: the name on paper', () => {
  test('every tech-level band carries ink or paper, so prints the name bare', () => {
    for (const tone of ['tl-1', 'tl-2', 'tl-3', 'tl-4', 'tl-5', 'tl-6', 'tl-b', 'tl-n']) {
      expect({ tone, onPaper: paintFor(tone, { texture: false }).nameOnPaper }).toEqual({
        tone,
        onPaper: false,
      })
    }
  })

  test('ink on TL1 to TL3, paper from TL4 up', () => {
    expect(paintFor('tl-1', { texture: false }).color).toBe('var(--color-ink)')
    expect(paintFor('tl-2', { texture: false }).color).toBe('var(--color-ink)')
    expect(paintFor('tl-3', { texture: false }).color).toBe('var(--color-ink)')
    expect(paintFor('tl-4', { texture: false }).color).toBe('var(--color-paper)')
  })

  test('Nanite prints paper', () => {
    expect(paintFor('tl-n', { texture: false }).color).toBe('var(--color-paper)')
  })

  test('a kind tone that carries text never wears the chip', () => {
    for (const tone of ['pilot', 'mech', 'ink', 'adversary']) {
      expect(paintFor(tone, { texture: false }).nameOnPaper).toBe(false)
    }
  })
})

/** Damaged dulls the band toward grey; destroyed is grey (owner, 2026-10-14). */
describe('paintFor: a down band', () => {
  const tones = [
    'ink',
    'pilot',
    'tier-hybrid',
    'crawler',
    'mech',
    'adversary',
    'tl-1',
    'tl-4',
    'tl-n',
  ]

  test('is its own tone dulled, never a flat grey', () => {
    for (const tone of tones) {
      const up = paintFor(tone, { texture: false })
      const down = paintFor(tone, { down: true, texture: false })
      expect(down.background).toStartWith(`color-mix(in srgb, ${up.background} 50%`)
    }
  })

  test('keeps the foreground and the ink stamps its band had', () => {
    for (const tone of tones) {
      const up = paintFor(tone, { texture: false })
      const down = paintFor(tone, { down: true, texture: false })
      expect({ tone, color: down.color, ink: down.ink, chip: down.nameOnPaper }).toEqual({
        tone,
        color: up.color,
        ink: up.ink,
        chip: false,
      })
    }
  })
})

describe('paintFor: a destroyed band', () => {
  test('is flat grey whatever its tone, its foreground measured on the grey', () => {
    for (const tone of ['ink', 'pilot', 'tl-1', 'tl-6']) {
      const down = paintFor(tone, { down: 'destroyed', texture: false })
      expect(down.background).toBe(GREY_HEADER)
      expect(down.color).toBe('var(--color-ink)')
    }
  })
})
