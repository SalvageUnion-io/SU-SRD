/**
 * `renderDocument` — the seam where the build's two secrets (hashed asset URLs,
 * collected island props) meet a page that knows neither.
 *
 * Both are injected by string surgery on `</head>` / `</body>` rather than
 * threaded through the React tree, so the injection points, their ORDER, and
 * the `<!doctype>` prefix are wire format: `src/runtime/islands.client.ts`
 * parses the props tag it emits, and the parity gate reads the head tags
 * `BaseLayout` produces from `DocumentMeta`.
 */

import { describe, expect, it } from 'bun:test'
import { SITE_URL } from '../../src/lib/constants'
import { Island } from '../../src/runtime/Island'
import type { BuildAssets } from '../document'
import { renderDocument } from '../document'
import type { DocumentMeta } from '../types'

const NO_ASSETS: BuildAssets = { scripts: [], styles: [], built: {} }

const ASSETS: BuildAssets = {
  scripts: ['/assets/islands-DEADBEEF.js'],
  styles: ['/assets/styles-CAFEBABE.css'],
  built: { 'src/assets/map.webp': '/assets/map-F00D.webp' },
}

/** Render a page body through the `base` shell at `/about/`. */
function renderAbout(meta: DocumentMeta = {}, assets: BuildAssets = NO_ASSETS): string {
  return renderDocument({
    meta,
    pathname: '/about/',
    children: <p>body</p>,
    assets,
  })
}

/**
 * Render through the `bare` shell, so the only islands on the page are the
 * ones under test. `BaseLayout` mounts three chrome islands of its own (search,
 * mobile search, mobile nav), which would claim `i0`–`i2` first.
 */
function renderBare(children: React.ReactNode, assets: BuildAssets = NO_ASSETS): string {
  return renderDocument({
    meta: {},
    pathname: '/bare/',
    shell: 'bare',
    assets,
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

describe('document shell', () => {
  it('prefixes the doctype exactly once', () => {
    const html = renderAbout()
    expect(html.startsWith('<!doctype html><html lang="en">')).toBe(true)
    expect(html.split('<!doctype html>')).toHaveLength(2)
  })

  it('injects stylesheets before scripts, immediately before </head>', () => {
    // Order matters: the stylesheet must be discovered before the module
    // script so the browser does not paint unstyled while islands load.
    const html = renderAbout({}, ASSETS)

    expect(html).toContain(
      '<link rel="stylesheet" href="/assets/styles-CAFEBABE.css">' +
        '<script type="module" src="/assets/islands-DEADBEEF.js"></script></head>'
    )
    expect(html.indexOf('styles-CAFEBABE.css')).toBeLessThan(html.indexOf('islands-DEADBEEF.js'))
  })

  it('injects nothing when there are no assets', () => {
    expect(renderAbout()).not.toContain('rel="stylesheet"')
  })

  it('throws rather than emitting a document it could not inject into', () => {
    // A page whose markup has no </head> would silently ship with no
    // stylesheet and no islands entry — every island on the site dead.
    expect(() =>
      renderDocument({
        meta: {},
        pathname: '/x/',
        children: <p>no html shell here</p>,
        assets: ASSETS,
        shell: 'bare',
      })
    ).toThrow('rendered document has no </head>')

    expect(() =>
      renderDocument({
        meta: {},
        pathname: '/x/',
        children: (
          <html lang="en">
            <head>
              <title>t</title>
            </head>
          </html>
        ),
        assets: ASSETS,
        shell: 'bare',
      })
    ).toThrow('rendered document has no </body>')
  })
})

describe('island props payload', () => {
  it('emits one JSON script for the whole page, keyed by data-island-id', () => {
    const html = renderBare(
      <>
        <Island name="SearchIsland" client="idle" props={{ q: 'aegis' }} />
        <Island name="SchemaViewerIsland" client="visible" props={{ schemaId: 'chassis' }} />
      </>
    )

    expect(html).toContain(
      '<script type="application/json" data-island-props>' +
        '{"i0":{"q":"aegis"},"i1":{"schemaId":"chassis"}}' +
        '</script></body>'
    )
    // One tag per page, not one per island — the 17.3 MB lesson.
    expect(html.split('data-island-props')).toHaveLength(2)
  })

  it('collects the chrome islands BaseLayout renders, not only the page’s own', () => {
    // TopNavigation's three islands are part of every base-shell page, so they
    // take the first ids and the page's own island follows them.
    const html = renderAbout()
    expect(html).toContain('data-island="SearchIsland" data-client="idle" data-island-id="i0"')
    expect(html).toContain(
      'data-island="MobileSearchIsland" data-client="idle" data-island-id="i1"'
    )
    expect(html).toContain('data-island="MobileNavIsland" data-client="idle" data-island-id="i2"')
    // …and none of them carries props, so the page ships no props tag at all.
    // MobileNavIsland taking zero props is what removed 17.3 MB from the build.
    expect(html).not.toContain('data-island-props')
  })

  it('escapes `<` so a payload can never close its own script tag', () => {
    const html = renderBare(
      <Island name="SearchIsland" props={{ html: '</script><script>alert(1)</script>' }} />
    )

    const payload = /data-island-props>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(payload).not.toContain('</script>')
    expect(payload).toContain('\\u003c/script>')
    // Still lossless: the browser's JSON parser reads \u003c back as `<`.
    expect(JSON.parse(payload)).toEqual({ i0: { html: '</script><script>alert(1)</script>' } })
  })

  it('closes the collection window even when the page throws', () => {
    // The window is module-global. Leaking an open one would make the NEXT
    // page's islands share this page's id counter and prop bag.
    const Boom = (): never => {
      throw new Error('page exploded')
    }

    expect(() => renderBare(<Boom />)).toThrow('page exploded')

    expect(renderBare(<Island name="SearchIsland" props={{ q: 'after' }} />)).toContain(
      '{"i0":{"q":"after"}}'
    )
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
    expect(html).toContain('<title>Salvage Union System Reference Document</title>')
    expect(metaContent(html, 'description')).toContain('System Reference Document (SRD)')
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
      assets: ASSETS,
    })

    expect(html).toContain('<title>og card</title>')
    expect(html).not.toContain('ignored')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('og:title')
    // …but it is still a full member of the island + asset system.
    expect(html).toContain('<link rel="stylesheet" href="/assets/styles-CAFEBABE.css">')
    expect(html).toContain('{"i0":{"slug":"aegis"}}')
  })
})
