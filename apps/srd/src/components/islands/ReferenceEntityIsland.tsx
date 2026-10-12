import type { PageRefIndex } from 'component-lib'
import {
  EntityDetailLinkProvider,
  EntityHrefProvider,
  PatternHrefProvider,
  ReferenceEntityCard,
} from 'component-lib'
import { Suspense, useLayoutEffect, useMemo } from 'react'
import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { getClassSelections } from '../../lib/classSelections'
import { srdEntityHref } from '../../lib/entityHref'
import { srdPatternHref } from '../../lib/patternHref'
import type { SchemaList } from '../../lib/useGameData'
import { GameDataGate } from '../../lib/useGameData'
import { ClassAbilityTree } from '../ClassAbilityTree'
import { ReferenceSurface } from '../ReferenceSurface'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type ReferenceEntityIslandProps = {
  item: SURefEntity
  compact?: boolean
  /** Render one of `item`'s patterns (chassis only) instead of the chassis
   *  itself — the pattern page's view. */
  pattern?: SURefObjectAnyPattern
  /** Which schemas to preload — defaults to `'all'`. Pass the per-route list
   *  from `../../lib/schemaPreloadDeps.ts` to load only what this item needs. */
  preloadSchemas?: SchemaList
  /** The schema keeps an art place: a censor mark when this item has no art. */
  artSlot?: boolean
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
  compact = false,
  pattern,
  preloadSchemas,
  artSlot = false,
  pageRefs,
}: ReferenceEntityIslandProps) {
  const classSelections = useMemo(() => getClassSelections(item), [item])
  const classEntity = classSelections.selectedClass || classSelections.selectedAdvancedClass

  // The static SEO/no-JS fallback (`StaticEntityContent`) stays on screen,
  // for JS readers too, until the card can draw: the gate and the Suspense
  // boundary render nothing rather than a skeleton, and the card's commit drops
  // the fallback in the same step (`DropStaticFallback`). A failed preload
  // leaves the static content readable instead of a blank page.
  return (
    <IslandErrorBoundary>
      <GameDataGate schemas={preloadSchemas} fallback={null}>
        {/* The card is the page's body (`presentation="page"`): the page's
            chapter band and foot band frame it, as on the static path. */}
        <Suspense fallback={null}>
          <DropStaticFallback />
          <EntityHrefProvider value={srdEntityHref}>
            <EntityDetailLinkProvider value={true}>
              {/* Pattern rows on a chassis card link to the pattern's own
                    page. Harmless on the pattern page itself, whose card is a
                    pattern view and so carries no pattern list. */}
              <PatternHrefProvider value={srdPatternHref}>
                <ReferenceSurface pageRefs={pageRefs}>
                  <ReferenceEntityCard
                    data={item}
                    pattern={pattern}
                    size={compact ? 'medium' : 'large'}
                    presentation={compact ? 'card' : 'page'}
                    artSlot={artSlot}
                    afterExtraContent={
                      classEntity ? <ClassAbilityTree classEntity={classEntity} /> : undefined
                    }
                    asideLead={!!classEntity}
                  />
                </ReferenceSurface>
              </PatternHrefProvider>
            </EntityDetailLinkProvider>
          </EntityHrefProvider>
        </Suspense>
      </GameDataGate>
    </IslandErrorBoundary>
  )
}
