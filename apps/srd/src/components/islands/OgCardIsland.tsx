import { useEffect, useMemo, useState } from 'react'
import {
  SalvageUnionReference,
  getEntitySlug,
  nameToSlug,
  visiblePatterns,
} from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName, SURefObjectPattern } from 'salvageunion-reference'
import { EntityHrefProvider, EntityDetailLinkProvider } from 'component-lib'
import { GameDataGate } from '../../lib/useGameData'
import { itemHref, patternHref, srdEntityHref } from '../../lib/entityHref'
import { CatalogTile } from './CatalogTile'

/**
 * Build-only OG-card surface.
 *
 * Renders the REAL catalog tile — the same `ReferenceEntityCard` with the same
 * props, providers and wrapper the schema index emits (see SchemaViewerIsland's
 * entity grid) — so `scripts/og-screenshots.ts` screenshots a 1:1 image of the
 * Catalog view of each entity rather than a bespoke OG-only approximation.
 *
 * The tile is fixed at CATALOG_TILE_WIDTH (its measured index-page width at a
 * desktop viewport) because the index tile is fluid — a `flex-1` masonry column
 * — and so has no intrinsic width of its own. Pinning it reproduces the tile a
 * desktop reader actually sees.
 *
 * The entity is swappable from outside via `window.__ogSetEntity(schema, item)`,
 * so the screenshot tool loads this page ONCE per worker (game-data corpus +
 * island loaded a single time) and re-renders each entity in place instead of a
 * full navigation per entity — far faster and lighter, and it avoids the
 * under-load dynamic-import failures that per-navigation rendering hit.
 *
 * Coordination markers on <html>:
 *   - `data-og-ready=""`        once game data is loaded (tool can start swapping)
 *   - `data-og-current="s/i"`   the entity currently committed to the DOM
 */
type Target = { schema: string; item: string; pattern: string }

declare global {
  interface Window {
    __ogSetEntity?: (schema: string, item: string, pattern?: string) => void
  }
}

function readParams(): Target {
  if (typeof window === 'undefined') return { schema: '', item: '', pattern: '' }
  const params = new URLSearchParams(window.location.search)
  return {
    schema: params.get('schema') ?? '',
    item: params.get('item') ?? '',
    pattern: params.get('pattern') ?? '',
  }
}

/** The key the generator waits on — a pattern is addressed under its chassis. */
function targetKey(target: Target): string {
  return target.pattern
    ? `${target.schema}/${target.item}/pattern/${target.pattern}`
    : `${target.schema}/${target.item}`
}

function OgCardResolved() {
  const [target, setTarget] = useState<Target>(() => readParams())

  // Expose the external entity-swapping hook + signal data readiness. This
  // component only mounts inside GameDataGate, so reaching here means the ORM
  // is loaded.
  useEffect(() => {
    window.__ogSetEntity = (schema, item, pattern) =>
      setTarget({ schema, item, pattern: pattern ?? '' })
    document.documentElement.setAttribute('data-og-ready', '')
    return () => {
      delete window.__ogSetEntity
    }
  }, [])

  // Match the entity the same way getItemStaticPaths builds the og.png path:
  // by getEntitySlug (which getReferenceEntityData().slug also uses).
  const entity = useMemo<SURefEntity | null>(() => {
    if (!target.schema || !target.item) return null
    try {
      const all = SalvageUnionReference.findAllIn(target.schema as SURefEnumSchemaName, () => true)
      return all.find((candidate) => getEntitySlug(candidate) === target.item) ?? null
    } catch {
      return null
    }
  }, [target])

  // …and resolve the pattern the same way getPatternStaticPaths does: over the
  // chassis's VISIBLE patterns, keyed by nameToSlug. A pattern target that
  // doesn't resolve must not silently fall back to the chassis tile — that would
  // ship the wrong card — so it reports MISSING below and is skipped.
  const pattern = useMemo<SURefObjectPattern | null>(() => {
    if (!entity || !target.pattern) return null
    // `patterns` lives on chassis only, so it isn't on the SURefEntity union —
    // read it through a narrow accessor rather than widening the union.
    const patterns = (entity as { patterns?: SURefObjectPattern[] }).patterns ?? []
    return visiblePatterns(patterns).find((p) => nameToSlug(p.name) === target.pattern) ?? null
  }, [entity, target.pattern])

  const resolved = !!entity && (!target.pattern || !!pattern)

  // Publish which entity is now committed so the tool captures the right card.
  useEffect(() => {
    const key = targetKey(target)
    document.documentElement.setAttribute('data-og-current', resolved ? key : `MISSING:${key}`)
  }, [resolved, target])

  if (!entity || !resolved) return null

  // The SAME `CatalogTile` the schema index renders, under the same providers —
  // that shared component is what makes the og:image a true 1:1 of the Catalog
  // view rather than a look-alike that can drift.
  const href = pattern
    ? patternHref(target.schema, target.item, target.pattern)
    : itemHref(target.schema, target.item)

  return (
    <EntityHrefProvider value={srdEntityHref}>
      <EntityDetailLinkProvider value={true}>
        <div data-og-tile="">
          <CatalogTile entity={entity} href={href} pattern={pattern ?? undefined} />
        </div>
      </EntityDetailLinkProvider>
    </EntityHrefProvider>
  )
}

export function OgCardIsland() {
  return (
    <GameDataGate fallback={null}>
      <OgCardResolved />
    </GameDataGate>
  )
}
