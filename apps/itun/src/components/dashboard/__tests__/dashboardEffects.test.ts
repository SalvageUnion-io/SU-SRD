/**
 * Activated-effect enumeration (F1, ADR-029).
 *
 * Manual expiry by design: Salvage Union states real durations, but the app has
 * no play clock and inventing one would put wall-time into the data layer and
 * make a sheet's numbers change while nobody is looking. The table keeps time;
 * the app keeps state.
 */

import { describe, expect, test } from 'bun:test'
import { activatableEffects } from '../dashboardEffects'

describe('activatableEffects', () => {
  test('finds an activated contribution on an installed module', () => {
    const found = activatableEffects({ systems: [], modules: ['Hull Magnetiser'] }, undefined)
    expect(found.map((e) => e.name)).toContain('Hull Magnetiser')
  })

  test('finds an activated contribution on a pilot ability', () => {
    const found = activatableEffects({ systems: [], modules: [] }, ['Squeeze it in'])
    expect(found.map((e) => e.name)).toContain('Squeeze it in')
  })

  test('ignores PERMANENT contributions — they need no switch', () => {
    // Beefcake and Heat Sink apply whenever held/installed.
    const found = activatableEffects({ systems: ['Heat Sink'], modules: [] }, ['Beefcake'])
    expect(found).toHaveLength(0)
  })

  test('de-duplicates by ref so two copies list one toggle', () => {
    const found = activatableEffects(
      { systems: [], modules: ['Hull Magnetiser', 'Hull Magnetiser'] },
      undefined
    )
    expect(found).toHaveLength(1)
  })

  test('summarises a fromStat amount without inventing a number', () => {
    const [effect] = activatableEffects({ systems: [], modules: ['Hull Magnetiser'] }, undefined)
    expect(effect?.summary).toContain('systemSlots')
  })

  test('an empty loadout offers nothing to switch on', () => {
    expect(activatableEffects({ systems: [], modules: [] }, [])).toEqual([])
  })
})
