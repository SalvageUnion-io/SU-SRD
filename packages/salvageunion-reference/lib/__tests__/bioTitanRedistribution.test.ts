/**
 * Tests for the Bio-Titan / Iron Lady schema redistribution:
 * - The `titans` schema reverted to `bio-titans` (bio-only, no `kind` field).
 * - The Iron Lady (a non-bio android) moved into `drones` with her actions
 *   and equipped modules intact.
 */

import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index'
import { defined } from '../testing'

describe('Bio-Titan / Iron Lady redistribution', () => {
  it('exposes the BioTitans model (renamed from Titans)', () => {
    const bioTitans = SalvageUnionReference.BioTitans.all()
    expect(bioTitans.length).toBe(11)
    expect(bioTitans.some((t) => t.name === 'Scylla')).toBe(true)
  })

  it('no Bio-Titan carries a `kind` field (discriminator dropped)', () => {
    for (const titan of SalvageUnionReference.BioTitans.all()) {
      expect('kind' in titan).toBe(false)
    }
  })

  it('does not contain the Iron Lady among Bio-Titans', () => {
    expect(SalvageUnionReference.BioTitans.all().some((t) => t.name === 'The Iron Lady')).toBe(
      false
    )
  })

  it('places the Iron Lady in Drones with her actions and modules', () => {
    const ironLady = SalvageUnionReference.Drones.getByName('The Iron Lady')
    expect(ironLady).toBeDefined()
    expect(defined(ironLady).structurePoints).toBe(87)
    // Thatcher's Mech Base p.2: "87 STRUCTURE PTS.", "Can be salvaged for T6 15".
    expect(defined(ironLady).salvageValue).toBe(15)
    expect(defined(ironLady).techLevel).toBe(6)
    expect(defined(ironLady).actions).toBeDefined()
    expect(defined(ironLady).modules).toEqual([
      'Comms Module',
      'IR Night Vision Optics',
      'Firewall',
    ])
  })

  it('resolves the Iron Lady actions (including Titanic Actions) from her drone home', () => {
    const ironLady = defined(SalvageUnionReference.Drones.getByName('The Iron Lady'))
    const actions = SalvageUnionReference.resolveActions(ironLady)
    expect(Array.isArray(actions)).toBe(true)
    expect(defined(actions).some((a) => a.name === 'Titanic Actions (The Iron Lady)')).toBe(true)
  })
})
