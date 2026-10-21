/**
 * A GUIDE WEARS RULES BLUE, as its page's band does (owner's call,
 * 2026-10-14), save where it is about one thing (owner, round 4): a creation
 * guide wears the colour of what it builds, pilot, mech or crawler, and the
 * Heat guide Heat's own red.
 *
 * A guide's card reads its hue through `entityGuideToneColor`, which
 * `resolveDomainTone` applies. These tests pin that contract:
 *
 * 1. the hue arrives as `bgColor`, NOT as `bg` (the domain tone) — `bgColor`
 *    wins over `bg` on the band, and only `bgColor` reaches a choice region and
 *    a step's table as its tone;
 * 2. no OTHER domain is disturbed — the guide branch is a data-shape check on a
 *    field nothing else carries (`guideType`), so gear must still ride the
 *    tech-level ramp; the other rules entries wear the same rules blue as their
 *    domain tone.
 *
 * Driven from the SHIPPED dataset rather than a fixture: every guide paints
 * rules blue.
 */
import { describe, expect, test } from 'bun:test'
import type { RefEnumSchemaName, RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { malformed } from 'salvageunion-reference/testing'
import { entityGuideToneColor, resolveDomainTone } from '../entityCardTone'

const guides = SalvageUnionReference.Guides.all()

describe('guide tone — a guide card wears its subject, else rules blue', () => {
  test('the dataset actually exercises this (guides exist, each with a type)', () => {
    expect(guides.length).toBeGreaterThan(0)
    expect(guides.every((guide) => typeof guide.guideType === 'string')).toBe(true)
  })

  /** What each guide wears: its unit's colour, Heat's red, else rules blue. */
  const expected = (guide: (typeof guides)[number]) =>
    ({
      'character-creation': 'var(--color-pilot)',
      'mech-creation': 'var(--color-mech)',
      'crawler-creation': 'var(--color-crawler)',
    })[guide.guideType as string] ??
    (guide.name === 'Heat' ? 'var(--color-heat)' : 'var(--color-wk-line)')

  test('every shipped guide resolves to its colour, the tile and the card alike', () => {
    for (const guide of guides) {
      const tone = resolveDomainTone('guides', guide)
      expect(tone.bgColor).toBe(expected(guide))
      expect(entityGuideToneColor(guide)).toBe(expected(guide))
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

  test('the creation guides wear their units, Heat its red, every other guide rules blue', () => {
    const hues = new Set(guides.map((guide) => resolveDomainTone('guides', guide).bgColor))
    expect([...hues].sort()).toEqual(
      [
        'var(--color-crawler)',
        'var(--color-heat)',
        'var(--color-mech)',
        'var(--color-pilot)',
        'var(--color-wk-line)',
      ].sort()
    )
  })
})

describe('guide tone — no other domain is disturbed', () => {
  test('a guide record with no type falls back to the domain tone, rules blue', () => {
    // A record missing its type must not produce a transparent header band.
    const tone = resolveDomainTone('guides', malformed<RefMetaEntity>({}))
    expect(tone.bgColor).toBeUndefined()
    expect(tone.bg).toBe('var(--color-wk-line)')
  })

  test('the other rules entries resolve to rules blue', () => {
    for (const schemaName of [
      'traits',
      'keywords',
      'distances',
      'sources',
      'roll-tables',
    ] as RefEnumSchemaName[]) {
      const tone = resolveDomainTone(schemaName, malformed<RefMetaEntity>({}))
      expect(tone.bg).toBe('var(--color-wk-line)')
      expect(tone.bgColor).toBeUndefined()
    }
  })

  test('equipment rides the tech-level ramp', () => {
    const item = SalvageUnionReference.Equipment.all().find((e) => typeof e.techLevel === 'number')
    if (!item) throw new Error('no equipment with a numeric tech level')
    const tone = resolveDomainTone('equipment', item)
    expect(tone.bg).toMatch(/^var\(--color-tl-/)
    expect(tone.bgColor).toBeUndefined()
  })

  test('systems and modules wear their tech level’s blue, as the book heads them', () => {
    for (const [schemaName, all] of [
      ['systems', SalvageUnionReference.Systems.all()],
      ['modules', SalvageUnionReference.Modules.all()],
    ] as const) {
      for (const entity of all) {
        const level = entity.techLevel
        const expected =
          level == null ? 'var(--color-ink-2)' : `var(--color-tl-${String(level).toLowerCase()})`
        expect(resolveDomainTone(schemaName, entity).bg).toBe(expected)
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
