/**
 * Unit tests for the v15 record rewrite (partner-equipment backfill).
 *
 * This migration exists to prevent data loss, so its failure mode is the thing
 * to pin. Once partners reconcile against their grant, a pilot partner whose
 * `hostRef` is missing from `pilot.equipment` answers to no grant and is reaped
 * on the owner's next edit. v12 minted exactly that shape — it converted
 * companion-mech rows without ever adding the granting slug — so without this
 * backfill, Eldridge Coast's Custos / Incitatus / PR-1 / Rek Jet would vanish
 * the first time their pilot was edited.
 *
 * The rule is append-only and one-directional: restore the grant the earlier
 * migration dropped, and never delete a partner to make the data consistent.
 */
import { describe, expect, test } from 'bun:test'
import { missingGrantSlugs } from '../migrations/15-partner-equipment-backfill'

const partner = (hostRef: string, over: Record<string, unknown> = {}) => ({
  id: `p-${hostRef}`,
  hostRef,
  hostSchema: 'equipment',
  systems: [],
  modules: [],
  conditions: [],
  ...over,
})

describe('missingGrantSlugs (v15)', () => {
  test('reports the slug a v12-shaped partner needs', () => {
    // Exactly the Custos shape: a partner, and an equipment array that never
    // heard of it.
    expect(missingGrantSlugs({ equipment: [], partners: [partner('survey-drone')] })).toEqual([
      'survey-drone',
    ])
  })

  test('reports nothing when the grant is already held (the v11 shape)', () => {
    expect(
      missingGrantSlugs({ equipment: ['survey-drone'], partners: [partner('survey-drone')] })
    ).toEqual([])
  })

  test('deduplicates — two companions need the slug added once, not twice', () => {
    expect(
      missingGrantSlugs({
        equipment: [],
        partners: [
          partner('mecha-companion', { id: 'a' }),
          partner('mecha-companion', { id: 'b' }),
        ],
      })
    ).toEqual(['mecha-companion'])
  })

  test('handles a pilot with several partners and a partially-correct array', () => {
    const missing = missingGrantSlugs({
      equipment: ['first-aid-kit', 'auto-turret'],
      partners: [partner('auto-turret'), partner('survey-drone'), partner('mecha-companion')],
    })
    expect(missing.sort()).toEqual(['mecha-companion', 'survey-drone'])
  })

  test('a pilot with no partners is untouched', () => {
    expect(missingGrantSlugs({ equipment: ['rifle'], partners: [] })).toEqual([])
    expect(missingGrantSlugs({ equipment: ['rifle'] })).toEqual([])
  })

  test('ignores a drones-hosted partner — its grant is a chassis ability', () => {
    // Never appears on a pilot, but the check is explicit rather than assumed:
    // adding 'sestra-drone' to a pilot's EQUIPMENT would invent an inventory
    // item that does not exist.
    expect(
      missingGrantSlugs({
        equipment: [],
        partners: [partner('sestra-drone', { hostSchema: 'drones' })],
      })
    ).toEqual([])
  })

  test('ignores a hostRef that is not a known partner-granting slug', () => {
    // Refuses to guess. An unrecognised ref is a repair job, not an equipment
    // entry to invent.
    expect(missingGrantSlugs({ equipment: [], partners: [partner('not-a-real-slug')] })).toEqual([])
  })

  test('survives malformed rows rather than throwing mid-versionchange', () => {
    expect(
      missingGrantSlugs({
        equipment: ['ok', 42],
        partners: [null, 'nonsense', { hostSchema: 'equipment' }, partner('survey-drone')],
      })
    ).toEqual(['survey-drone'])
  })
})
