/**
 * THE NESTED-TITLE INVARIANT.
 *
 * A card at depth N+1 must render a title that is never LARGER than its parent
 * at depth N, and STRICTLY smaller until the ladder bottoms out at its
 * legibility floor. `titleSizeClass(depth, size)` owns this: DEPTH steps one
 * rung per level, SIZE is a starting offset (not a `Math.max` floor, which used
 * to collapse depth 0 and depth 1 onto the same rung).
 *
 * These tests assert the invariant across depths 0..6 and all three sizes, and
 * pin the depth-0 sizes (the historical name-tab scale) so the offsets can't
 * drift.
 */
import { describe, expect, test } from 'bun:test'
import type { CardSize } from '../../../shared/displayMode'
import { titleSizeClass } from '../entityCardTone'

// The canonical ladder, largest → smallest. A later position = a smaller title.
// Kept here as the test's independent reference so a reordering of the source
// ladder must be mirrored deliberately.
const LADDER_LARGEST_FIRST = [
  'text-5xl',
  'text-xl',
  'text-base',
  'text-sm',
  'text-xs',
  'text-badge',
] as const

const FLOOR = 'text-badge'
const SIZES: CardSize[] = ['large', 'medium', 'small']
const DEPTHS = [0, 1, 2, 3, 4, 5, 6]

/** Rank on the ladder: bigger rank = smaller title. Unknown class ⇒ -1 (fails). */
function rank(cls: string): number {
  return (LADDER_LARGEST_FIRST as readonly string[]).indexOf(cls)
}

describe('titleSizeClass — nested-title invariant', () => {
  test('every resolved class is a real ladder rung', () => {
    for (const size of SIZES) {
      for (const depth of DEPTHS) {
        expect(rank(titleSizeClass(depth, size))).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('depth-0 sizes reproduce the historical name-tab scale', () => {
    expect(titleSizeClass(0, 'large')).toBe('text-5xl')
    expect(titleSizeClass(0, 'medium')).toBe('text-xl')
    expect(titleSizeClass(0, 'small')).toBe('text-base')
  })

  // For a FIXED size, each nesting level is strictly smaller until the floor,
  // then holds at the floor (never grows back). This is the core invariant and
  // the exact thing the old `Math.max` floor violated at depth 0→1.
  for (const size of SIZES) {
    test(`size='${size}': strictly smaller per depth until the floor, then held`, () => {
      for (let depth = 0; depth < DEPTHS.length - 1; depth++) {
        const parent = titleSizeClass(depth, size)
        const child = titleSizeClass(depth + 1, size)
        // Never larger.
        expect(rank(child)).toBeGreaterThanOrEqual(rank(parent))
        if (parent === FLOOR) {
          // Bottomed out: the child holds at the floor, it cannot shrink more.
          expect(child).toBe(FLOOR)
        } else {
          // Above the floor: the child is STRICTLY smaller.
          expect(rank(child)).toBeGreaterThan(rank(parent))
        }
      }
    })
  }

  // REAL nesting: children are always spawned at size='medium'. A medium child
  // at depth N+1 is never larger than its parent at depth N, whatever the
  // parent's size — strictly smaller for large/medium parents, meeting a small
  // parent only at the shared floor.
  for (const parentSize of SIZES) {
    test(`medium child is never larger than a '${parentSize}' parent one level up`, () => {
      for (const depth of DEPTHS) {
        const parent = titleSizeClass(depth, parentSize)
        const child = titleSizeClass(depth + 1, 'medium')
        expect(rank(child)).toBeGreaterThanOrEqual(rank(parent))
      }
    })
  }

  test('the floor is the legibility floor, and it holds at extreme depth', () => {
    expect(titleSizeClass(6, 'large')).toBe(FLOOR)
    expect(titleSizeClass(6, 'small')).toBe(FLOOR)
    expect(titleSizeClass(100, 'small')).toBe(FLOOR)
  })
})
