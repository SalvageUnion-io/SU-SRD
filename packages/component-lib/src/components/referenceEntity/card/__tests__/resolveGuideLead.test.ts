/**
 * EVERY GUIDE TILE SAYS SOMETHING, AND ONLY ITS INTRODUCTION.
 *
 * A catalog tile renders an entity's whole `content[]` untruncated and never
 * expands its `steps`. For guides that broke in both directions at once,
 * measured on the built `/schema/guides/` listing: Safety Protocols rendered
 * 1,236 characters into a tile, while Salvaging, Upgrading your Union Crawler
 * and Activating and Shutting Down a Mech rendered no prose at all — they keep
 * every word in `steps` and carry no top-level `content`.
 *
 * `resolveGuideLead` SELECTS the introduction, it never authors one. These tests
 * pin that: the returned string must be a paragraph that already exists in the
 * data, verbatim, and every shipped guide must produce one.
 */
import { describe, expect, test } from 'bun:test'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveGuideLead } from '../resolveGuideLead'

await SalvageUnionReference.preload('all')

const guides = SalvageUnionReference.Guides.all()
const asEntity = (guide: unknown) => guide as unknown as SURefMetaEntity

/** Every paragraph string anywhere in a guide — its own content and its steps. */
const everyParagraph = (guide: (typeof guides)[number]): string[] =>
  [...(guide.content ?? []), ...(guide.steps ?? []).flatMap((s) => s.content ?? [])]
    .filter((b) => (b?.type ?? 'paragraph') === 'paragraph' && typeof b?.value === 'string')
    .map((b) => String(b.value))

describe('resolveGuideLead — every guide gets an introduction', () => {
  test('the dataset actually exercises both rungs of the fallback', () => {
    expect(guides.length).toBeGreaterThan(0)
    const withOwnContent = guides.filter((g) => (g.content ?? []).length > 0)
    const withoutOwnContent = guides.filter((g) => (g.content ?? []).length === 0)
    // If this ever hits zero the step fallback has stopped being covered by real
    // data, and the "shows nothing" regression could return unnoticed.
    expect(withoutOwnContent.length).toBeGreaterThan(0)
    expect(withOwnContent.length).toBeGreaterThan(0)
  })

  test('resolves a non-empty lead for EVERY shipped guide', () => {
    for (const guide of guides) {
      const lead = resolveGuideLead(asEntity(guide))
      expect(lead, `no lead for "${guide.name}"`).toBeTruthy()
      expect(lead?.trim().length).toBeGreaterThan(0)
    }
  })

  test('a guide with NO top-level content still gets one, from its steps', () => {
    const stepOnly = guides.filter((g) => (g.content ?? []).length === 0)
    for (const guide of stepOnly) {
      const lead = resolveGuideLead(asEntity(guide))
      expect(lead, `no step-derived lead for "${guide.name}"`).toBeTruthy()
    }
  })
})

describe('resolveGuideLead — it selects, it never authors', () => {
  test('the lead is a paragraph that exists verbatim in the guide', () => {
    for (const guide of guides) {
      const lead = resolveGuideLead(asEntity(guide))
      // `firstParagraphText` runs the block through `parseContentBlockString`,
      // which substitutes chassis names; compare on a normalised prefix so the
      // assertion still means "this text came from the data, unrewritten".
      const found = everyParagraph(guide).some(
        (p) => p === lead || p.startsWith(String(lead).slice(0, 40))
      )
      expect(found, `lead for "${guide.name}" is not a paragraph from its data`).toBe(true)
    }
  })

  test('prefers the guide OWN preamble over a step, when it has one', () => {
    for (const guide of guides.filter((g) => (g.content ?? []).length > 0)) {
      const ownFirst = (guide.content ?? []).find(
        (b) => (b?.type ?? 'paragraph') === 'paragraph' && typeof b?.value === 'string'
      )
      if (!ownFirst) continue
      const lead = resolveGuideLead(asEntity(guide))
      expect(String(lead).slice(0, 40)).toBe(String(ownFirst.value).slice(0, 40))
    }
  })

  test('returns ONE paragraph, not the whole preamble concatenated', () => {
    // Safety Protocols is the worst case — 5 top-level paragraphs, 1,236
    // characters in the tile before this change.
    const safety = guides.find((g) => g.name === 'Safety Protocols')
    if (!safety) throw new Error('"Safety Protocols" is not in the reference set')
    const allProse = everyParagraph(safety).join(' ')
    const lead = resolveGuideLead(asEntity(safety))
    expect(String(lead).length).toBeLessThan(allProse.length / 2)
  })
})

describe('resolveGuideLead — nothing else is touched', () => {
  test('returns undefined for entities that are not guides', () => {
    const others = [
      SalvageUnionReference.Chassis.all()[0],
      SalvageUnionReference.Systems.all()[0],
      SalvageUnionReference.Abilities.all()[0],
      SalvageUnionReference.Traits.all()[0],
    ]
    for (const entity of others) {
      expect(entity).toBeDefined()
      expect(resolveGuideLead(asEntity(entity))).toBeUndefined()
    }
  })

  test('is defensive about malformed input', () => {
    expect(resolveGuideLead(undefined as unknown as SURefMetaEntity)).toBeUndefined()
    expect(resolveGuideLead(null as unknown as SURefMetaEntity)).toBeUndefined()
    expect(resolveGuideLead({} as SURefMetaEntity)).toBeUndefined()
    expect(resolveGuideLead({ steps: 'nope' } as unknown as SURefMetaEntity)).toBeUndefined()
    // A guide-shaped record with no prose anywhere falls through to the card's
    // ordinary body rather than rendering an empty paragraph.
    expect(
      resolveGuideLead({ steps: [], content: [] } as unknown as SURefMetaEntity)
    ).toBeUndefined()
  })
})
