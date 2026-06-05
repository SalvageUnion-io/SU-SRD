/**
 * Tests for the Bio-Titan / Iron Lady schema redistribution:
 * - The `titans` schema reverted to `bio-titans` (bio-only, no `kind` field).
 * - The Iron Lady (a non-bio android) moved into `drones` with her actions
 *   and equipped modules intact.
 */

import { describe, it, expect } from 'bun:test'
import type { SalvageUnionReference as SURefType } from './index.js'

let SalvageUnionReference: typeof SURefType

function getReference() {
  if (!SalvageUnionReference) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SalvageUnionReference = require('./index.js').SalvageUnionReference
  }
  return SalvageUnionReference
}

describe('Bio-Titan / Iron Lady redistribution', () => {
  it('exposes the BioTitans model (renamed from Titans)', () => {
    const bioTitans = getReference().BioTitans.all()
    expect(bioTitans.length).toBe(12)
    expect(bioTitans.some((t) => t.name === 'Scylla')).toBe(true)
  })

  it('no Bio-Titan carries a `kind` field (discriminator dropped)', () => {
    for (const titan of getReference().BioTitans.all()) {
      expect('kind' in titan).toBe(false)
    }
  })

  it('does not contain the Iron Lady among Bio-Titans', () => {
    expect(
      getReference()
        .BioTitans.all()
        .some((t) => t.name === 'The Iron Lady')
    ).toBe(false)
  })

  it('places the Iron Lady in Drones with her actions and modules', () => {
    const ironLady = getReference().Drones.find((d) => d.name === 'The Iron Lady')
    expect(ironLady).toBeDefined()
    expect(ironLady!.structurePoints).toBe(87)
    expect(ironLady!.salvageValue).toBe(87)
    expect(ironLady!.actions).toBeDefined()
    expect(ironLady!.modules).toEqual(['Comms Module', 'IR Night Vision Optics', 'Firewall'])
  })

  it('resolves the Iron Lady actions (including Titanic Actions) from her drone home', () => {
    const ironLady = getReference().Drones.find((d) => d.name === 'The Iron Lady')!
    const actions = getReference().resolveActions(ironLady)
    expect(Array.isArray(actions)).toBe(true)
    expect(actions!.some((a) => a.displayName === 'Titanic Actions')).toBe(true)
  })
})
