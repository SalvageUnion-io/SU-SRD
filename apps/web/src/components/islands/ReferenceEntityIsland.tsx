import { Suspense, useLayoutEffect } from 'react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import type { SchemaList } from '../../lib/useGameData'
import { clientSwap } from '../../runtime/clientSwap'
import { EntityCardStatic } from '../EntityCardStatic'
import { GameDataGate } from '../GameDataGate'
import type { NameRefIndex, PageRefIndex } from '../index'
import { ToasterMount } from '../index'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type ReferenceEntityIslandProps = {
  item: RefEntity
  /** Render one of `item`'s patterns (chassis only) instead of the chassis
   *  itself — the pattern page's view. */
  pattern?: RefObjectAnyPattern
  /** Which schemas to preload — defaults to `'all'`. Pass the per-route list
   *  from `../../lib/schemaPreloadDeps.ts` to load only what this item needs. */
  preloadSchemas?: SchemaList
  /** The pages its text cites, built at build time, to link "p. N". */
  pageRefs?: PageRefIndex
  /** The names its prose uses, built at build time, to link them. */
  nameRefs?: NameRefIndex
}

/**
 * Removes the page's static fallback when the card commits, before paint: it
 * sits beside the card inside the Suspense boundary, so it commits only with
 * it. View transitions swap in fresh HTML and remount the island, so it runs
 * again per page.
 */
function DropStaticFallback() {
  useLayoutEffect(() => {
    document.querySelectorAll('[data-static-fallback]').forEach((el) => {
      el.remove()
    })
  }, [])
  return null
}

export function ReferenceEntityIsland({
  item,
  pattern,
  preloadSchemas,
  pageRefs,
  nameRefs,
}: ReferenceEntityIslandProps) {
  // The static SEO/no-JS fallback (`StaticEntityContent`) stays on screen,
  // for JS readers too, until the card can draw: the gate and the Suspense
  // boundary render nothing rather than a skeleton, and the card's commit drops
  // the fallback in the same step (`DropStaticFallback`). A failed preload
  // leaves the static content readable instead of a blank page.
  return (
    <IslandErrorBoundary>
      <GameDataGate schemas={preloadSchemas} fallback={null}>
        <Suspense fallback={null}>
          <DropStaticFallback />
          <EntityCardStatic item={item} pattern={pattern} pageRefs={pageRefs} nameRefs={nameRefs} />
          {/* Where a roll on the card's tables lands (`toastRoll`): the
              page's one toaster. */}
          <ToasterMount />
        </Suspense>
      </GameDataGate>
    </IslandErrorBoundary>
  )
}

/** The island as Astro hydrates it: `ReferenceEntityIsland` swapped in over its stand-in (`clientSwap`). */
export const ReferenceEntityIslandClient = clientSwap(
  'ReferenceEntityIsland',
  ReferenceEntityIsland
)
