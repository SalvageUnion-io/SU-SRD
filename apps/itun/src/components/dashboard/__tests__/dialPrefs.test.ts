/**
 * Unit tests for the Phase 7 dial-preference helpers: applyDialPrefs (hide +
 * reorder honored, Actions never hidden), orderKinds, and configurableKinds.
 * These are pure functions — no ORM needed.
 */

import { describe, expect, test } from 'bun:test'

import type { CockpitPrefs } from '../../../lib/schemas/cockpitPrefs'
import { applyDialPrefs, configurableKinds, orderKinds, type DialItem } from '../dialItems'
import { crawlerFixture, pilotFixture } from '../../__tests__/fixtures'

function items(): DialItem[] {
  return [
    { key: 'actions', kind: 'actions', statless: true, label: 'Actions', sublabel: '' },
    { key: 'mech:m', kind: 'mech', statless: true, label: 'Mech', sublabel: '' },
    { key: 'pilot:p', kind: 'pilot', statless: true, label: 'Pilot', sublabel: '' },
    { key: 'tables', kind: 'tables', statless: true, label: 'Tables', sublabel: '' },
    { key: 'srd', kind: 'srd', statless: true, label: 'SRD', sublabel: '' },
  ]
}

describe('applyDialPrefs', () => {
  test('no prefs → the list is untouched', () => {
    const out = applyDialPrefs(items(), undefined)
    expect(out.map((i) => i.kind)).toEqual(['actions', 'mech', 'pilot', 'tables', 'srd'])
  })

  test('hidden kinds are dropped', () => {
    const prefs: CockpitPrefs = { hidden: ['pilot', 'srd'], order: [] }
    const out = applyDialPrefs(items(), prefs)
    expect(out.map((i) => i.kind)).toEqual(['actions', 'mech', 'tables'])
  })

  test('Actions is never hidden even if present in `hidden`', () => {
    const prefs: CockpitPrefs = { hidden: ['actions'], order: [] }
    const out = applyDialPrefs(items(), prefs)
    expect(out.some((i) => i.kind === 'actions')).toBe(true)
  })

  test('order reorders the visible items; unlisted kinds keep default order after', () => {
    const prefs: CockpitPrefs = { hidden: [], order: ['tables', 'actions'] }
    const out = applyDialPrefs(items(), prefs)
    // tables, actions first (stored order); mech, pilot, srd keep default order.
    expect(out.map((i) => i.kind)).toEqual(['tables', 'actions', 'mech', 'pilot', 'srd'])
  })

  test('hide + reorder compose', () => {
    const prefs: CockpitPrefs = { hidden: ['mech'], order: ['srd', 'tables'] }
    const out = applyDialPrefs(items(), prefs)
    expect(out.map((i) => i.kind)).toEqual(['srd', 'tables', 'actions', 'pilot'])
  })
})

describe('orderKinds', () => {
  test('applies the stored order, keeping unlisted kinds in default position', () => {
    const kinds = configurableKinds({
      pilot: pilotFixture({ id: 'p' }),
      crawler: crawlerFixture({ id: 'c' }),
    })
    const prefs: CockpitPrefs = { hidden: [], order: ['crawler', 'actions'] }
    expect(orderKinds(kinds, prefs)).toEqual([
      'crawler',
      'actions',
      'mech',
      'pilot',
      'tables',
      'srd',
    ])
  })
})

describe('configurableKinds', () => {
  test('includes pilot / crawler only when linked', () => {
    expect(configurableKinds({ pilot: null, crawler: null })).toEqual([
      'actions',
      'mech',
      'tables',
      'srd',
    ])
    expect(configurableKinds({ pilot: pilotFixture({ id: 'p' }), crawler: null })).toContain(
      'pilot'
    )
  })
})
