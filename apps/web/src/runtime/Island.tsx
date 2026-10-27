/**
 * `<Island>` — where a page's React tree puts a client-mounted component.
 *
 * The page modules and the chrome are React, rendered to a string
 * (`astro/lib/document.tsx`); the islands are Astro's (`client:*`). So this
 * renders only a marker:
 *
 *   <template data-island="SearchIsland" data-island-id="i0">…the stand-in…</template>
 *
 * and records what Astro needs to render the island there (its name, its
 * directive and its props) in a render-scoped collector. `Page.astro` cuts
 * the body at each marker and renders that island in its place
 * (`astro/components/Islands.astro`), with the stand-in as its slot.
 *
 * It must stay free of `.css` imports and of anything under `astro/build/`.
 */

import type { ReactNode } from 'react'

/** The islands `Islands.astro` can render. */
export type IslandName =
  | 'SearchIsland'
  | 'MobileSearchIsland'
  | 'AccountIsland'
  | 'AccountAvatarIsland'
  | 'MobileNavIsland'
  | 'SchemaViewerIsland'
  | 'ReferenceEntityIsland'
  | 'RollTableIsland'
  | 'ColumnsTableIsland'
  | 'KofiIsland'
  | 'DidYouMeanIsland'
  | 'OgCardIsland'
  | 'PeekIsland'
  | 'HomebrewIsland'

/**
 * When the client mounts an island: Astro's directive of the same name, or
 * `interaction`, which waits for the reader to reach for it
 * (`directives/interaction.ts`).
 */
type IslandClientDirective = 'load' | 'idle' | 'visible' | 'only' | 'interaction'

export type IslandProps = {
  /** Which island: a typo is a compile error, not a marker nothing renders. */
  name: IslandName
  /** When the client mounts it. Defaults to `'load'`. */
  client?: IslandClientDirective
  /** The island's props, serialized by Astro onto its element. */
  props?: Record<string, unknown>
  /**
   * Server-render `children` as the island's stand-in, for crawlers and no-JS
   * readers. Defaults to `false`. See the per-island table in `astro/DESIGN.md`.
   */
  ssr?: boolean
  /**
   * The stand-in: usually the island element itself (a page may pass a
   * static stand-in instead), rendered only when `ssr` is true.
   */
  children?: ReactNode
  /**
   * Hydrate the island itself rather than swap it in over a stand-in
   * (`clientSwap`): Astro server-renders it from `props`, so its children are
   * ignored. Only for an island that reads no game data (`useGameData` has
   * no server snapshot).
   */
  hydrate?: boolean
  /**
   * With `client="interaction"`: the selector of the page-wide elements whose
   * hover, press or focus wakes the island, for an island that serves the
   * whole page (the Peek) rather than its own stand-in.
   */
  trigger?: string
  /**
   * Mount only while somebody is signed in (`lib/accountBar.ts`): the account
   * menu, which a signed-out reader never loads (`directives/signedIn.ts`).
   */
  when?: 'signed-in'
}

/** One island as `Islands.astro` renders it. */
export type CollectedIsland = {
  name: IslandName
  client: IslandClientDirective
  props: Record<string, unknown>
  hydrate: boolean
  trigger?: string
  when?: 'signed-in'
}

/** Every island rendered during one page render, by its marker's `data-island-id`. */
export type CollectedIslands = Record<string, CollectedIsland>

type Collector = { next: number; islands: CollectedIslands }

let active: Collector | null = null

/**
 * Opens a render-scoped collection window. `renderToStaticMarkup` is
 * synchronous and single-pass, so a module-level collector is sufficient and
 * needs no React context (which would force every page tree to be wrapped).
 * Always pair with `endIslandCollection` in a `finally`.
 */
export function beginIslandCollection(): void {
  active = { next: 0, islands: {} }
}

/** Closes the window and returns the islands collected inside it. */
export function endIslandCollection(): CollectedIslands {
  const collected = active?.islands ?? {}
  active = null
  return collected
}

export function Island({
  name,
  client = 'load',
  props = {},
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
  active.islands[id] = { name, client, props, hydrate, trigger, when }
  return (
    <template data-island={name} data-island-id={id}>
      {ssr && !hydrate ? children : null}
    </template>
  )
}
