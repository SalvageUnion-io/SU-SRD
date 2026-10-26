/**
 * The route boundary: `fillPattern` / `withTrailingSlash` / `astroPaths`, and
 * the `RouteContext` `renderDocument` hands a page: its params, its props, and
 * a `url`/`pathname` that always carry a trailing slash.
 */

import { describe, expect, it } from 'bun:test'
import { SITE_URL } from '../../../src/lib/constants'
import { notFoundPage } from '../../../src/reference/pages/404.page'
import type { PageModule, RouteContext } from '../../../src/reference/types'
import type { PageAssets } from '../document'
import { renderDocument } from '../document'
import { astroPaths, fillPattern, withTrailingSlash } from '../routePath'
import { documentHtml } from './pages'

const ASSETS: PageAssets = {
  stylesheet: { href: '/assets/base-CAFEBABE.css' },
  built: { 'src/assets/map.webp': '/assets/map-F00D.webp' },
}

/** A page module that records the context it was called with. */
function spyPage<Params extends Record<string, string>, Props>(
  module: Omit<PageModule<Params, Props>, 'page'>
): { module: PageModule<Params, Props>; contexts: RouteContext<Params, Props>[] } {
  const contexts: RouteContext<Params, Props>[] = []
  return {
    contexts,
    module: {
      ...module,
      page: (ctx) => {
        contexts.push(ctx)
        return { meta: { title: 'spy' }, children: <p>spy</p> }
      },
    },
  }
}

/** Every page a module emits, as Astro renders it: its static paths, then the shell. */
function renderAll<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>
): string[] {
  return astroPaths(module.getStaticPaths).map(({ params, props }) =>
    documentHtml(renderDocument(module, params, props.page, ASSETS))
  )
}

describe('withTrailingSlash', () => {
  it('leaves the site root as a bare slash', () => {
    expect(withTrailingSlash('/')).toBe('/')
    expect(withTrailingSlash('/about')).toBe('/about/')
  })

  it('is idempotent', () => {
    expect(withTrailingSlash(withTrailingSlash('/chassis'))).toBe('/chassis/')
  })
})

describe('fillPattern', () => {
  it('substitutes every [param] in the pattern', () => {
    expect(fillPattern('/[schemaId]', { schemaId: 'chassis' })).toBe('/chassis')
    expect(
      fillPattern('/[schemaId]/[itemId]/pattern/[patternId]', {
        schemaId: 'chassis',
        itemId: 'aegis',
        patternId: 'scrapper',
      })
    ).toBe('/chassis/aegis/pattern/scrapper')
  })

  it('leaves a pattern with no params alone', () => {
    expect(fillPattern('/about', {})).toBe('/about')
  })

  it('throws on a missing param rather than emitting a literal [bracket] path', () => {
    expect(() => fillPattern('/[schemaId]', {})).toThrow(
      'Missing parameter "schemaId" for pattern "/[schemaId]"'
    )
  })
})

describe('astroPaths', () => {
  it('gives a module with no getStaticPaths exactly one path', () => {
    expect(astroPaths(undefined)).toEqual([{ params: {}, props: { page: undefined } }])
  })

  it('carries each path’s props under `props.page`', () => {
    const paths = astroPaths(() => [
      { params: { schemaId: 'chassis' }, props: { label: 'Chassis' } },
      { params: { schemaId: 'systems' }, props: { label: 'Systems' } },
    ])
    expect(paths.map((path) => path.params.schemaId)).toEqual(['chassis', 'systems'])
    expect(paths.map((path) => path.props.page.label)).toEqual(['Chassis', 'Systems'])
  })

  it('emits nothing for a module whose getStaticPaths returns nothing', () => {
    expect(astroPaths(() => [])).toEqual([])
  })
})

describe('the RouteContext a page is handed', () => {
  it('carries the params, the props, and a trailing-slashed url + pathname', () => {
    const { module, contexts } = spyPage<{ schemaId: string; itemId: string }, { rank: number }>({
      pattern: '/[schemaId]/[itemId]',
      getStaticPaths: () => [
        { params: { schemaId: 'chassis', itemId: 'aegis' }, props: { rank: 3 } },
      ],
    })

    renderAll(module)

    const ctx = contexts[0]
    expect(ctx?.params).toEqual({ schemaId: 'chassis', itemId: 'aegis' })
    expect(ctx?.props).toEqual({ rank: 3 })
    expect(ctx?.pathname).toBe('/chassis/aegis/')
    expect(ctx?.url.href).toBe(`${SITE_URL}/chassis/aegis/`)
  })

  it('hands the page the emitted asset URLs, but not the stylesheet', () => {
    const { module, contexts } = spyPage<Record<string, string>, undefined>({ pattern: '/about' })

    renderAll(module)

    expect(contexts[0]?.builtAssets).toEqual({ 'src/assets/map.webp': '/assets/map-F00D.webp' })
  })

  it('keeps the site root at `/`, not `//`', () => {
    const { module, contexts } = spyPage<Record<string, string>, undefined>({ pattern: '/' })

    renderAll(module)

    expect(contexts[0]?.pathname).toBe('/')
    expect(contexts[0]?.url.href).toBe(`${SITE_URL}/`)
  })

  it('renders through the base shell: chrome, canonical and the stylesheet', () => {
    const { module } = spyPage<Record<string, string>, undefined>({ pattern: '/about' })

    const [html = ''] = renderAll(module)

    expect(html).toContain('<title>spy</title>')
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/about/"/>`)
    expect(html).toContain('<main')
    expect(html).toContain('<link rel="stylesheet" href="/assets/base-CAFEBABE.css">')
  })

  it('gives the 404 one search: its band, not the Union bar too', () => {
    // `/404` is emitted as `404.html`, but the layout reads the route's own
    // pathname (`/404/`), so `BaseLayout` still drops the bar's field.
    const [html = ''] = renderAll(notFoundPage)

    expect(html.match(/data-island="SearchIsland"/g)).toHaveLength(1)
    expect(html).toContain('su-hero-search')
  })
})
