import { Suspense } from 'react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import type { SchemaList } from '../../lib/useGameData'
import { isSchemaListLoaded, preloadGameData } from '../../lib/useGameData'
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

export function ReferenceEntityIsland({
  item,
  pattern,
  preloadSchemas,
  pageRefs,
  nameRefs,
}: ReferenceEntityIslandProps) {
  // The server draws this same card as the island's stand-in (`EntityView`),
  // and the island swaps in over it only once its data is loaded (`prepare`,
  // below), so the swap repaints the card it replaces and nothing moves.
  return (
    <IslandErrorBoundary>
      <GameDataGate schemas={preloadSchemas} fallback={null}>
        <Suspense fallback={null}>
          <EntityCardStatic item={item} pattern={pattern} pageRefs={pageRefs} nameRefs={nameRefs} />
          {/* Where a roll on the card's tables lands (`toastRoll`): the
              page's one toaster. */}
          <ToasterMount />
        </Suspense>
      </GameDataGate>
    </IslandErrorBoundary>
  )
}

/** Never settles: what `prepare` returns to keep the stand-in up. */
const KEEP_STAND_IN = new Promise<void>(() => {
  // Unresolved on purpose: the swap never comes.
})

/**
 * The card's data, loaded before the swap. A load that fails keeps the
 * server's card on the page, readable, rather than swapping in a retry panel
 * over it.
 */
function prepareReferenceEntityIsland(props: ReferenceEntityIslandProps): Promise<void> {
  const schemas = props.preloadSchemas ?? 'all'
  return preloadGameData(schemas, 'full').then(() =>
    isSchemaListLoaded(schemas, 'full') ? undefined : KEEP_STAND_IN
  )
}

/** The island as Astro hydrates it: `ReferenceEntityIsland` swapped in over its stand-in (`clientSwap`). */
export const ReferenceEntityIslandClient = clientSwap(
  'ReferenceEntityIsland',
  ReferenceEntityIsland,
  { prepare: prepareReferenceEntityIsland }
)
