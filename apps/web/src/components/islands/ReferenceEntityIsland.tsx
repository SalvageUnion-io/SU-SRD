import { Suspense, useLayoutEffect } from 'react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import type { SchemaList } from '../../lib/useGameData'
import { EntityCardStatic } from '../EntityCardStatic'
import { GameDataGate } from '../GameDataGate'
import type { PageRefIndex } from '../index'
import { Toaster } from '../index'
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
          <EntityCardStatic item={item} pattern={pattern} pageRefs={pageRefs} />
          {/* Where a roll on the card's tables lands (`toastRoll`). */}
          <Toaster />
        </Suspense>
      </GameDataGate>
    </IslandErrorBoundary>
  )
}
