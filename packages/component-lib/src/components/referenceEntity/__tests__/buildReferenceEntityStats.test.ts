import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { buildReferenceEntityStats } from '../referenceEntityStatsConfig'

/**
 * Unit coverage for the pure stat-builder that drives ReferenceEntityStats.
 * (The bio-titan derive-from-SP branch is already pinned by
 * `bioTitanBioSalvage.test.ts`, so it is intentionally not repeated here.)
 *
 * The Mule chassis is a stable, real fixture: SP 12, EP 4, SV 7, Heat 6,
 * System Slots 16 — spanning both `primary` (SP/EP/SV/Heat) and non-primary
 * (System Slots) config entries.
 */
const muleFound = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')
if (!muleFound) throw new Error('Mule chassis missing from reference data')
const mule: SURefMetaEntity = muleFound

const byLabel = (stats: ReturnType<typeof buildReferenceEntityStats>, label: string) =>
  stats.find((s) => s.label === label)

describe('buildReferenceEntityStats', () => {
  test('fixture resolves', () => {
    expect(mule).toBeDefined()
  })

  test('emits only stats that have a defined, non-zero value', () => {
    const stats = buildReferenceEntityStats(mule, { compact: false })
    // Real Mule values surface with their normal-mode labels…
    expect(byLabel(stats, 'Structure')?.value).toBe('12')
    expect(byLabel(stats, 'Energy')?.value).toBe('4')
    expect(byLabel(stats, 'Salvage')?.value).toBe('7')
    expect(byLabel(stats, 'Heat')?.value).toBe('6')
    expect(byLabel(stats, 'System')?.value).toBe('16')
    // …while stats the chassis does not define are omitted entirely (a chassis
    // has no "Slots Required" / bio-salvage).
    expect(byLabel(stats, 'Slots')).toBeUndefined()
    expect(byLabel(stats, 'Bio')).toBeUndefined()
  })

  test('an entity with no stat values yields an empty list', () => {
    const bare = { id: 'x', name: 'Bare' } as SURefMetaEntity
    expect(buildReferenceEntityStats(bare, { compact: false })).toEqual([])
  })

  test('primaryOnly keeps primary stats and drops non-primary ones', () => {
    const stats = buildReferenceEntityStats(mule, { compact: false, primaryOnly: true })
    // Structure / Energy / Salvage / Heat are flagged primary.
    expect(byLabel(stats, 'Structure')).toBeDefined()
    expect(byLabel(stats, 'Energy')).toBeDefined()
    expect(byLabel(stats, 'Salvage')).toBeDefined()
    expect(byLabel(stats, 'Heat')).toBeDefined()
    // System Slots is NOT primary — filtered out.
    expect(byLabel(stats, 'System')).toBeUndefined()
  })

  test('compact mode uses the top label only (drops the bottom label)', () => {
    const stats = buildReferenceEntityStats(mule, { compact: true })
    // Compact keeps the whole top label (Structure Points → Structure, …).
    expect(byLabel(stats, 'Structure')?.value).toBe('12')
    expect(byLabel(stats, 'Energy')?.value).toBe('4')
    expect(byLabel(stats, 'System')?.value).toBe('16')
    // …and drops the bottom label.
    expect(byLabel(stats, 'Structure')?.bottomLabel).toBeUndefined()
  })

  test('tooltips ride every stat in both modes', () => {
    const full = buildReferenceEntityStats(mule, { compact: false })
    expect(typeof byLabel(full, 'Structure')?.hoverText).toBe('string')

    const compact = buildReferenceEntityStats(mule, { compact: true })
    expect(typeof byLabel(compact, 'Structure')?.hoverText).toBe('string')
  })
})
