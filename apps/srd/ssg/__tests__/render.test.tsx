/**
 * The route registry boundary: `resolveRoutes` / `renderRoute` / `register` /
 * `registerDocument`.
 *
 * `ssg/routes.ts` is the one place that says what the site emits, and it says it
 * entirely through these four functions. What they must get right is the
 * `RouteContext` a page is handed (its params, its props, and a `url`/`pathname`
 * that always carry a trailing slash) and the two things `register` erases on
 * the way out: the concrete route path, and whether that path is sitemap-eligible.
 *
 * `fillPattern` has its own cases in `outputPath.test.ts`, next to the URL→file
 * mapping it composes with; this file does not repeat them.
 */

import { describe, expect, it } from 'bun:test'
import { SITE_URL } from '../../src/lib/constants'
import { Island } from '../../src/runtime/Island'
import type { BuildAssets } from '../document'
import { register, registerDocument, resolveRoutes, withTrailingSlash } from '../render'
import type { PageModule, RouteContext } from '../types'

const NO_ASSETS: BuildAssets = { scripts: [], styles: [], built: {} }

const ASSETS: BuildAssets = {
  scripts: ['/assets/islands-DEADBEEF.js'],
  styles: ['/assets/styles-CAFEBABE.css'],
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

describe('withTrailingSlash', () => {
  it('leaves the site root as a bare slash', () => {
    // `//` would be a protocol-relative URL once resolved against SITE_URL.
    expect(withTrailingSlash('/')).toBe('/')
  })

  it('is idempotent', () => {
    expect(withTrailingSlash(withTrailingSlash('/about'))).toBe('/about/')
  })
})

describe('resolveRoutes', () => {
  it('gives a module with no getStaticPaths exactly one route', () => {
    const { module } = spyPage<Record<string, string>, undefined>({ pattern: '/about' })
    const resolved = resolveRoutes(module)

    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.route).toBe('/about')
    expect(resolved[0]?.path.params).toEqual({})
  })

  it('gives one route per static path, with the params substituted in', () => {
    const { module } = spyPage<{ schemaId: string }, { label: string }>({
      pattern: '/schema/[schemaId]',
      getStaticPaths: () => [
        { params: { schemaId: 'chassis' }, props: { label: 'Chassis' } },
        { params: { schemaId: 'systems' }, props: { label: 'Systems' } },
      ],
    })

    const resolved = resolveRoutes(module)

    expect(resolved.map((entry) => entry.route)).toEqual(['/schema/chassis', '/schema/systems'])
    expect(resolved.map((entry) => entry.path.props.label)).toEqual(['Chassis', 'Systems'])
  })

  it('emits nothing for a module whose getStaticPaths returns nothing', () => {
    const { module } = spyPage<{ id: string }, undefined>({
      pattern: '/schema/[id]',
      getStaticPaths: () => [],
    })

    expect(resolveRoutes(module)).toEqual([])
  })
})

describe('the RouteContext a page is handed', () => {
  it('carries the params, the props, and a trailing-slashed url + pathname', () => {
    const { module, contexts } = spyPage<{ schemaId: string; itemId: string }, { rank: number }>({
      pattern: '/schema/[schemaId]/item/[itemId]',
      getStaticPaths: () => [
        { params: { schemaId: 'chassis', itemId: 'aegis' }, props: { rank: 3 } },
      ],
    })

    register(module).resolve()[0]?.render(ASSETS)

    const ctx = contexts[0]
    expect(ctx?.params).toEqual({ schemaId: 'chassis', itemId: 'aegis' })
    expect(ctx?.props).toEqual({ rank: 3 })
    expect(ctx?.pathname).toBe('/schema/chassis/item/aegis/')
    expect(ctx?.url.href).toBe(`${SITE_URL}/schema/chassis/item/aegis/`)
    expect(ctx?.url.origin).toBe(SITE_URL)
  })

  it('hands the page the emitted asset URLs, but not the head-injected ones', () => {
    // A page addresses its images through `builtAssets`; the stylesheet and the
    // islands entry are `ssg/document.tsx`'s business and never reach the page.
    const { module, contexts } = spyPage<Record<string, string>, undefined>({ pattern: '/about' })

    register(module).resolve()[0]?.render(ASSETS)

    expect(contexts[0]?.builtAssets).toEqual({ 'src/assets/map.webp': '/assets/map-F00D.webp' })
    expect(Object.values(contexts[0]?.builtAssets ?? {})).not.toContain(
      '/assets/styles-CAFEBABE.css'
    )
  })

  it('keeps the site root at `/`, not `//`', () => {
    const { module, contexts } = spyPage<Record<string, string>, undefined>({ pattern: '/' })

    register(module).resolve()[0]?.render(NO_ASSETS)

    expect(contexts[0]?.pathname).toBe('/')
    expect(contexts[0]?.url.href).toBe(`${SITE_URL}/`)
  })
})

describe('register', () => {
  it('exposes the pattern and every concrete route, generics erased', () => {
    const { module } = spyPage<{ schemaId: string }, undefined>({
      pattern: '/schema/[schemaId]',
      getStaticPaths: () => [
        { params: { schemaId: 'chassis' }, props: undefined },
        { params: { schemaId: 'systems' }, props: undefined },
      ],
    })

    const registration = register(module)

    expect(registration.pattern).toBe('/schema/[schemaId]')
    expect(registration.resolve().map((route) => route.route)).toEqual([
      '/schema/chassis',
      '/schema/systems',
    ])
  })

  it('opts a page INTO the sitemap by default, and out only when asked', () => {
    const { module } = spyPage<Record<string, string>, undefined>({ pattern: '/404' })

    expect(register(module).sitemap).toBe(true)
    expect(register(module, {}).sitemap).toBe(true)
    expect(register(module, { sitemap: false }).sitemap).toBe(false)
  })

  it('renders through the document shell — doctype, chrome and injected assets', () => {
    const { module } = spyPage<Record<string, string>, undefined>({ pattern: '/about' })

    const html = register(module).resolve()[0]?.render(ASSETS) ?? ''

    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>spy</title>')
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/about/"/>`)
    expect(html).toContain('<main')
    expect(html).toContain('<link rel="stylesheet" href="/assets/styles-CAFEBABE.css">')
  })

  it('defers rendering until `render` is called', () => {
    // `ssg/build.ts` resolves every route up front to know the file set, then
    // renders. Resolving must not run 1,039 page functions early.
    const { module, contexts } = spyPage<Record<string, string>, undefined>({ pattern: '/about' })

    const routes = register(module).resolve()
    expect(contexts).toHaveLength(0)

    routes[0]?.render(NO_ASSETS)
    expect(contexts).toHaveLength(1)
  })
})

describe('registerDocument', () => {
  it('renders the page’s own <html> with no shell and no injected assets', () => {
    const registration = registerDocument({
      pattern: '/greembeem',
      document: () => (
        <html lang="en">
          <head>
            <title>Greembeem</title>
          </head>
          <body>
            <p>pastiche</p>
          </body>
        </html>
      ),
    })

    const routes = registration.resolve()
    expect(routes).toHaveLength(1)
    expect(routes[0]?.route).toBe('/greembeem')

    const html = routes[0]?.render(ASSETS) ?? ''
    expect(html).toBe(
      '<!doctype html><html lang="en"><head><title>Greembeem</title></head>' +
        '<body><p>pastiche</p></body></html>'
    )
    // Everything BaseLayout would have added is exactly what must NOT appear on
    // these pages. `ssg/snapshot.ts` catches the same slip over the real build;
    // these assertions catch it here, without needing one.
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('og:title')
    expect(html).not.toContain('/assets/styles-CAFEBABE.css')
    expect(html).not.toContain('/assets/islands-DEADBEEF.js')
  })

  it('is never sitemap-eligible — there is no opt-in', () => {
    const registration = registerDocument({
      pattern: '/greembeem',
      document: () => <html lang="en" />,
    })
    expect(registration.sitemap).toBe(false)
  })

  it('still gives the document a trailing-slashed url and an empty builtAssets', () => {
    let seen: RouteContext<Record<string, string>, undefined> | undefined
    registerDocument({
      pattern: '/greembeem',
      document: (ctx) => {
        seen = ctx
        return <html lang="en" />
      },
    })
      .resolve()[0]
      ?.render(ASSETS)

    expect(seen?.pathname).toBe('/greembeem/')
    expect(seen?.url.href).toBe(`${SITE_URL}/greembeem/`)
    expect(seen?.params).toEqual({})
    expect(seen?.builtAssets).toEqual({})
  })

  it('fails the build if a document page renders an <Island>', () => {
    // These pages ship no islands entry, so a placeholder here would be a
    // component that never mounts — and its props would be dropped silently.
    const registration = registerDocument({
      pattern: '/greembeem',
      document: () => (
        <html lang="en">
          <body>
            <Island name="SearchIsland" />
          </body>
        </html>
      ),
    })

    expect(() => registration.resolve()[0]?.render(NO_ASSETS)).toThrow(
      'rendered outside an island collection window'
    )
  })
})
