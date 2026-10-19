import { describe, expect, test } from 'bun:test'
import type { GalleryRun } from '../lib/galleryHtml'
import { escapeHtml, renderGallery } from '../lib/galleryHtml'
import type { GalleryPage, GallerySection } from '../lib/galleryPages'
import { BUILDER_BASE, GALLERY_SECTIONS, isBuilderPath, pageSlug } from '../lib/galleryPages'

const ALL_PAGES = GALLERY_SECTIONS.flatMap((s) => s.pages)

describe('the page list', () => {
  test('every page has its own file stem', () => {
    const slugs = GALLERY_SECTIONS.flatMap((s) => s.pages).map(pageSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  test('an app page is the base or under it; an SRD page that shares its prefix is not', () => {
    expect(isBuilderPath(BUILDER_BASE)).toBe(true)
    expect(isBuilderPath(`${BUILDER_BASE}/pilots/new`)).toBe(true)
    expect(isBuilderPath(`${BUILDER_BASE}er/`)).toBe(false)
    expect(isBuilderPath('/chassis/mule/')).toBe(false)
  })
})

describe('renderGallery', () => {
  const run = {
    sha: 'abcdef1234',
    pr: 7,
    base: 'http://localhost:4321',
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
        failures: ['/x: answered 500'],
      },
      run
    )
    expect(html).toContain('PR #7 gallery')
    expect(html).toContain(`shots/${pageSlug(first)}-desk.jpg`)
    expect(html).toContain('&lt;Contents&gt;')
    expect(html).toContain('1 not captured')
    expect(html).not.toContain('id="app-edit"')
  })

  test('escapes markup', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  })
})

describe('renderGallery, page by page', () => {
  const run = (extra: Partial<GalleryRun> = {}): GalleryRun => ({
    sha: 'abcdef1234',
    base: 'http://site',
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
    path: '/chassis/',
    name: 'Chassis',
    note: 'A "note"',
    chips: ['Art'],
  }
  const appIn: GalleryPage = {
    path: '/build/pilots/new',
    name: 'New',
    note: '',
    signedIn: true,
  }
  const appOut: GalleryPage = { path: '/build/starter', name: 'Starter', note: '' }
  const render = (pages: GalleryPage[], r: GalleryRun, og = new Map()) =>
    renderGallery(
      { sections: [section(pages)], shot: new Set(pages.map(pageSlug)), og, failures: [] },
      r
    )

  test('a linkable run links each signed-out page on the base, never a signed-in one', () => {
    const html = render([srdPage, appIn, appOut], run())
    expect(html).toContain('<a class="shot__frames" href="http://site/chassis/">')
    expect(html).toContain('href="http://site/build/starter"')
    expect(html).not.toContain('href="http://site/build/pilots/new"')
    expect(html).toContain('<span class="chip">Signed in</span>')
    expect(html).toContain('<span class="chip">Art</span>')
    expect(html).toContain('<span class="shot__path">/build/pilots/new</span>')
  })

  test('an unlinkable run frames the shots without a link', () => {
    expect(render([srdPage], run({ linkable: false }))).not.toContain('<a class="shot__frames"')
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
      [pageSlug(appOut), { title: 'The app', description: 'Builder', image: true }],
    ])
    const html = render([srdPage, appIn, appOut], run(), og)
    expect(html).toContain('Link previews <small>2 pages</small>')
    expect(html).toContain('salvageunion.io/chassis/')
    expect(html).toContain('salvageunion.io/build/starter')
    expect(html).toContain(`shots/${pageSlug(appOut)}-og.png`)
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
    expect(pageSlug({ path: '/' })).toBe('home')
    expect(pageSlug({ path: '/search?q=drill' })).toBe('search-q-drill')
    expect(pageSlug({ path: '/build/', signedIn: true })).toBe('in-build')
    expect(pageSlug({ path: ':Pilot' })).toBe('pilot')
    expect(pageSlug({ path: '/schema/Chassis/item/“x”/' })).toBe('schema-chassis-item-x')
  })

  test('every section has pages, a unique id, and every page a note', () => {
    const ids = GALLERY_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of GALLERY_SECTIONS) expect(s.pages.length).toBeGreaterThan(0)
    for (const p of ALL_PAGES) expect(p.note.length).toBeGreaterThan(0)
  })
})
