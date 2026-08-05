/**
 * `<Island>` — the SSR-side placeholder for a client-mounted React component.
 *
 * Renders exactly:
 *
 *   <div data-island="SearchIsland" data-client="idle" data-island-id="i0">…</div>
 *
 * and records the island's props in a render-scoped collector so
 * `ssg/document.tsx` can emit them ONCE per page as a single JSON script tag
 * (`<script type="application/json" data-island-props>`), instead of Astro's
 * per-island `props="…"` attribute.
 *
 * Mounting on the client is always `createRoot`, never `hydrateRoot` (see
 * `ssg/DESIGN.md`), so the markup inside the placeholder is discarded and
 * replaced. `ssr` is therefore purely an SEO / no-JS decision and can never
 * produce a hydration mismatch.
 *
 * This module is shared by the SSR pass and the client bundle, so it must stay
 * free of `.css` imports and of anything under `ssg/`.
 */

import type { ReactNode } from 'react'
// Type-only: erased before Bun resolves anything, so the SSR pass never pulls
// the client registry (or the island components, or their css) into its graph.
import type { IslandName } from './islandRegistry'

/** Mount scheduling, kept 1:1 with the Astro `client:*` directives we used. */
export type IslandClientDirective = 'load' | 'idle' | 'visible' | 'only'

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
   * Defaults to `false`. See the per-island table in `ssg/DESIGN.md`.
   */
  ssr?: boolean
  /**
   * The island element itself, rendered into the placeholder only when
   * `ssr` is true. Passing it as children (rather than looking the component
   * up in a server-side registry) keeps the SSR module graph explicit: a page
   * that wants server markup imports the component, a page that does not
   * never pulls it into the SSR pass at all.
   */
  children?: ReactNode
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

export function Island({ name, client = 'load', props, ssr = false, children }: IslandProps) {
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
    <div data-island={name} data-client={client} data-island-id={id}>
      {ssr ? children : null}
    </div>
  )
}
