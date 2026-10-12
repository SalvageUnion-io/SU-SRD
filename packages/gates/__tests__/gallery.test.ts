import { describe, expect, test } from 'bun:test'
import type { GalleryRun } from '../lib/galleryHtml'
import { escapeHtml, renderGallery } from '../lib/galleryHtml'
import type { GalleryPage, GallerySection } from '../lib/galleryPages'
import { GALLERY_SECTIONS, pageSlug } from '../lib/galleryPages'

const ALL_PAGES = GALLERY_SECTIONS.flatMap((s) => s.pages)

describe('the page list', () => {
  test('every page has its own file stem', () => {
    const slugs = GALLERY_SECTIONS.flatMap((s) => s.pages).map(pageSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('renderGallery', () => {
  const run = {
    sha: 'abcdef1234',
    pr: 7,
    bases: { srd: 'http://localhost:4321', itun: 'http://localhost:5173' },
    linkable: false,
    capturedAt: '2026-10-12 09:00 UTC',
  }

  test('shows only the pages that were shot, escaped, with the failures on top', () => {
    const [first] = GALLERY_SECTIONS[0]?.pages ?? []
    if (!first) throw new Error('no pages')
    const html = renderGallery(
      {
        sections: GALLERY_SECTIONS,
        shot: new Set([pageSlug(first)]),
        og: new Map([[pageSlug(first), { title: '<Contents>', image: true }]]),
        failures: ['srd /x: answered 500'],
      },
      run
    )
    expect(html).toContain('PR #7 gallery')
    expect(html).toContain(`shots/${pageSlug(first)}-desk.jpg`)
    expect(html).toContain('&lt;Contents&gt;')
    expect(html).toContain('1 not captured')
    expect(html).not.toContain('id="itun-edit"')
  })

  test('escapes markup', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  })
})

describe('renderGallery, page by page', () => {
  const run = (extra: Partial<GalleryRun> = {}): GalleryRun => ({
    sha: 'abcdef1234',
    bases: { srd: 'http://srd', itun: 'http://itun' },
    linkable: true,
    capturedAt: 'then',
    ...extra,
  })
  const section = (pages: GalleryPage[]): GallerySection => ({
    id: 'one',
    title: 'One & only',
    tone: 'var(--rust)',
    intro: 'Intro <b>',
    pages,
  })
  const srdPage: GalleryPage = {
    site: 'srd',
    path: '/schema/chassis/',
    name: 'Chassis',
    note: 'A "note"',
    chips: ['Art'],
  }
  const itunIn: GalleryPage = {
    site: 'itun',
    path: '/pilots/new',
    name: 'New',
    note: '',
    signedIn: true,
  }
  const itunOut: GalleryPage = { site: 'itun', path: '/starter', name: 'Starter', note: '' }
  const render = (pages: GalleryPage[], r: GalleryRun, og = new Map()) =>
    renderGallery(
      { sections: [section(pages)], shot: new Set(pages.map(pageSlug)), og, failures: [] },
      r
    )

  test('a linkable run links each signed-out page to its site, never a signed-in one', () => {
    const html = render([srdPage, itunIn, itunOut], run())
    expect(html).toContain('<a class="shot__frames" href="http://srd/schema/chassis/">')
    expect(html).toContain('href="http://itun/starter"')
    expect(html).not.toContain('href="http://itun/pilots/new"')
    expect(html).toContain('<span class="chip">Signed in</span>')
    expect(html).toContain('<span class="chip">Art</span>')
    expect(html).toContain('ITUN /pilots/new')
  })

  test('an unlinkable run, or a site with no base, frames the shots without a link', () => {
    expect(render([srdPage], run({ linkable: false }))).not.toContain('<a class="shot__frames"')
    expect(render([itunOut], run({ bases: { srd: 'http://srd' } }))).not.toContain(
      '<a class="shot__frames"'
    )
  })

  test('no PR titles it "Gallery" with no PR link; one page reads "1 page"', () => {
    const html = render([srdPage], run())
    expect(html).toContain('<title>Gallery</title>')
    expect(html).not.toContain('/pull/')
    expect(html).toContain('1 page</small>')
    expect(html).toContain('from abcdef1.')
    expect(html).not.toContain('not captured')
  })

  test('escapes the section and page text', () => {
    const html = render([srdPage], run())
    expect(html).toContain('One &amp; only')
    expect(html).toContain('Intro &lt;b&gt;')
    expect(html).toContain('A &quot;note&quot;')
  })

  test('link previews: signed-out pages only, their og text, or the name and no image', () => {
    const og = new Map([
      [pageSlug(itunOut), { title: 'ITUN', description: 'Builder', image: true }],
    ])
    const html = render([srdPage, itunIn, itunOut], run(), og)
    expect(html).toContain('Link previews <small>2 pages</small>')
    expect(html).toContain('salvageunion.io/schema/chassis/')
    expect(html).toContain('intheunionnow.com/starter')
    expect(html).toContain(`shots/${pageSlug(itunOut)}-og.png`)
    expect(html).toContain('<strong>Chassis</strong>')
    expect(html).toContain('No og:image')
    expect(html).toContain('<span>Builder</span>')
  })

  test('a section with nothing shot is dropped from the page and the jump list', () => {
    const html = renderGallery(
      { sections: [section([srdPage])], shot: new Set(), og: new Map(), failures: ['x'] },
      run()
    )
    expect(html).not.toContain('id="one"')
    expect(html).not.toContain('href="#one"')
    expect(html).toContain('0 pages.')
  })
})

describe('pageSlug', () => {
  test('home, query strings, signed-in and case', () => {
    expect(pageSlug({ site: 'srd', path: '/' })).toBe('srd-home')
    expect(pageSlug({ site: 'srd', path: '/search?q=drill' })).toBe('srd-search-q-drill')
    expect(pageSlug({ site: 'itun', path: '/', signedIn: true })).toBe('itun-in-home')
    expect(pageSlug({ site: 'itun', path: ':Pilot' })).toBe('itun-pilot')
    expect(pageSlug({ site: 'srd', path: '/schema/Chassis/item/“x”/' })).toBe(
      'srd-schema-chassis-item-x'
    )
  })

  test('every section has pages, a unique id, and every page a note', () => {
    const ids = GALLERY_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of GALLERY_SECTIONS) expect(s.pages.length).toBeGreaterThan(0)
    for (const p of ALL_PAGES) expect(p.note.length).toBeGreaterThan(0)
  })
})
