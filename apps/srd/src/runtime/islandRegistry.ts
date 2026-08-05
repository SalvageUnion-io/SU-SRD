/**
 * islandRegistry — island name -> dynamic loader, for the client bundle.
 *
 * Every specifier here is a STATIC string literal so Rollup can see it and
 * code-split each island into its own chunk. Never build a specifier from a
 * variable: that collapses the whole registry into one eager chunk (or, with
 * a glob, into a chunk per file that every page downloads).
 */

import type { ComponentType, ReactNode } from 'react'

/** An island as the mounter sees it: props are only known at runtime. */
export type IslandComponent = (props: Record<string, unknown>) => ReactNode

/**
 * The single sanctioned widening. The mounter reads props out of JSON, so it
 * genuinely cannot know a component's prop type; this confines that fact to
 * one line instead of scattering casts (or `any`) through the loader.
 */
function asIsland<P>(component: ComponentType<P>): IslandComponent {
  return component as unknown as IslandComponent
}

export type IslandLoader = () => Promise<IslandComponent>

/**
 * No `Record<string, IslandLoader>` annotation on purpose — that would widen
 * the keys back to `string` and defeat `IslandName` below. `satisfies` keeps
 * the value checked while preserving the literal key union.
 */
export const islandRegistry = {
  SearchIsland: () =>
    import('../components/islands/SearchIsland').then((m) => asIsland(m.SearchIsland)),
  MobileSearchIsland: () =>
    import('../components/islands/MobileSearchIsland').then((m) => asIsland(m.MobileSearchIsland)),
  MobileNavIsland: () =>
    import('../components/islands/MobileNavIsland').then((m) => asIsland(m.MobileNavIsland)),
  SchemaViewerIsland: () =>
    import('../components/islands/SchemaViewerIsland').then((m) => asIsland(m.SchemaViewerIsland)),
  ReferenceEntityIsland: () =>
    import('../components/islands/ReferenceEntityIsland').then((m) =>
      asIsland(m.ReferenceEntityIsland)
    ),
  ColophonIsland: () =>
    import('../components/islands/ColophonIsland').then((m) => asIsland(m.ColophonIsland)),
  SearchResultsIsland: () =>
    import('../components/islands/SearchResultsIsland').then((m) =>
      asIsland(m.SearchResultsIsland)
    ),
  OgCardIsland: () =>
    import('../components/islands/OgCardIsland').then((m) => asIsland(m.OgCardIsland)),
} satisfies Record<string, IslandLoader>

/**
 * The islands that actually exist.
 *
 * `<Island name>` is typed to this, so a typo is a compile error rather than a
 * placeholder that silently never mounts — which is exactly what happened when
 * this was `string`: renaming an island in a page left a `data-island` div in
 * the HTML that the mounter skipped, with no error anywhere, in the build or
 * the browser. This is a TYPE-only export, so importing it from the SSR side
 * costs nothing at runtime and pulls none of the client graph with it.
 */
export type IslandName = keyof typeof islandRegistry
