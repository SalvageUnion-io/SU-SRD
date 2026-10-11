/**
 * THE NESTED-TITLE LADDER (boards E1 and E2).
 *
 * The title is set by SIZE — large 31px, medium 22px, small 17px — and steps
 * down with nesting: depth 1 medium, depth 2 the head row, depth 3 a rung
 * below. `titleSizeClass(depth, size)` is `max(size rung, depth)`, so:
 *
 * - a nested title is NEVER LARGER than its parent's, at any size;
 * - under a LARGE card it is strictly smaller at every level until the floor;
 * - the floor is the 11px legibility floor (ruleset §4.6).
 *
 * Children are spawned by `nestedChildSize`: medium, or small inside a small
 * card, which is what keeps the first clause true under a small parent.
 */
import { describe, expect, test } from 'bun:test'
import type { CardSize } from '../../../shared/displayMode'
import { nestedChildSize, titleSizeClass } from '../entityCardTone'

// The canonical ladder, largest → smallest. A later position = a smaller title.
// Kept here as the test's independent reference so a reordering of the source
// ladder must be mirrored deliberately.
const LADDER_LARGEST_FIRST = [
  'text-display-lg',
  'text-title',
  'text-readout',
  'text-lede',
  'text-caption',
  'text-badge',
] as const

const FLOOR = 'text-badge'
const SIZES: CardSize[] = ['large', 'medium', 'small']
const DEPTHS = [0, 1, 2, 3, 4, 5, 6]

const LADDER_CLASSES: readonly string[] = LADDER_LARGEST_FIRST
/** Rank on the ladder: bigger rank = smaller title. Unknown class ⇒ -1 (fails). */
const rank = (cls: string) => LADDER_CLASSES.indexOf(cls)

describe('titleSizeClass — the nested-title ladder', () => {
  test('every resolved class is a real ladder rung', () => {
    for (const size of SIZES) {
      for (const depth of DEPTHS) {
        expect(rank(titleSizeClass(depth, size))).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('depth-0 sizes are the board E1 scale', () => {
    expect(titleSizeClass(0, 'large')).toBe('text-display-lg')
    expect(titleSizeClass(0, 'medium')).toBe('text-title')
    expect(titleSizeClass(0, 'small')).toBe('text-readout')
  })

  test('board E2: depth 1 medium, depth 2 the head row, depth 3 one rung under', () => {
    expect(titleSizeClass(1, 'medium')).toBe('text-title')
    expect(titleSizeClass(2, 'medium')).toBe('text-readout')
    expect(titleSizeClass(3, 'medium')).toBe('text-lede')
  })

  for (const parentSize of SIZES) {
    test(`a child is never larger than a '${parentSize}' parent one level up`, () => {
      const childSize = nestedChildSize(parentSize)
      for (const depth of DEPTHS) {
        const parent = titleSizeClass(depth, parentSize)
        const child = titleSizeClass(depth + 1, childSize)
        expect(rank(child)).toBeGreaterThanOrEqual(rank(parent))
      }
    })
  }

  test('under a large card each level is strictly smaller until the floor', () => {
    for (let depth = 0; depth < DEPTHS.length - 1; depth++) {
      const parent = titleSizeClass(depth, depth === 0 ? 'large' : 'medium')
      const child = titleSizeClass(depth + 1, 'medium')
      if (parent === FLOOR) expect(child).toBe(FLOOR)
      else expect(rank(child)).toBeGreaterThan(rank(parent))
    }
  })

  test('the floor is the legibility floor, and it holds at extreme depth', () => {
    expect(titleSizeClass(6, 'large')).toBe(FLOOR)
    expect(titleSizeClass(100, 'small')).toBe(FLOOR)
  })

  test('nested children render medium, or small inside a small card', () => {
    expect(nestedChildSize('large')).toBe('medium')
    expect(nestedChildSize('medium')).toBe('medium')
    expect(nestedChildSize('small')).toBe('small')
  })
})
