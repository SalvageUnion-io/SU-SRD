/**
 * PATTERN pages — a chassis's mech patterns and a Bio-Titan's variants. A
 * pattern is a nested object on its host — no id, no `schemaName` — so its
 * route, its slug and its SEO summary are all built
 * here rather than falling out of the entity machinery. These tests pin the
 * three properties that makes load-bearing:
 *
 * - the row link and the generated page agree on the URL (a mismatch is a
 *   silent 404 on every pattern row);
 * - a pattern's slug is unique within its chassis, which is the only
 *   disambiguation the nested route gives it;
 * - the summary describes the PATTERN, and carries the loadout, which is the
 *   only part of a pattern a crawler cannot read off the rendered island.
 *
 * Throughout, the unit is the VISIBLE pattern. A pattern tagged `hidden` stays
 * in the dataset but is withheld from every rendered surface, so it must get no
 * generated page — and nothing may link to one.
 */
import { describe, expect, it } from 'bun:test'
import { visiblePatterns } from 'salvageunion-reference'
import { SalvageUnionReference } from '../gameData'
import { srdPatternHref } from '../patternHref'
import { patternStaticSummary } from '../patternSummary'
import { getPatternStaticPaths } from '../staticPaths'

const chassisWithPatterns = () =>
  SalvageUnionReference.Chassis.all().filter((c) => visiblePatterns(c.patterns ?? []).length > 0)

const bioTitansWithPatterns = () =>
  SalvageUnionReference.BioTitans.all().filter((t) => visiblePatterns(t.patterns ?? []).length > 0)

const typhon = () => {
  const found = SalvageUnionReference.BioTitans.getByName('Typhon')
  if (!found) throw new Error('Typhon fixture missing')
  return found
}

const mule = () => {
  const found = SalvageUnionReference.Chassis.getByName('Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

describe('getPatternStaticPaths', () => {
  const paths = getPatternStaticPaths()

  it('emits one page per visible pattern of every chassis and Bio-Titan', () => {
    const expected =
      chassisWithPatterns().reduce((n, c) => n + visiblePatterns(c.patterns ?? []).length, 0) +
      bioTitansWithPatterns().reduce((n, t) => n + visiblePatterns(t.patterns ?? []).length, 0)
    expect(expected).toBeGreaterThan(0)
    expect(paths).toHaveLength(expected)
  })

  it('emits no page for a hidden pattern', () => {
    const hidden = SalvageUnionReference.Chassis.all().flatMap((c) =>
      (c.patterns ?? []).filter((p) => p.hidden).map((p) => srdPatternHref(c, p))
    )
    expect(hidden.length).toBeGreaterThan(0)
    const generated = new Set(
      paths.map(
        (p) => `/schema/${p.params.schemaId}/item/${p.params.itemId}/pattern/${p.params.patternId}/`
      )
    )
    expect(hidden.filter((href) => generated.has(href))).toEqual([])
  })

  it("nests every page under its host's schema", () => {
    expect(new Set(paths.map((p) => p.params.schemaId))).toEqual(new Set(['chassis', 'bio-titans']))
  })

  it('gives every page a unique URL', () => {
    const urls = paths.map((p) => `${p.params.itemId}/${p.params.patternId}`)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('never emits an empty slug', () => {
    expect(paths.every((p) => p.params.patternId.length > 0)).toBe(true)
    expect(paths.every((p) => p.params.itemId.length > 0)).toBe(true)
  })
})

describe('srdPatternHref', () => {
  it('resolves to a page that getPatternStaticPaths actually generates', () => {
    const generated = new Set(
      getPatternStaticPaths().map(
        (p) => `/schema/${p.params.schemaId}/item/${p.params.itemId}/pattern/${p.params.patternId}/`
      )
    )
    const dangling = [
      ...chassisWithPatterns().flatMap((chassis) =>
        visiblePatterns(chassis.patterns ?? []).map((pattern) => srdPatternHref(chassis, pattern))
      ),
      ...bioTitansWithPatterns().flatMap((titan) =>
        visiblePatterns(titan.patterns ?? []).map((pattern) => srdPatternHref(titan, pattern))
      ),
    ].filter((href) => !generated.has(href))
    expect(dangling).toEqual([])
  })

  it('nests a Bio-Titan pattern under its Bio-Titan', () => {
    const host = typhon()
    const hillWorm = host.patterns?.find((p) => p.name === 'Hill Worm')
    if (!hillWorm) throw new Error('Hill Worm fixture missing')
    expect(srdPatternHref(host, hillWorm)).toBe('/schema/bio-titans/item/typhon/pattern/hill-worm/')
  })

  it('nests the pattern under its chassis', () => {
    const chassis = mule()
    const hauler = chassis.patterns?.find((p) => p.name === 'Hauler')
    if (!hauler) throw new Error('Hauler fixture missing')
    expect(srdPatternHref(chassis, hauler)).toBe('/schema/chassis/item/mule/pattern/hauler/')
  })
})

describe('patternStaticSummary', () => {
  const chassis = mule()
  const hauler = chassis.patterns?.find((p) => p.name === 'Hauler')
  if (!hauler) throw new Error('Hauler fixture missing')
  const summary = patternStaticSummary(chassis, hauler)

  it('titles the page for the pattern, not the chassis', () => {
    expect(summary.name).toBe('Hauler — Mule Pattern')
  })

  it("describes the PATTERN, so sibling patterns don't share meta text", () => {
    expect(summary.description).toContain('favoured by wastelanders')

    const descriptions = (chassis.patterns ?? []).map(
      (p) => patternStaticSummary(chassis, p).description
    )
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('inherits the chassis stats a pattern shares', () => {
    const labels = summary.stats.map((s) => s.label)
    expect(labels).toContain('Structure Points')
    expect(labels).toContain('Cargo Capacity')
  })

  it('spells out the loadout, which the static block cannot otherwise show', () => {
    const prose = summary.contentParagraphs.join('\n')
    expect(prose).toContain('Systems: ')
    expect(prose).toContain('Transport Hold')
    expect(prose).toContain('Modules: ')
    expect(prose).toContain('Reactor Flare')
  })

  it('leads with the pattern, then the base chassis under its own heading', () => {
    // The pattern's prose and loadout come first (description + content) ...
    expect(summary.description).toContain('favoured by wastelanders')
    expect(summary.contentParagraphs.join('\n')).not.toContain("'M-63' Mule")
    // ... and the chassis prose follows, as a section named for the chassis.
    const [chassisSection] = summary.sections
    expect(chassisSection?.name).toBe('Mule chassis')
    expect(chassisSection?.paragraphs.join('\n')).toContain("'M-63' Mule")
  })

  it('never repeats a paragraph', () => {
    const all = [
      summary.description,
      ...summary.contentParagraphs,
      ...summary.sections.flatMap((s) => s.paragraphs),
    ]
    expect(new Set(all).size).toBe(all.length)
  })

  it('counts a repeated loadout entry rather than listing it twice', () => {
    const repeated = chassisWithPatterns()
      .flatMap((c) => (c.patterns ?? []).map((p) => ({ c, p })))
      .find(({ p }) => (p.systems ?? []).some((s) => (s.count ?? 1) > 1))
    if (!repeated) return // no multi-count loadout in the dataset; nothing to pin
    const line = patternStaticSummary(repeated.c, repeated.p).contentParagraphs.join('\n')
    expect(line).toContain('×')
  })
})

describe('patternStaticSummary for a Bio-Titan pattern', () => {
  const host = typhon()
  const hillWorm = host.patterns?.find((p) => p.name === 'Hill Worm')
  if (!hillWorm) throw new Error('Hill Worm fixture missing')
  const summary = patternStaticSummary(host, hillWorm)

  it('titles the page for the pattern', () => {
    expect(summary.name).toBe('Hill Worm — Typhon Pattern')
  })

  it('spells out the action it adds, with its rule', () => {
    const prose = summary.contentParagraphs.join('\n')
    expect(prose).toContain('Metallic Reconstitution: ')
    expect(prose).toContain('additional Armour Plating')
  })
})
