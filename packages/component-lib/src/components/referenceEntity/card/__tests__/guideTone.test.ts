/**
 * A GUIDE WEARS THE COLOUR OF THE LINK THAT OPENED IT.
 *
 * The SRD index paints each guide's catalog tile with that guide's stored
 * `guideTone` (`catalogHelpers.ts` → `catalogBg`), and `resolveDomainTone` reads
 * the same stored tone for the card the tile opens. These tests pin both halves
 * of that contract:
 *
 * 1. the hue arrives as `bgColor` (the guide's own colour), NOT as `bg` (the
 *    domain tone) — `bgColor` wins over `bg` on the band, and only `bgColor`
 *    reaches a choice region as its tone;
 * 2. no OTHER domain is disturbed — the guide branch is a data-shape check on a
 *    field nothing else carries, so gear must still ride the tech-level ramp and
 *    the remaining glossary schemas must still resolve to ink.
 *
 * The index-parity test is driven from the SHIPPED dataset rather than a
 * fixture: it is the actual guide records, and their actual hues, that have to
 * agree with the tiles.
 */
import { describe, expect, test } from 'bun:test'
import type { SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { malformed } from 'salvageunion-reference/testing'
import { entityGuideToneColor, resolveDomainTone } from '../entityCardTone'

const guides = SalvageUnionReference.Guides.all()

describe('guide tone — the card matches the index tile', () => {
  test('the dataset actually exercises this (guides exist, and name a tone)', () => {
    expect(guides.length).toBeGreaterThan(0)
    expect(guides.every((guide) => typeof guide.guideTone === 'string')).toBe(true)
  })

  test('every shipped guide resolves to the token its tone names', () => {
    for (const guide of guides) {
      const tone = resolveDomainTone('guides', guide)
      expect(tone.bgColor).toBe(entityGuideToneColor(guide))
    }
  })

  test('every resolved tone is a theme token, never a raw colour', () => {
    // The whole point of the rename: a hex here means the dataset has grown a
    // second palette again.
    for (const guide of guides) {
      const tone = resolveDomainTone('guides', guide)
      expect(tone.bgColor).toMatch(/^var\(--color-[a-z-]+\)$/)
    }
  })

  test('the hue rides bgColor, never the domain tone', () => {
    // `bg` and `bgColor` reach different places: only `bgColor` is a choice
    // region's tone. Leaving a stale domain tone on `bg` would paint the
    // glossary ink wherever the authored hue does not reach.
    for (const guide of guides) {
      const tone = resolveDomainTone('guides', guide)
      expect(tone.bg).toBeUndefined()
    }
  })

  test('guides still belong to the glossary domain (tone changed, grouping did not)', () => {
    const [guide] = guides
    if (!guide) throw new Error('the dataset ships no guides')
    const tone = resolveDomainTone('guides', guide)
    expect(tone.domain).toBe('glossary')
  })

  test('more than one distinct hue is in play', () => {
    // A guard against a regression that resolved every guide to one colour —
    // which would still pass the per-guide equality test if the hues collapsed.
    const hues = new Set(guides.map((guide) => resolveDomainTone('guides', guide).bgColor))
    expect(hues.size).toBeGreaterThan(1)
  })
})

describe('guide tone — no other domain is disturbed', () => {
  test('an unknown guideTone falls back to the domain tone', () => {
    // The schema validates the name against a closed enum, so this is a runtime
    // guard, not an expected branch. An unrecognised name must not produce a
    // transparent header band.
    const tone = resolveDomainTone('guides', malformed<SURefMetaEntity>({ guideTone: 'nonsense' }))
    expect(tone.bgColor).toBeUndefined()
    expect(tone.bg).toBe('var(--color-ink-2)')
  })

  test('the remaining glossary schemas still resolve to ink', () => {
    for (const schemaName of ['traits', 'keywords', 'distances'] as SURefEnumSchemaName[]) {
      const tone = resolveDomainTone(schemaName, malformed<SURefMetaEntity>({}))
      expect(tone.bg).toBe('var(--color-ink-2)')
      expect(tone.bgColor).toBeUndefined()
    }
  })

  test('equipment still rides the tech-level ramp', () => {
    const item = SalvageUnionReference.Equipment.all().find((e) => typeof e.techLevel === 'number')
    if (!item) throw new Error('no equipment with a numeric tech level')
    const tone = resolveDomainTone('equipment', item)
    expect(tone.bg).toMatch(/^var\(--color-tl-/)
    expect(tone.bgColor).toBeUndefined()
  })

  test('systems and modules are mech green, never a tech-level ground (§3.8)', () => {
    for (const [schemaName, all] of [
      ['systems', SalvageUnionReference.Systems.all()],
      ['modules', SalvageUnionReference.Modules.all()],
    ] as const) {
      for (const entity of all) {
        const tone = resolveDomainTone(schemaName, entity)
        expect(tone.bg === 'var(--color-mech)' || tone.bg === 'var(--color-ink-2)').toBe(true)
      }
    }
  })

  test('a mech still resolves to the mech domain hue', () => {
    const [chassis] = SalvageUnionReference.Chassis.all()
    if (!chassis) throw new Error('the dataset ships no chassis')
    const tone = resolveDomainTone('chassis', chassis)
    expect(tone.bg).toBe('var(--color-mech)')
    expect(tone.bgColor).toBeUndefined()
  })
})
