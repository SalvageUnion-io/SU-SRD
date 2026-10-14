/**
 * Bio-Titan patterns: a variant the book prints as "uses the stats of <Bio-Titan>
 * with the following additional special rule" (Rainmaker p.80). The pattern is
 * a DELTA on its host — it names only the actions it adds — so the Hill Worm
 * lives on Typhon rather than as a second, restated stat block.
 */

import { describe, expect, it } from 'bun:test'
import { extractPatternActions } from '../actionResolution'
import { resolveFormerSlug } from '../formerSlugs'
import { SalvageUnionReference } from '../index'
import { getPatterns, isBioTitanPattern } from '../patterns'
import { search } from '../search'

function typhon() {
  const found = SalvageUnionReference.BioTitans.getByName('Typhon')
  if (!found) throw new Error('Typhon fixture missing')
  return found
}

describe('Bio-Titan patterns', () => {
  it('carries the Hill Worm as a pattern of Typhon, cited to its own book', () => {
    const hillWorm = getPatterns(typhon())?.find((p) => p.name === 'Hill Worm')
    expect(hillWorm).toBeDefined()
    expect(hillWorm?.source).toBe('Rainmaker')
    expect(hillWorm?.page).toBe(80)
  })

  it('no longer lists the Hill Worm as a Bio-Titan of its own', () => {
    expect(SalvageUnionReference.BioTitans.getByName('Hill Worm Pattern Typhon')).toBeUndefined()
  })

  it('resolves only the actions the pattern adds', () => {
    const hillWorm = getPatterns(typhon())?.[0]
    if (!hillWorm) throw new Error('Hill Worm pattern missing')
    expect(isBioTitanPattern(hillWorm)).toBe(true)
    expect(extractPatternActions(hillWorm).map((a) => a.name)).toEqual(['Metallic Reconstitution'])
  })

  it('inherits the host stats rather than restating them', () => {
    const hillWorm = getPatterns(typhon())?.[0]
    expect(hillWorm && 'structurePoints' in hillWorm).toBe(false)
    // The added action is not also one of the host's own.
    expect(typhon().actions).not.toContain('Metallic Reconstitution')
  })

  it('tells a mech pattern apart, which adds no actions', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    const hauler = mule ? getPatterns(mule)?.[0] : undefined
    if (!hauler) throw new Error('Mule pattern missing')
    expect(isBioTitanPattern(hauler)).toBe(false)
    expect(extractPatternActions(hauler)).toEqual([])
  })
})

describe('Bio-Titan patterns in search', () => {
  it('finds the host by its pattern name', () => {
    const hits = search({ query: 'Hill Worm', schemas: ['bio-titans'] })
    expect(hits.map((h) => h.entity.name)).toContain('Typhon')
  })
})

describe('former slugs (ADR-043)', () => {
  it('resolves the Hill Worm’s old Bio-Titan slug to Typhon’s pattern', () => {
    const found = resolveFormerSlug('bio-titans', 'hill-worm-pattern-typhon')
    expect(found?.host.name).toBe('Typhon')
    expect(found?.pattern.name).toBe('Hill Worm')
  })

  it('resolves nothing for a live or unknown slug', () => {
    expect(resolveFormerSlug('bio-titans', 'typhon')).toBeNull()
    expect(resolveFormerSlug('chassis', 'hill-worm-pattern-typhon')).toBeNull()
  })
})
