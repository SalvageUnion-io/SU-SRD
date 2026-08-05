/**
 * Hydration directives — the guard, ported to the in-house island protocol.
 *
 * The Astro version of this file read `.astro` sources as TEXT and grepped for
 * `client:visible` / `client:idle`. Those directives no longer exist: a page now
 * renders `<Island name=… client=… ssr=…>` and the placeholder it emits is the
 * contract (see `ssg/DESIGN.md`, "The island protocol").
 *
 * So the invariants are the same and the method is not: every assertion below
 * renders the real component and reads the real placeholder, rather than
 * matching source text. The one exception is `Toaster`, an assertion about
 * ABSENCE that the module graph is the honest place to check — and even that is
 * backed by a rendered-markup check beside it.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SURefEntity } from 'salvageunion-reference'
import { getModel } from 'salvageunion-reference'
import { BaseLayout } from '../../../layouts/BaseLayout'
import { cardNeedsHydration } from '../../../lib/cardNeedsHydration'
import { schemaListingPage } from '../../../pages/schema/[schemaId]/index.page'
import type { CollectedIslandProps } from '../../../runtime/Island'
import { beginIslandCollection, endIslandCollection } from '../../../runtime/Island'
import { islandRegistry } from '../../../runtime/islandRegistry'
import { EntityView } from '../../EntityView'
import { TopNavigation } from '../../TopNavigation'

const appRoot = resolve(import.meta.dir, '../../../..')

/** One island placeholder as the client mounter sees it. */
type Placeholder = { name: string; client: string; id: string; inner: string }

/**
 * Every `<Island>` in `markup`, read the way `islands.client.ts` reads them:
 * `querySelectorAll('[data-island]')`, then the three data attributes.
 *
 * Parsed rather than regexed, because `inner` has to be exact — an `ssr={true}`
 * island holds a whole component tree, and a string-slicing version would call
 * the markup that FOLLOWS an empty placeholder its content.
 */
function placeholders(markup: string): Placeholder[] {
  const template = document.createElement('template')
  template.innerHTML = markup
  return [...template.content.querySelectorAll('[data-island]')].map((el) => ({
    name: el.getAttribute('data-island') ?? '',
    client: el.getAttribute('data-client') ?? '',
    id: el.getAttribute('data-island-id') ?? '',
    inner: el.innerHTML,
  }))
}

/** The single island a render was expected to produce. */
function onlyIsland(islands: Placeholder[]): Placeholder {
  const [island] = islands
  if (islands.length !== 1 || !island) {
    throw new Error(
      `expected exactly 1 island, got ${islands.length}: ${islands.map((i) => i.name)}`
    )
  }
  return island
}

/** Render inside a collection window, the way `ssg/document.tsx` does. */
function renderIslands(node: React.ReactNode): {
  markup: string
  islands: Placeholder[]
  props: CollectedIslandProps
} {
  beginIslandCollection()
  let markup: string
  let props: CollectedIslandProps
  try {
    markup = renderToStaticMarkup(node)
  } finally {
    props = endIslandCollection()
  }
  return { markup, islands: placeholders(markup), props }
}

/**
 * The first entity whose card does / does not need a listener.
 *
 * Chosen by asking `cardNeedsHydration`, never by hardcoding an id: the whole
 * point of that function is that the answer is a property of the RENDERED card,
 * so a fixture pinned by id would go stale the moment the card's internals
 * changed — silently taking the branch it was meant to prove.
 */
function firstEntity(schemaId: string, needsHydration: boolean): SURefEntity {
  const model = getModel(schemaId)
  if (!model) throw new Error(`no model for "${schemaId}"`)
  const match = model.all().find((item) => cardNeedsHydration(item) === needsHydration)
  if (!match) {
    throw new Error(
      `no "${schemaId}" entity with cardNeedsHydration === ${needsHydration}; ` +
        'pick a schema that still has one rather than relaxing this test'
    )
  }
  return match
}

describe('hydration directives', () => {
  describe('the entity card is server-rendered unless it needs a listener', () => {
    // Most SRD entities are documents and render to HTML at build time with no
    // JS. Only cards that emit something needing a click handler keep the
    // island. Both halves of that are load-bearing: dropping the island for an
    // interactive card leaves a rendered-but-dead control, and server-rendering
    // a hydrating one would put `useGameData`'s hardcoded-false skeleton into
    // the HTML instead of the entity.
    it('EntityView branches on cardNeedsHydration', () => {
      // Same component, same schema, opposite answers -> opposite output.
      const rollTable = firstEntity('roll-tables', true)
      const staticEntity = firstEntity('keywords', false)

      const hydrating = renderIslands(<EntityView item={rollTable} schemaId="roll-tables" />)
      const inert = renderIslands(<EntityView item={staticEntity} schemaId="keywords" />)

      expect(hydrating.islands.map((i) => i.name)).toEqual(['ReferenceEntityIsland'])
      expect(inert.islands).toEqual([])
    })

    it('importing EntityView preloads the ORM', () => {
      // The eager `preload('all')` lives at module scope in `src/lib/gameData`,
      // and it is what makes the `cardNeedsHydration` probe and
      // `EntityCardStatic`'s lookups resolve synchronously during the build.
      // A fresh process is the only place this is observable — the test preload
      // has already loaded everything in THIS one.
      const probe = `
        await import('./src/components/EntityView.tsx')
        const { SalvageUnionReference } = await import('salvageunion-reference')
        console.log(SalvageUnionReference.isLoaded('chassis') ? 'loaded' : 'not-loaded')
      `
      const result = Bun.spawnSync(['bun', '-e', probe], { cwd: appRoot })
      expect(result.stdout.toString().trim()).toBe('loaded')
    })

    it('the static path carries no island at all', () => {
      const { markup, islands, props } = renderIslands(
        <EntityView item={firstEntity('keywords', false)} schemaId="keywords" />
      )
      expect(islands).toEqual([])
      expect(markup).not.toContain('data-island')
      // No placeholder means no props: an inert page must ship no island JSON.
      expect(props).toEqual({})
    })

    it('the interactive path keeps client="visible" and its no-JS fallback', () => {
      const { markup, islands, props } = renderIslands(
        <EntityView item={firstEntity('roll-tables', true)} schemaId="roll-tables" />
      )

      const island = onlyIsland(islands)
      expect(island.name).toBe('ReferenceEntityIsland')
      expect(island.client).toBe('visible')
      // The placeholder must stay EMPTY. Server-rendering this island would
      // emit `useGameData`'s hardcoded-false skeleton rather than the entity,
      // which is why `StaticEntityContent` — not the island — is the SEO / no-JS
      // path, and why it must be there beside it.
      expect(island.inner).toBe('')
      expect(markup).toContain('data-static-fallback')

      expect(Object.keys(props)).toEqual([island.id])
      expect(Object.keys(props[island.id] ?? {})).toEqual([
        'item',
        'pattern',
        'titleAs',
        'preloadSchemas',
      ])
    })
  })

  describe('below-fold islands use client="visible"', () => {
    it('SchemaViewerIsland on the schema listing page is client="visible"', () => {
      const paths = schemaListingPage.getStaticPaths?.() ?? []
      const path = paths.find((p) => p.params.schemaId === 'keywords')
      if (!path) throw new Error('no static path for /schema/keywords')

      const pathname = '/schema/keywords/'
      const result = schemaListingPage.page({
        params: path.params,
        props: path.props,
        url: new URL(pathname, 'https://salvageunion.io'),
        pathname,
        builtAssets: {},
      })

      const island = onlyIsland(renderIslands(result.children).islands)
      expect(island.name).toBe('SchemaViewerIsland')
      expect(island.client).toBe('visible')
      // `ssr` is true here — the entity grid is this page's SEO content — so the
      // placeholder must NOT be empty.
      expect(island.inner.length).toBeGreaterThan(0)
    })
  })

  describe('above-fold critical islands retain client="idle"', () => {
    it('the chrome islands in TopNavigation are all client="idle"', () => {
      const { islands, props } = renderIslands(<TopNavigation currentPath="/" />)

      expect(islands.map((i) => `${i.name}:${i.client}`)).toEqual([
        'SearchIsland:idle',
        'MobileSearchIsland:idle',
        'MobileNavIsland:idle',
      ])
      // Chrome takes no props at all. `MobileNavIsland` computing its own
      // catalog instead of receiving one is what keeps 17.3 MB of duplicated
      // props out of the build (ssg/DESIGN.md, "props designed out").
      expect(props).toEqual({})
    })

    it('Toaster is not imported or rendered in BaseLayout', () => {
      // An absence, so the source is the honest place to check it: a `Toaster`
      // that renders nothing on the server would slip past a markup assertion
      // while still shipping sonner to every page.
      const source = readFileSync(resolve(appRoot, 'src/layouts/BaseLayout.tsx'), 'utf-8')
      expect(source).not.toContain('Toaster')

      // …and the rendered document really has no toast region. sonner's
      // `<Toaster>` server-renders as a <section aria-label="Notifications …">.
      const { markup } = renderIslands(
        <BaseLayout meta={{}} pathname="/">
          {null}
        </BaseLayout>
      )
      expect(markup).not.toContain('Notifications alt+T')
    })
  })

  describe('the placeholder contract binds to the client mounter', () => {
    it('every island a page emits is resolvable in islandRegistry', () => {
      // In Astro a mistyped island was a broken import. Here `name` is a string
      // the mounter looks up at runtime, so a typo is silently dead UI.
      const emitted = [
        ...renderIslands(<TopNavigation currentPath="/" />).islands,
        ...renderIslands(
          <EntityView item={firstEntity('roll-tables', true)} schemaId="roll-tables" />
        ).islands,
      ]
      expect(emitted.length).toBeGreaterThan(0)
      for (const island of emitted) {
        expect(Object.keys(islandRegistry)).toContain(island.name)
      }
    })
  })
})
