import { describe, expect, test } from 'bun:test'
import { mergeGrantSelections, scopeGrantSelections } from './grantSelectionScope'

/**
 * The double-grant independence contract (e.g. Mecha Packmaster's two identical
 * Mecha Companions): a granting ability holds one selection map namespaced by
 * grant index, and each grant instance reads/writes only its own slice.
 */
describe('grantSelectionScope', () => {
  const all = {
    '0:weapon': ['Ballistic'],
    '0:mod': ['Rangefinder'],
    '1:weapon': ['Energy'],
  }

  test('scope returns only the given grant, stripped to bare choice ids', () => {
    expect(scopeGrantSelections(all, 0)).toEqual({ weapon: ['Ballistic'], mod: ['Rangefinder'] })
    expect(scopeGrantSelections(all, 1)).toEqual({ weapon: ['Energy'] })
  })

  test('scope of a missing grant is empty; undefined input is safe', () => {
    expect(scopeGrantSelections(all, 2)).toEqual({})
    expect(scopeGrantSelections(undefined, 0)).toEqual({})
  })

  test('merge re-prefixes one grant without touching its siblings', () => {
    // Grant 0 changes its weapon; grant 1 must be untouched.
    const next = mergeGrantSelections(all, 0, { weapon: ['Energy'], mod: ['Rangefinder'] })
    expect(next).toEqual({
      '1:weapon': ['Energy'],
      '0:weapon': ['Energy'],
      '0:mod': ['Rangefinder'],
    })
  })

  test('two identical grants keep independent values (the reported case)', () => {
    // Same bare choice id ('name') set on grant 0 then grant 1 — never collides.
    let map = mergeGrantSelections(undefined, 0, { name: ['Rex'] })
    map = mergeGrantSelections(map, 1, { name: ['Fido'] })
    expect(map).toEqual({ '0:name': ['Rex'], '1:name': ['Fido'] })
    expect(scopeGrantSelections(map, 0)).toEqual({ name: ['Rex'] })
    expect(scopeGrantSelections(map, 1)).toEqual({ name: ['Fido'] })
  })

  test('clearing a grant (empty next) drops only its entries', () => {
    expect(mergeGrantSelections(all, 0, {})).toEqual({ '1:weapon': ['Energy'] })
  })
})
