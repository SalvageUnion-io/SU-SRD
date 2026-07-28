/**
 * A snapshot shares a LIVE INSTANCE, so it must carry the context that
 * instance's numbers depend on (ADR-029).
 *
 * Beefcake is a pilot ability that raises the piloted mech's Max SP and Cargo.
 * A mech snapshot published without the pilot's ability refs would read LOWER
 * for a viewer than the same mech on its owner's sheet.
 *
 * Contrast a mech PATTERN: a stateless build template with no pilot and no live
 * instance. Patterns are shared context-free and never go through this flow.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  abilityContributions,
  mechMaxSPParts,
  sumContributions,
} from 'salvageunion-reference/rules'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('snapshot pilot context', () => {
  test('a mech derives the SAME max SP with the pilot context as on the live sheet', () => {
    const mech = { chassisRef: 'no-such-chassis' }
    const chassis = { structurePoints: 20 }
    const piloting = { abilities: ['Beefcake'], techLevel: 4 }

    const ownersSheet = mechMaxSPParts(mech, chassis, piloting).total
    // The viewer reconstructs the same context from the payload's `context`.
    const viewer = mechMaxSPParts(mech, chassis, { abilities: ['Beefcake'], techLevel: 4 }).total

    expect(viewer).toBe(ownersSheet)
    expect(viewer).toBe(27)
  })

  test('dropping the context is exactly the under-count this guards against', () => {
    const mech = { chassisRef: 'no-such-chassis' }
    const chassis = { structurePoints: 20 }
    const withPilot = mechMaxSPParts(mech, chassis, { abilities: ['Beefcake'], techLevel: 4 }).total
    const without = mechMaxSPParts(mech, chassis).total
    expect(withPilot - without).toBe(
      sumContributions(abilityContributions(['Beefcake'], 'pilotedMech', 'structurePoints', 4))
    )
    expect(without).toBeLessThan(withPilot)
  })
})
