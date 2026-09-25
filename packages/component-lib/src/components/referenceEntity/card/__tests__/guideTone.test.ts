/**
 * A GUIDE WEARS THE COLOUR OF THE LINK THAT OPENED IT.
 *
 * The SRD index paints each guide's catalog tile with that guide's stored
 * `guideColor` (`apps/srd/src/lib/catalogHelpers.ts` → `catalogBg`). The card the
 * tile navigates to used to resolve through the glossary domain default
 * (`bg-ink-2`), so every guide page was a different colour from the tile that
 * opened it. `resolveDomainTone` now reads the stored hue, and these tests pin
 * both halves of that contract:
 *
 * 1. the hue arrives as `bgColor` (a raw CSS colour the card applies inline),
 *    NOT as `bg` (a Tailwind class) — the two are threaded to different props,
 *    and only `bgColor` wins over the domain class in `accentSurface`;
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

  test('the hue rides bgColor, never a Tailwind bg class', () => {
    // `bg` and `bgColor` reach different props: `accentSurface` puts `bg` on
    // className and `bgColor` on an inline style. Leaving a stale domain class
    // on `bg` would paint the glossary ink underneath the authored hue.
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
    expect(tone.bg).toBe('bg-ink-2')
  })

  test('the remaining glossary schemas still resolve to ink', () => {
    for (const schemaName of ['traits', 'keywords', 'distances'] as SURefEnumSchemaName[]) {
      const tone = resolveDomainTone(schemaName, malformed<SURefMetaEntity>({}))
      expect(tone.bg).toBe('bg-ink-2')
      expect(tone.bgColor).toBeUndefined()
    }
  })

  test('gear still rides the tech-level ramp', () => {
    const system = SalvageUnionReference.Systems.all().find((s) => typeof s.techLevel === 'number')
    if (!system) throw new Error('no system with a numeric tech level')
    const tone = resolveDomainTone('systems', system)
    expect(tone.bg).toMatch(/^bg-tl-/)
    expect(tone.bgColor).toBeUndefined()
  })

  test('a mech still resolves to the mech domain hue', () => {
    const [chassis] = SalvageUnionReference.Chassis.all()
    if (!chassis) throw new Error('the dataset ships no chassis')
    const tone = resolveDomainTone('chassis', chassis)
    expect(tone.bg).toBe('bg-mech')
    expect(tone.bgColor).toBeUndefined()
  })
})
