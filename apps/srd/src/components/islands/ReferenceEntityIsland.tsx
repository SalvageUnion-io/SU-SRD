import type { PageRefIndex } from 'component-lib'
import {
  EntityDetailLinkProvider,
  EntityHrefProvider,
  PatternHrefProvider,
  ReferenceEntityCard,
  Skeleton,
} from 'component-lib'
import { Suspense, useEffect, useMemo } from 'react'
import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { getClassSelections } from '../../lib/classSelections'
import { srdEntityHref } from '../../lib/entityHref'
import { srdPatternHref } from '../../lib/patternHref'
import type { SchemaList } from '../../lib/useGameData'
import { GameDataGate, useGameData } from '../../lib/useGameData'
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

  const { ready } = useGameData({ schemas: preloadSchemas })

  // The static SEO/no-JS fallback stays in the served HTML (crawlers and no-JS
  // users keep the content; the page's <h1> is its chapter band, outside
  // both). For JS users it is hidden as soon as the island hydrates (avoids a
  // duplicate body flashing next to the skeleton)…
  useEffect(() => {
    document.querySelectorAll('[data-static-fallback]').forEach((el) => {
      el.setAttribute('hidden', '')
    })
  }, [])

  // …and only removed once game data is ready, so a failed preload leaves the
  // static content recoverable instead of a blank page. View transitions swap
  // in fresh HTML and remount the island, so both effects re-run per page.
  useEffect(() => {
    if (!ready) return
    document.querySelectorAll('[data-static-fallback]').forEach((el) => {
      el.remove()
    })
  }, [ready])

  return (
    <IslandErrorBoundary>
      <GameDataGate schemas={preloadSchemas} fallback={<Skeleton mode="card" compact={compact} />}>
        {/* The card is the page's body (`presentation="page"`): the page's
            chapter band and foot band frame it, as on the static path. */}
        <Suspense fallback={<Skeleton mode="card" compact={compact} />}>
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
