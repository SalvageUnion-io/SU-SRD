import { describe, expect, it } from 'bun:test'
import { tokens } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { OG_HEIGHT, OG_WIDTH, ogCardFor, ogImagePath, ogMetaFor } from '../ogCard'

describe('the og canvas', () => {
  it('is the 1200×630 BaseLayout declares for every og:image', () => {
    expect([OG_WIDTH, OG_HEIGHT]).toEqual([1200, 630])
  })
})

describe('ogCardFor', () => {
  const scrapper = SalvageUnionReference.Chassis.getByName('Scrapper')
  if (!scrapper) throw new Error('no Scrapper')

  it('prints the page path in the foot', () => {
    expect(ogCardFor('chassis', 'scrapper', scrapper).address).toBe('/schema/chassis/item/scrapper')
  })

  it('addresses a pattern by its own page', () => {
    const pattern = scrapper.patterns?.[0]
    if (!pattern) throw new Error('Scrapper has no pattern')
    const card = ogCardFor('chassis', 'scrapper', scrapper, pattern, 'tow-rig')
    expect(card.address).toBe('/schema/chassis/item/scrapper/pattern/tow-rig')
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
})

describe('ogImagePath', () => {
  it('mirrors the item page URL', () => {
    expect(ogImagePath('classes', 'engineer')).toBe('/schema/classes/item/engineer.og.png')
  })

  it('addresses a chassis pattern as an entity in its own right', () => {
    expect(ogImagePath('chassis', 'atlas', 'mk8')).toBe(
      '/schema/chassis/item/atlas/pattern/mk8.og.png'
    )
  })
})
