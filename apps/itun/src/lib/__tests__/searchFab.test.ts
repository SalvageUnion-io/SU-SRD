import { describe, expect, test } from 'bun:test'
import { fabCollides } from '../searchFab'

/**
 * The search FAB stands aside only where a route's own controls hold the
 * bottom-right corner — the Dashboard's fixed canvas and the three creation
 * wizards' footer pill — and nowhere else.
 */
describe('fabCollides', () => {
  test.each(['/dashboard/m1', '/pilots/new', '/mechs/new', '/crawlers/new', '/mechs/new/'])(
    '%s: the corner is taken',
    (path) => {
      expect(fabCollides(path)).toBe(true)
    }
  )

  test.each(['/', '/settings', '/sheet/mech/m1', '/mechs/patterns', '/games', '/about'])(
    '%s: the corner is free',
    (path) => {
      expect(fabCollides(path)).toBe(false)
    }
  )
})
