/**
 * `<Island>` — the placeholder markup and the per-page props collector.
 *
 * This is the seam between the SSR pass and `src/runtime/islands.client.ts`:
 * the mounter finds islands with `[data-island]`, schedules them by
 * `data-client`, and looks their props up by `data-island-id` in the single
 * `data-island-props` JSON blob. Every one of those three attributes is a wire
 * format, so it is asserted literally here rather than through a helper.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CollectedIslandProps } from '../../src/runtime/Island'
import { beginIslandCollection, endIslandCollection, Island } from '../../src/runtime/Island'

/** Render inside a collection window, the way `ssg/document.tsx` does. */
function renderPage(node: React.ReactNode): { markup: string; props: CollectedIslandProps } {
  beginIslandCollection()
  let markup: string
  let props: CollectedIslandProps
  try {
    markup = renderToStaticMarkup(node)
  } finally {
    props = endIslandCollection()
  }
  return { markup, props }
}

describe('Island placeholder markup', () => {
  it('renders the three data attributes the client mounter reads', () => {
    const { markup } = renderPage(<Island name="SearchIsland" client="idle" />)
    expect(markup).toBe(
      '<div data-island="SearchIsland" data-client="idle" data-island-id="i0"></div>'
    )
  })

  it('defaults client to "load"', () => {
    const { markup } = renderPage(<Island name="OgCardIsland" />)
    expect(markup).toContain('data-client="load"')
  })

  it('carries each client directive through verbatim', () => {
    for (const client of ['load', 'idle', 'visible', 'only'] as const) {
      const { markup } = renderPage(<Island name="SearchIsland" client={client} />)
      expect(markup).toContain(`data-client="${client}"`)
    }
  })

  it('omits children when ssr is false (the default)', () => {
    const child = <p>server markup</p>

    const off = renderPage(<Island name="ReferenceEntityIsland">{child}</Island>)
    expect(off.markup).not.toContain('server markup')
    expect(off.markup).toBe(
      '<div data-island="ReferenceEntityIsland" data-client="load" data-island-id="i0"></div>'
    )

    const explicit = renderPage(
      <Island name="ReferenceEntityIsland" ssr={false}>
        {child}
      </Island>
    )
    expect(explicit.markup).not.toContain('server markup')
  })

  it('renders children into the placeholder when ssr is true', () => {
    const { markup } = renderPage(
      <Island name="SchemaViewerIsland" client="visible" ssr>
        <p>server markup</p>
      </Island>
    )
    expect(markup).toBe(
      '<div data-island="SchemaViewerIsland" data-client="visible" data-island-id="i0">' +
        '<p>server markup</p></div>'
    )
  })

  it('throws when rendered outside a collection window', () => {
    // Guards `registerDocument` pages (greembeem), which get no island support
    // at all: a stray `<Island>` there must fail the build, not emit a
    // placeholder whose props were silently dropped on the floor.
    expect(() => renderToStaticMarkup(<Island name="SearchIsland" />)).toThrow(
      '<Island name="SearchIsland"> rendered outside an island collection window.'
    )
  })
})

describe('the props collector', () => {
  it('keys each island’s props by its own data-island-id', () => {
    const { markup, props } = renderPage(
      <>
        <Island name="SearchIsland" props={{ a: 1 }} />
        <Island name="MobileNavIsland" props={{ b: 2 }} />
      </>
    )

    expect(markup).toContain('data-island="SearchIsland" data-client="load" data-island-id="i0"')
    expect(markup).toContain('data-island="MobileNavIsland" data-client="load" data-island-id="i1"')
    expect(props).toEqual({ i0: { a: 1 }, i1: { b: 2 } })
  })

  it('assigns ids that are unique within a page', () => {
    // The same island five times: `data-island-id` is what tells the mounter
    // which prop bag belongs to which placeholder, so the NAME cannot be it.
    const { props } = renderPage(
      ['a', 'b', 'c', 'd', 'e'].map((tag) => (
        <Island key={tag} name="SearchIsland" props={{ tag }} />
      ))
    )

    const ids = Object.keys(props)
    expect(ids).toEqual(['i0', 'i1', 'i2', 'i3', 'i4'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('restarts ids for each page, so they are stable across renders', () => {
    // Two renders of the same tree must produce byte-identical output —
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
    expect(second.props).toEqual(first.props)
    expect(Object.keys(second.props)).toEqual(['i0', 'i1'])
  })

  it('omits an empty prop bag entirely', () => {
    // The client falls back to `{}`, and `ssg/document.tsx` drops the whole
    // JSON script tag when nothing was collected — which is what keeps the
    // no-props chrome islands (TopNavigation) off every page's byte count.
    const { props } = renderPage(
      <>
        <Island name="SearchIsland" client="idle" />
        <Island name="MobileNavIsland" client="idle" props={{}} />
      </>
    )
    expect(props).toEqual({})
  })

  it('still numbers an island whose props were omitted', () => {
    // The id counter advances for EVERY island, propless or not: it is the
    // mounter's index into the DOM, not into the props bag.
    const { markup, props } = renderPage(
      <>
        <Island name="SearchIsland" client="idle" />
        <Island name="SchemaViewerIsland" client="visible" props={{ schemaId: 'chassis' }} />
      </>
    )

    expect(markup).toContain('data-island="SearchIsland" data-client="idle" data-island-id="i0"')
    expect(markup).toContain(
      'data-island="SchemaViewerIsland" data-client="visible" data-island-id="i1"'
    )
    expect(props).toEqual({ i1: { schemaId: 'chassis' } })
  })

  it('closing the window clears the collected props', () => {
    renderPage(<Island name="SearchIsland" props={{ a: 1 }} />)
    // A second close with no render in between must not leak the previous page.
    beginIslandCollection()
    expect(endIslandCollection()).toEqual({})
  })
})
