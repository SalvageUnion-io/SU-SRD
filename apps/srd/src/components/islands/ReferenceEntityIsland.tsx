import { Suspense, useEffect, useMemo } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import {
  ReferenceEntityCard,
  CardSkeleton,
  getClassSelections,
  ClassAbilityTree,
  EntityHrefProvider,
  EntityDetailLinkProvider,
} from 'component-lib'
import { GameDataGate, useGameData, type SchemaList } from '../../lib/useGameData'
import { srdEntityHref } from '../../lib/entityHref'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type ReferenceEntityIslandProps = {
  item: SURefEntity
  compact?: boolean
  titleAs?: 'span' | 'h1'
  /** Which schemas to preload — defaults to `'all'`. Pass the per-route list
   *  from `../../lib/schemaPreloadDeps.ts` to load only what this item needs. */
  preloadSchemas?: SchemaList
}

export function ReferenceEntityIsland({
  item,
  compact = false,
  titleAs,
  preloadSchemas,
}: ReferenceEntityIslandProps) {
  const classSelections = useMemo(() => getClassSelections(item), [item])
  const classEntity = classSelections.selectedClass || classSelections.selectedAdvancedClass

  const { ready } = useGameData({ schemas: preloadSchemas })

  // The static SEO/no-JS fallback stays in the served HTML (crawlers and no-JS
  // users keep the content, including the page's only <h1>). For JS users it
  // is hidden as soon as the island hydrates (avoids a duplicate-<h1> flash
  // next to the skeleton)…
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
      <GameDataGate
        schemas={preloadSchemas}
        fallback={
          <div className="mx-auto w-full max-w-6xl p-4">
            <CardSkeleton compact={compact} />
          </div>
        }
      >
        <div className="mx-auto w-full max-w-6xl p-4">
          <Suspense fallback={<CardSkeleton compact={compact} />}>
            <EntityHrefProvider value={srdEntityHref}>
              <EntityDetailLinkProvider value={true}>
                <ReferenceEntityCard
                  data={item}
                  size={compact ? 'medium' : 'large'}
                  titleAs={titleAs}
                  afterExtraContent={
                    classEntity ? <ClassAbilityTree classEntity={classEntity} /> : undefined
                  }
                  label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
                />
              </EntityDetailLinkProvider>
            </EntityHrefProvider>
          </Suspense>
        </div>
      </GameDataGate>
    </IslandErrorBoundary>
  )
}
