/**
 * `<Island>` — the SSR-side placeholder for a client-mounted React component.
 *
 * Renders exactly:
 *
 *   <div data-island="SearchIsland" data-client="idle" data-island-id="i0">…</div>
 *
 * and records the island's props in a render-scoped collector so
 * `astro/lib/document.tsx` can emit them ONCE per page as a single JSON script tag
 * (`<script type="application/json" data-island-props>`), rather than as a
 * per-island attribute.
 *
 * Mounting on the client is always `createRoot`, never `hydrateRoot` (see
 * `astro/DESIGN.md`), so the markup inside the placeholder is discarded and
 * replaced. `ssr` is therefore purely an SEO / no-JS decision and can never
 * produce a hydration mismatch.
 *
 * Pages import it, never the client entry (the mounter reads the placeholder's
 * attributes, not this module), so `react-dom/server` stays out of the client
 * bundle. It must stay free of `.css` imports and of anything under `astro/build/`.
 */

import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
// Type-only: erased before Bun resolves anything, so the SSR pass never pulls
// the client registry (or the island components, or their css) into its graph.
import type { IslandName } from './islandRegistry'

/**
 * When the client mounts an island (see `islands.client.ts`). `interaction`
 * waits for the reader to reach for it (`interaction.ts`).
 */
type IslandClientDirective = 'load' | 'idle' | 'visible' | 'only' | 'interaction'

export type IslandProps = {
  /**
   * Key into `islandRegistry`, typed to its actual keys — a typo is a compile
   * error, not a placeholder the mounter silently skips.
   */
  name: IslandName
  /** When the client mounts it. Defaults to `'load'`. */
  client?: IslandClientDirective
  /** Serialized once per page into the `data-island-props` script. */
  props?: Record<string, unknown>
  /**
   * Server-render `children` into the placeholder for crawlers / no-JS.
   * Defaults to `false`. See the per-island table in `astro/DESIGN.md`.
   */
  ssr?: boolean
  /**
   * The server markup — usually the island element itself (a page may pass a
   * static stand-in instead) — rendered into the placeholder only when
   * `ssr` is true. Passing it as children (rather than looking the component
   * up in a server-side registry) keeps the SSR module graph explicit: a page
   * that wants server markup imports the component, a page that does not
   * never pulls it into the SSR pass at all.
   */
  children?: ReactNode
  /**
   * Adopt the server markup with `hydrateRoot` instead of replacing it. Only
   * for an `ssr` island whose children are the island itself, from the same
   * props, and which reads no game data (`useGameData` has no server snapshot).
   * Its children are rendered as their own root with `renderToString`, which
   * keeps the text-node markers and `useId` values a hydrating root matches;
   * the page's `renderToStaticMarkup` drops the first and numbers the second
   * from the whole page.
   */
  hydrate?: boolean
  /**
   * With `client="interaction"`: the selector of the page-wide elements whose
   * hover, press or focus wakes the island, for an island that serves the
   * whole page (the Peek) rather than its own placeholder.
   */
  trigger?: string
  /**
   * Mount only while somebody is signed in (`lib/accountBar.ts`): the account
   * menu, which a signed-out reader never loads.
   */
  when?: 'signed-in'
}

/** Props for every island rendered during one page render, by `data-island-id`. */
export type CollectedIslandProps = Record<string, Record<string, unknown>>

type Collector = { next: number; props: CollectedIslandProps }

let active: Collector | null = null

/**
 * Opens a render-scoped collection window. `renderToStaticMarkup` is
 * synchronous and single-pass, so a module-level collector is sufficient and
 * needs no React context (which would force every page tree to be wrapped).
 * Always pair with `endIslandCollection` in a `finally`.
 */
export function beginIslandCollection(): void {
  active = { next: 0, props: {} }
}

/** Closes the window and returns the props collected inside it. */
export function endIslandCollection(): CollectedIslandProps {
  const collected = active?.props ?? {}
  active = null
  return collected
}

export function Island({
  name,
  client = 'load',
  props,
  ssr = false,
  children,
  hydrate = false,
  trigger,
  when,
}: IslandProps) {
  if (!active) {
    throw new Error(
      `<Island name="${name}"> rendered outside an island collection window. ` +
        'Wrap the render in beginIslandCollection()/endIslandCollection().'
    )
  }
  const id = `i${active.next}`
  active.next += 1
  // Empty prop bags are omitted entirely; the client falls back to `{}`.
  if (props && Object.keys(props).length > 0) active.props[id] = props

  return (
    <div
      data-island={name}
      data-client={client}
      data-island-id={id}
      data-hydrate={hydrate ? '' : undefined}
      data-trigger={trigger}
      data-when={when}
      {...(ssr && hydrate ? { dangerouslySetInnerHTML: { __html: renderToString(children) } } : {})}
    >
      {ssr && !hydrate ? children : null}
    </div>
  )
}
