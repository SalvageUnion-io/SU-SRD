/**
 * A shared Reference link previews as the thing it is (r4 F7): the preview's
 * words are the entity's own stats and summary, and where it has art the
 * preview's image is that art, from the artwork CDN.
 */
import { describe, expect, it } from 'bun:test'
import { metaTags } from '../documentHead'
import { entityPageHead, previewDescriptionFor } from '../entityPageHead'

const head = (assetUrl: string | undefined, preview?: string) =>
  entityPageHead({
    title: 'Mule | Chassis',
    name: 'Mule',
    description: 'The Mule is a workhorse.',
    canonical: 'https://salvageunion.io/chassis/mule/',
    keywords: ['Chassis', 'Mule'],
    parentPage: {
      type: 'CollectionPage',
      name: 'Chassis',
      url: 'https://salvageunion.io/chassis/',
    },
    source: 'Salvage Union Workshop Manual',
    assetUrl,
    og: { ogTitle: 'Mule', ogDescription: 'Chassis · Workshop Manual · p.100', themeColor: '#000' },
    previewDescription: preview,
    componentEmbed: '{}',
    crumbs: [],
    crumb: 'Mule',
  })

describe('previewDescriptionFor', () => {
  it('leads with the kind and its stats, then the summary', () => {
    expect(
      previewDescriptionFor({
        kind: 'System',
        stats: [
          { label: 'TL', value: '4' },
          { label: 'RNG', value: 'Long' },
          { label: 'DMG', value: '9 SP' },
        ],
        traits: ['Hot (3)'],
        summary: 'A rail of magnets.',
      })
    ).toBe('System · TL 4, RNG Long, DMG 9 SP · Hot (3). A rail of magnets.')
  })

  it('is the summary alone for a thing with no stats, and nothing for one with neither', () => {
    expect(
      previewDescriptionFor({ kind: 'Keyword', stats: [], traits: [], summary: 'A rule.' })
    ).toBe('A rule.')
    expect(
      previewDescriptionFor({ kind: 'Keyword', stats: [], traits: [], summary: undefined })
    ).toBeUndefined()
  })

  it('never runs past a preview’s room', () => {
    const long = previewDescriptionFor({
      kind: 'System',
      stats: [{ label: 'TL', value: '4' }],
      traits: [],
      summary: 'word '.repeat(200),
    })
    expect(long?.length).toBeLessThanOrEqual(200)
  })
})

describe('an entity page’s preview', () => {
  it('with art: the image is the art, a rendered width of it, and claims no card size', () => {
    const meta = head('https://assets.salvageunion.io/chassis/mule.webp', 'Chassis · SP 12.')
    expect(meta.ogImage).toBe('https://assets.salvageunion.io/chassis/mule-880q80.webp')
    expect(meta.ogImageArt).toBe(true)
    expect(meta.ogDescription).toBe('Chassis · SP 12.')
  })

  it('without art: the card stays (the generator points the page at it)', () => {
    const meta = head(undefined, 'Chassis · SP 12.')
    expect(meta.ogImage).toBeUndefined()
    expect(meta.ogImageArt).toBeUndefined()
  })

  it('with no summary of its own: the kind and cite, as before', () => {
    expect(head(undefined).ogDescription).toBe('Chassis · Workshop Manual · p.100')
  })
})

describe('metaTags', () => {
  const tags = (sized: boolean) =>
    metaTags({
      title: 'Mule',
      description: 'd',
      url: 'https://salvageunion.io/chassis/mule/',
      themeColor: '#000',
      image: { url: 'https://assets.salvageunion.io/chassis/mule-880q80.webp', alt: 'Mule', sized },
    }).map((tag) => tag.attrs.property ?? tag.attrs.name)

  it('claims 1200×630 only for the site’s own card, never for art of another shape', () => {
    expect(tags(true)).toContain('og:image:width')
    expect(tags(false)).not.toContain('og:image:width')
    expect(tags(false)).not.toContain('og:image:height')
    expect(tags(false)).toContain('og:image')
    expect(tags(false)).toContain('twitter:image')
  })
})
