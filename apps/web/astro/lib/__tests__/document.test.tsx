/**
 * `renderDocument`: the seam where what only the build knows (the base
 * stylesheet with its font preloads) meets a page that does not, and where
 * the page's islands are collected for `Page.astro` to render.
 *
 * The head and body it returns are what `Page.astro` emits.
 */

import { describe, expect, it } from 'bun:test'
import type { ReactNode } from 'react'
import { SITE_URL } from '../../../src/lib/constants'
import { THEME_COLOR } from '../../../src/lib/documentHead'
import type { DocumentMeta, DocumentShell } from '../../../src/reference/types'
import { Island } from '../../../src/runtime/Island'
import type { PageAssets } from '../document'
import { renderDocument as renderParts } from '../document'
import { documentHtml } from './pages'

const ASSETS: PageAssets = {
  stylesheet: {
    href: '/assets/base-CAFEBABE.css',
    fonts: ['/assets/barlow-latin-400-normal-F0E7.woff2'],
  },
  built: { 'src/assets/map.webp': '/assets/map-F00D.webp' },
}

type Input = {
  meta: DocumentMeta
  pathname: string
  children: ReactNode
  shell?: DocumentShell
  assets?: PageAssets
}

/** One page module's document at `pathname`, as `Page.astro` stitches it. */
function renderDocument({ meta, pathname, children, shell, assets = ASSETS }: Input): string {
  const module = { pattern: pathname, page: () => ({ meta, children, shell }) }
  return documentHtml(renderParts(module, {}, undefined, assets))
}

/** Render a page body through the `base` shell at `/about/`. */
function renderAbout(meta: DocumentMeta = {}, assets: PageAssets = ASSETS): string {
  return renderDocument({ meta, pathname: '/about/', children: <p>body</p>, assets })
}

/**
 * Render through the `bare` shell, so the only islands on the page are the
 * ones under test. `BaseLayout` mounts chrome islands of its own (search,
 * account, mobile nav), which would claim the first ids.
 */
function renderBare(children: ReactNode): string {
  return renderDocument({
    meta: {},
    pathname: '/bare/',
    shell: 'bare',
    children: (
      <html lang="en">
        <head>
          <title>bare</title>
        </head>
        <body>{children}</body>
      </html>
    ),
  })
}

/** The `content` of the first `<meta>` carrying `name`/`property` = key. */
function metaContent(html: string, key: string): string | undefined {
  const match = new RegExp(
    `<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"|<meta[^>]*content="([^"]*)"[^>]*(?:name|property)="${key}"`
  ).exec(html)
  return match ? (match[1] ?? match[2]) : undefined
}

describe('document head', () => {
  it('links the base stylesheet last in the head', () => {
    expect(renderAbout()).toContain('<link rel="stylesheet" href="/assets/base-CAFEBABE.css">')
  })

  it('preloads the fonts ahead of the stylesheet, in CORS mode', () => {
    // Discovered from <head> rather than from the parsed stylesheet, so the
    // first paint is already in Barlow and the swap re-wraps nothing.
    expect(renderAbout()).toContain(
      '<link rel="preload" href="/assets/barlow-latin-400-normal-F0E7.woff2" as="font" type="font/woff2" crossorigin>' +
        '<link rel="stylesheet" href="/assets/base-CAFEBABE.css">'
    )
  })

  it('preloads the tagline’s hand only on a page that asks for it', () => {
    const assets = {
      ...ASSETS,
      stylesheet: { ...ASSETS.stylesheet, scriptFont: '/assets/caveat-latin-600-normal-C4.woff2' },
    }
    const tag =
      '<link rel="preload" href="/assets/caveat-latin-600-normal-C4.woff2" as="font" type="font/woff2" crossorigin>'

    expect(renderAbout({ preloadScriptFont: true }, assets)).toContain(
      `${tag}<link rel="stylesheet" href="/assets/base-CAFEBABE.css">`
    )
    expect(renderAbout({}, assets)).not.toContain('caveat')
    expect(renderAbout({ preloadScriptFont: true })).not.toContain('caveat')
  })

  it('throws rather than emitting a document it could not split', () => {
    // A page whose markup is not one <html> document would ship with no
    // stylesheet and no islands entry: every island on the site dead.
    expect(() =>
      renderDocument({ meta: {}, pathname: '/x/', children: <p>no html</p>, shell: 'bare' })
    ).toThrow('/x/ did not render one <html> document')
  })
})

/** The islands a bare page collects. */
function bareIslands(children: ReactNode) {
  const module = {
    pattern: '/bare/',
    page: () => ({
      meta: {},
      shell: 'bare' as const,
      children: (
        <html lang="en">
          <head>
            <title>bare</title>
          </head>
          <body>{children}</body>
        </html>
      ),
    }),
  }
  return renderParts(module, {}, undefined, ASSETS).islands
}

describe('collected islands', () => {
  it('hands Page.astro every island by its marker id, with its props', () => {
    const islands = bareIslands(
      <>
        <Island name="SearchIsland" client="idle" props={{ q: 'aegis' }} />
        <Island name="SchemaViewerIsland" client="visible" props={{ schemaId: 'chassis' }} />
      </>
    )
    expect(islands.i0?.props).toEqual({ q: 'aegis' })
    expect(islands.i1?.props).toEqual({ schemaId: 'chassis' })
    // No props in the page's markup: Astro serializes them onto each island.
    const html = renderBare(<Island name="SearchIsland" client="idle" props={{ q: 'aegis' }} />)
    expect(html).toContain('<astro-island data-island="SearchIsland"></astro-island>')
    expect(html).not.toContain('aegis')
  })

  it('collects the chrome islands BaseLayout renders, not only the page’s own', () => {
    // TopNavigation's chrome islands are part of every base-shell page, so they
    // take the first ids and the page's own island follows them.
    const module = { pattern: '/about/', page: () => ({ meta: {}, children: <p>body</p> }) }
    const { islands } = renderParts(module, {}, undefined, ASSETS)
    expect(Object.values(islands).map((island) => `${island.name}:${island.client}`)).toEqual([
      'SearchIsland:interaction',
      'AccountIsland:idle',
      'MobileSearchIsland:interaction',
      'AccountAvatarIsland:idle',
      'MobileNavIsland:interaction',
      'PeekIsland:interaction',
    ])
    // …and none of them carries props. MobileNavIsland taking zero props is
    // what removed 17.3 MB from the build.
    for (const island of Object.values(islands)) expect(island.props).toEqual({})
  })

  it('closes the collection window even when the page throws', () => {
    // The window is module-global. Leaking an open one would make the NEXT
    // page's islands share this page's id counter.
    const Boom = (): never => {
      throw new Error('page exploded')
    }

    expect(() => renderBare(<Boom />)).toThrow('page exploded')

    expect(bareIslands(<Island name="SearchIsland" props={{ q: 'after' }} />)).toEqual({
      i0: {
        name: 'SearchIsland',
        client: 'load',
        props: { q: 'after' },
        hydrate: false,
        trigger: undefined,
        when: undefined,
      },
    })
  })
})

describe('head assembly from DocumentMeta', () => {
  it('derives the canonical URL from the trailing-slashed pathname', () => {
    expect(renderAbout()).toContain(`<link rel="canonical" href="${SITE_URL}/about/"/>`)
  })

  it('lets a page override the canonical URL outright', () => {
    const html = renderAbout({ canonical: 'https://example.com/elsewhere/' })
    expect(html).toContain('<link rel="canonical" href="https://example.com/elsewhere/"/>')
    expect(html).not.toContain(`href="${SITE_URL}/about/"`)
  })

  it('falls back to the site title and description', () => {
    const html = renderAbout()
    expect(html).toContain('<title>SalvageUnion.io</title>')
    expect(metaContent(html, 'description')).toContain(
      'rules reference and character manager for the Salvage Union TTRPG'
    )
  })

  it('mirrors title and description into og: and twitter:', () => {
    const html = renderAbout({ title: 'Aegis', description: 'A chassis.' })

    expect(html).toContain('<title>Aegis</title>')
    expect(metaContent(html, 'og:title')).toBe('Aegis')
    expect(metaContent(html, 'twitter:title')).toBe('Aegis')
    expect(metaContent(html, 'og:description')).toBe('A chassis.')
    expect(metaContent(html, 'twitter:description')).toBe('A chassis.')
    expect(metaContent(html, 'og:url')).toBe(`${SITE_URL}/about/`)
    expect(metaContent(html, 'og:type')).toBe('website')
  })

  it('absolutizes a site-relative og:image and leaves an absolute one alone', () => {
    expect(metaContent(renderAbout(), 'og:image')).toBe(`${SITE_URL}/og-image.png`)
    expect(metaContent(renderAbout({ ogImage: '/x.og.png' }), 'og:image')).toBe(
      `${SITE_URL}/x.og.png`
    )

    const absolute = renderAbout({ ogImage: 'https://cdn.example.com/x.png' })
    expect(metaContent(absolute, 'og:image')).toBe('https://cdn.example.com/x.png')
    expect(metaContent(absolute, 'twitter:image')).toBe('https://cdn.example.com/x.png')
  })

  it('defaults og:image:alt to the title, and honours an explicit alt', () => {
    expect(metaContent(renderAbout({ title: 'Aegis' }), 'og:image:alt')).toBe('Aegis')
    expect(
      metaContent(renderAbout({ title: 'Aegis', ogImageAlt: 'Aegis art' }), 'og:image:alt')
    ).toBe('Aegis art')
  })

  it("emits the manifest's theme-color on every page", () => {
    expect(metaContent(renderAbout(), 'theme-color')).toBe(THEME_COLOR)
  })

  it('gives a link preview its own title, description and theme-color (issue 1280)', () => {
    const html = renderAbout({
      title: 'Scrapper - Chassis - Salvage Union SRD',
      description: 'The body, for search.',
      ogTitle: 'Scrapper',
      ogDescription: 'Chassis · Tech Level 1 · Workshop Manual · p.104',
      themeColor: 'var-free-tone',
    })
    expect(html).toContain('<title>Scrapper - Chassis - Salvage Union SRD</title>')
    expect(metaContent(html, 'description')).toBe('The body, for search.')
    expect(metaContent(html, 'og:title')).toBe('Scrapper')
    expect(metaContent(html, 'twitter:title')).toBe('Scrapper')
    expect(metaContent(html, 'og:description')).toBe(
      'Chassis · Tech Level 1 · Workshop Manual · p.104'
    )
    expect(metaContent(html, 'twitter:description')).toBe(
      'Chassis · Tech Level 1 · Workshop Manual · p.104'
    )
    expect(metaContent(html, 'og:image:alt')).toBe('Scrapper')
    expect(metaContent(html, 'theme-color')).toBe('var-free-tone')
  })

  it('emits robots only for a noindex page', () => {
    expect(renderAbout()).not.toContain('name="robots"')
    expect(metaContent(renderAbout({ noindex: true }), 'robots')).toBe('noindex, nofollow')
  })

  it('emits a preload link only when the page asks for one', () => {
    expect(renderAbout()).not.toContain('/hero.webp')
    expect(renderAbout({ preloadImage: '/hero.webp' })).toContain(
      '<link rel="preload" href="/hero.webp" as="image"/>'
    )
  })
})

describe('JSON-LD', () => {
  it('emits nothing when the page declares none', () => {
    expect(renderAbout()).not.toContain('application/ld+json')
  })

  it('emits the primary block and each additional block separately', () => {
    const html = renderAbout({
      structuredData: { '@type': 'WebSite', name: 'SRD' },
      additionalStructuredData: [
        { '@type': 'BreadcrumbList', itemListElement: [] },
        { '@type': 'Product', name: 'Aegis' },
      ],
    })

    const blocks = [
      ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map((match) => JSON.parse(match[1] ?? 'null') as unknown)

    expect(blocks).toEqual([
      { '@type': 'WebSite', name: 'SRD' },
      { '@type': 'BreadcrumbList', itemListElement: [] },
      { '@type': 'Product', name: 'Aegis' },
    ])
  })
})

describe('the breadcrumb JSON-LD', () => {
  it('keeps absolute URLs while the visible trail links root-relative', () => {
    const html = renderAbout({
      breadcrumbs: [
        { name: 'Contents', url: 'https://salvageunion.io/' },
        { name: 'About', url: 'https://salvageunion.io/about/' },
      ],
    })
    const [list] = [
      ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map((match) => JSON.parse(match[1] ?? 'null') as { itemListElement: { item: string }[] })

    expect(list?.itemListElement.map((crumb) => crumb.item)).toEqual([
      'https://salvageunion.io/',
      'https://salvageunion.io/about/',
    ])
    expect(html).toContain('href="/"')
  })
})

describe("the 'bare' shell", () => {
  it('renders children AS the document and ignores meta', () => {
    // og-card is written this way: routing it through BaseLayout would add a
    // canonical link and the whole og/twitter block the baseline never emits.
    const html = renderDocument({
      meta: { title: 'ignored', noindex: true },
      pathname: '/og-card/',
      shell: 'bare',
      children: (
        <html lang="en">
          <head>
            <title>og card</title>
          </head>
          <body>
            <Island name="OgCardIsland" props={{ slug: 'aegis' }} />
          </body>
        </html>
      ),
    })

    expect(html).toContain('<title>og card</title>')
    expect(html).not.toContain('ignored')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('og:title')
    // …but it is still a full member of the island + asset system.
    expect(html).toContain('<link rel="stylesheet" href="/assets/base-CAFEBABE.css">')
    expect(html).toContain('<astro-island data-island="OgCardIsland">')
  })
})
