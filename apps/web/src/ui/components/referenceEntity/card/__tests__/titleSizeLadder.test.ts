/**
 * THE NESTED-TITLE LADDER (boards E1 and E2).
 *
 * The title is set by SIZE — large 31px, medium 22px, small 17px — and steps
 * down with nesting: depth 1 medium, depth 2 the head row, depth 3 a rung
 * below. `titleSizeRung(depth, size)` is `max(size rung, depth)`, so:
 *
 * - a nested title is NEVER LARGER than its parent's, at any size;
 * - under a LARGE card it is strictly smaller at every level until the floor;
 * - the floor is the 11px legibility floor (ruleset §4.6).
 *
 * Children are spawned by `nestedChildSize`: medium, or small inside a small
 * card, which is what keeps the first clause true under a small parent.
 */
import { describe, expect, test } from 'bun:test'
import type { CardSize } from '../../../containers/displayMode'
import { nestedChildSize, titleSizeRung } from '../entityCardTone'

// The canonical ladder, largest → smallest. A later position = a smaller title.
// Kept here as the test's independent reference so a reordering of the source
// ladder must be mirrored deliberately.
const LADDER_LARGEST_FIRST = ['displayLg', 'title', 'readout', 'lede', 'caption', 'badge'] as const

const FLOOR = 'badge'
const SIZES: CardSize[] = ['large', 'medium', 'small']
const DEPTHS = [0, 1, 2, 3, 4, 5, 6]

const LADDER_CLASSES: readonly string[] = LADDER_LARGEST_FIRST
/** Rank on the ladder: bigger rank = smaller title. Unknown rung ⇒ -1 (fails). */
const rank = (cls: string) => LADDER_CLASSES.indexOf(cls)

describe('titleSizeRung — the nested-title ladder', () => {
  test('every resolved rung is a real ladder rung', () => {
    for (const size of SIZES) {
      for (const depth of DEPTHS) {
        expect(rank(titleSizeRung(depth, size))).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('depth-0 sizes are the board E1 scale', () => {
    expect(titleSizeRung(0, 'large')).toBe('displayLg')
    expect(titleSizeRung(0, 'medium')).toBe('title')
    expect(titleSizeRung(0, 'small')).toBe('readout')
  })

  test('board E2: depth 1 medium, depth 2 the head row, depth 3 one rung under', () => {
    expect(titleSizeRung(1, 'medium')).toBe('title')
    expect(titleSizeRung(2, 'medium')).toBe('readout')
    expect(titleSizeRung(3, 'medium')).toBe('lede')
  })

  for (const parentSize of SIZES) {
    test(`a child is never larger than a '${parentSize}' parent one level up`, () => {
      const childSize = nestedChildSize(parentSize)
      for (const depth of DEPTHS) {
        const parent = titleSizeRung(depth, parentSize)
        const child = titleSizeRung(depth + 1, childSize)
        expect(rank(child)).toBeGreaterThanOrEqual(rank(parent))
      }
    })
  }

  test('under a large card each level is strictly smaller until the floor', () => {
    for (let depth = 0; depth < DEPTHS.length - 1; depth++) {
      const parent = titleSizeRung(depth, depth === 0 ? 'large' : 'medium')
      const child = titleSizeRung(depth + 1, 'medium')
      if (parent === FLOOR) expect(child).toBe(FLOOR)
      else expect(rank(child)).toBeGreaterThan(rank(parent))
    }
  })

  test('the floor is the legibility floor, and it holds at extreme depth', () => {
    expect(titleSizeRung(6, 'large')).toBe(FLOOR)
    expect(titleSizeRung(100, 'small')).toBe(FLOOR)
  })

  test('nested children render medium, or small inside a small card', () => {
    expect(nestedChildSize('large')).toBe('medium')
    expect(nestedChildSize('medium')).toBe('medium')
    expect(nestedChildSize('small')).toBe('small')
  })
})
