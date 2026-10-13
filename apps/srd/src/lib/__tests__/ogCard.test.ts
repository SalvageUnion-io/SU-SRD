import { describe, expect, it } from 'bun:test'
import { tokens } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { OG_HEIGHT, OG_WIDTH, ogAddress, ogCardFor, ogImagePath, ogMetaFor } from '../ogCard'

describe('the og canvas', () => {
  it('is the 1200×630 BaseLayout declares for every og:image', () => {
    expect([OG_WIDTH, OG_HEIGHT]).toEqual([1200, 630])
  })
})

describe('ogCardFor', () => {
  const scrapper = SalvageUnionReference.Chassis.getByName('Scrapper')
  if (!scrapper) throw new Error('no Scrapper')

  it('prints the bare path in the foot, as board OgCard does', () => {
    expect(ogCardFor('chassis', 'scrapper', scrapper).address).toBe('/chassis/scrapper')
  })

  it("draws a chassis's row as the origin does: SP, EP, Heat, SYS, MOD, Cargo", () => {
    const card = ogCardFor('chassis', 'scrapper', scrapper)
    if (!('stats' in card)) throw new Error('no stats')
    expect(card.stats.map((stat) => stat.label.toUpperCase())).toEqual([
      'SP',
      'EP',
      'HEAT',
      'SYS',
      'MOD',
      'CARGO',
    ])
    expect(card.stats[2]?.value).toBe(String(scrapper.heatCapacity))
  })

  it('addresses a pattern by its own page', () => {
    const pattern = scrapper.patterns?.[0]
    if (!pattern) throw new Error('Scrapper has no pattern')
    const card = ogCardFor('chassis', 'scrapper', scrapper, pattern, 'tow-rig')
    expect(card.address).toBe('/chassis/scrapper/pattern/tow-rig')
  })
})

describe('ogAddress', () => {
  it('prints the page path without its trailing slash', () => {
    expect(ogAddress('/abilities/mass-field-repair/')).toBe('/abilities/mass-field-repair')
  })

  it('steps a path too long for the foot down to the slug, never clipping it', () => {
    expect(ogAddress('/roll-tables/salvage-cache-table-reclamation-of-the-wastes/')).toBe(
      '/salvage-cache-table-reclamation-of-the-wastes'
    )
  })
})

describe('ogMetaFor', () => {
  const scrapper = SalvageUnionReference.Chassis.getByName('Scrapper')
  if (!scrapper) throw new Error('no Scrapper')
  const meta = ogMetaFor(ogCardFor('chassis', 'scrapper', scrapper))

  it('titles the preview with the name', () => {
    expect(meta.ogTitle).toBe('Scrapper')
  })

  it('describes it by the kicker and cite, never the body', () => {
    expect(meta.ogDescription.startsWith('Chassis · Tech Level 1 · ')).toBe(true)
  })

  it('takes the theme colour from the band, as a literal a meta tag can carry', () => {
    expect(meta.themeColor).toBe(tokens.color.mech)
  })

  it('titles a lower-case glossary name as the book prints it', () => {
    const bioTitan = SalvageUnionReference.Keywords.getByName('bio-titan')
    if (!bioTitan) throw new Error('no bio-titan keyword')
    expect(ogMetaFor(ogCardFor('keywords', 'bio-titan', bioTitan)).ogTitle).toBe('Bio-Titan')
  })
})

describe('ogImagePath', () => {
  it('mirrors the item page URL', () => {
    expect(ogImagePath('classes', 'engineer')).toBe('/classes/engineer.og.png')
  })

  it('addresses a chassis pattern as an entity in its own right', () => {
    expect(ogImagePath('chassis', 'atlas', 'mk8')).toBe('/chassis/atlas/pattern/mk8.og.png')
  })
})
