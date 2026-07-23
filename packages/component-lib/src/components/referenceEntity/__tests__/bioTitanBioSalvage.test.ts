import { describe, it, expect } from 'bun:test'
import type { SURefMetaEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { buildReferenceEntityStats } from '../referenceEntityStatsConfig'

/**
 * Bio-Titans surface a bio-salvage value equal to their Structure Points
 * (core-book rule). There is no stored `bioSalvageValue` field — the value is
 * derived from `structurePoints` at the display layer, scoped strictly to the
 * `bio-titans` schema so no other entity gains a derived bio-salvage stat.
 */
describe('Bio-Titan bio-salvage derivation', () => {
  const bioTitan = { id: 'x', name: 'Scylla', structurePoints: 39 } as SURefMetaEntity

  const findBioSalvage = (stats: ReturnType<typeof buildReferenceEntityStats>) =>
    stats.find((s) => s.label === 'Bio' && s.bottomLabel === 'SV')

  it('derives a Bio SV stat equal to structurePoints for bio-titans', () => {
    const stats = buildReferenceEntityStats(bioTitan, { compact: false, schemaName: 'bio-titans' })
    const bioSalvage = findBioSalvage(stats)
    expect(bioSalvage).toBeDefined()
    expect(bioSalvage?.value).toBe('39')
  })

  it('does NOT derive bio-salvage for non-bio-titan schemas with structurePoints', () => {
    const nonBioTitanSchemas: (SURefEnumSchemaName | undefined)[] = [
      'drones',
      'meld',
      'npcs',
      'vehicles',
      undefined,
    ]
    for (const schemaName of nonBioTitanSchemas) {
      const stats = buildReferenceEntityStats(bioTitan, { compact: false, schemaName })
      expect(findBioSalvage(stats)).toBeUndefined()
    }
  })

  it('still surfaces an explicit bioSalvageValue field (NPC path unchanged)', () => {
    const npc = {
      id: 'y',
      name: 'Chimerium Mutant',
      hitPoints: 10,
      bioSalvageValue: 3,
    } as SURefMetaEntity
    const stats = buildReferenceEntityStats(npc, { compact: false, schemaName: 'npcs' })
    const bioSalvage = findBioSalvage(stats)
    expect(bioSalvage?.value).toBe('3')
  })
})
