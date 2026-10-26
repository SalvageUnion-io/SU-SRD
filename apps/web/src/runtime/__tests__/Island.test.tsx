/**
 * `<Island>` — the marker markup and the per-page island collector.
 *
 * This is the seam between the page's React render and `Page.astro`: the
 * shell cuts the body at each `<template data-island data-island-id>` marker
 * (`astro/lib/islandParts.ts`) and renders the island collected under that id
 * there, with the marker's contents as its stand-in. The marker is a wire
 * format, so it is asserted literally here rather than through a helper.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { islandParts } from '../../../astro/lib/islandParts'
import type { CollectedIslands } from '../Island'
import { beginIslandCollection, endIslandCollection, Island } from '../Island'

/** Render inside a collection window, the way `astro/lib/document.tsx` does. */
function renderPage(node: React.ReactNode): { markup: string; islands: CollectedIslands } {
  beginIslandCollection()
  let markup: string
  let islands: CollectedIslands
  try {
    markup = renderToStaticMarkup(node)
  } finally {
    islands = endIslandCollection()
  }
  return { markup, islands }
}

describe('Island marker markup', () => {
  it('renders one empty marker, keyed by its id', () => {
    const { markup } = renderPage(<Island name="SearchIsland" client="idle" />)
    expect(markup).toBe('<template data-island="SearchIsland" data-island-id="i0"></template>')
  })

  it('renders children into the marker when ssr is true', () => {
    const { markup } = renderPage(
      <Island name="SchemaViewerIsland" client="interaction" ssr>
        <p>server markup</p>
      </Island>
    )
    expect(markup).toBe(
      '<template data-island="SchemaViewerIsland" data-island-id="i0"><p>server markup</p></template>'
    )
  })

  it('omits children when ssr is false (the default)', () => {
    const child = <p>server markup</p>
    const off = renderPage(<Island name="ReferenceEntityIsland">{child}</Island>)
    expect(off.markup).toBe(
      '<template data-island="ReferenceEntityIsland" data-island-id="i0"></template>'
    )
    const explicit = renderPage(
      <Island name="ReferenceEntityIsland" ssr={false}>
        {child}
      </Island>
    )
    expect(explicit.markup).not.toContain('server markup')
  })

  it('omits children for a hydrating island: Astro renders the island itself', () => {
    const { markup } = renderPage(
      <Island name="RollTableIsland" client="idle" ssr hydrate>
        <p>Rolled {7}</p>
      </Island>
    )
    expect(markup).toBe('<template data-island="RollTableIsland" data-island-id="i0"></template>')
  })

  it('throws when rendered outside a collection window', () => {
    // A stray `<Island>` outside a page's collection window must fail the
    // build, not emit a marker no island was collected for.
    expect(() => renderToStaticMarkup(<Island name="SearchIsland" />)).toThrow(
      '<Island name="SearchIsland"> rendered outside an island collection window.'
    )
  })
})

describe('the island collector', () => {
  it('collects each island by its own marker id, with its directive and props', () => {
    const { islands } = renderPage(
      <>
        <Island name="SearchIsland" client="interaction" props={{ variant: 'hero' }} />
        <Island name="PeekIsland" client="interaction" trigger="[data-peek]" />
        <Island name="AccountIsland" client="idle" when="signed-in" />
      </>
    )
    expect(islands).toEqual({
      i0: {
        name: 'SearchIsland',
        client: 'interaction',
        props: { variant: 'hero' },
        hydrate: false,
        trigger: undefined,
        when: undefined,
      },
      i1: {
        name: 'PeekIsland',
        client: 'interaction',
        props: {},
        hydrate: false,
        trigger: '[data-peek]',
        when: undefined,
      },
      i2: {
        name: 'AccountIsland',
        client: 'idle',
        props: {},
        hydrate: false,
        trigger: undefined,
        when: 'signed-in',
      },
    })
  })

  it('defaults client to "load"', () => {
    const { islands } = renderPage(<Island name="OgCardIsland" />)
    expect(islands.i0?.client).toBe('load')
  })

  it('restarts ids for each page, so they are stable across renders', () => {
    // Two renders of the same tree must produce byte-identical output,
    // otherwise every page in the build churns on a rebuild for no reason.
    const tree = (
      <>
        <Island name="SearchIsland" props={{ a: 1 }} />
        <Island name="MobileNavIsland" props={{ b: 2 }} />
      </>
    )
    const first = renderPage(tree)
    const second = renderPage(tree)
    expect(second.markup).toBe(first.markup)
    expect(second.islands).toEqual(first.islands)
    expect(Object.keys(second.islands)).toEqual(['i0', 'i1'])
  })

  it('closing the window clears the collected islands', () => {
    renderPage(<Island name="SearchIsland" props={{ a: 1 }} />)
    // A second close with no render in between must not leak the previous page.
    beginIslandCollection()
    expect(endIslandCollection()).toEqual({})
  })
})

describe('islandParts', () => {
  it('cuts the body at each marker, keeping the markup between them', () => {
    const { markup, islands } = renderPage(
      <main>
        <h1>Title</h1>
        <Island name="SearchIsland" client="interaction" ssr>
          <input name="q" />
        </Island>
        <p>between</p>
        <Island name="PeekIsland" client="interaction" trigger="[data-peek]" />
      </main>
    )
    const parts = islandParts(markup, islands)
    expect(parts.map((part) => ('html' in part ? part.html : part.island.name))).toEqual([
      '<main><h1>Title</h1>',
      'SearchIsland',
      '<p>between</p>',
      'PeekIsland',
      '</main>',
    ])
    const search = parts[1]
    expect(search && 'island' in search ? search.island.standIn : '').toBe('<input name="q"/>')
  })

  it('refuses a marker with no collected island', () => {
    expect(() =>
      islandParts('<template data-island="SearchIsland" data-island-id="i3"></template>', {})
    ).toThrow('island marker i3 has no collected island')
  })
})
