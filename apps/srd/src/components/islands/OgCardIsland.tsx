import { OgCard } from 'component-lib'
import { useEffect, useMemo, useState } from 'react'
import type { SURefEntity, SURefEnumSchemaName, SURefObjectPattern } from 'salvageunion-reference'
import {
  getEntitySlug,
  nameToSlug,
  SalvageUnionReference,
  visiblePatterns,
} from 'salvageunion-reference'
import { ogCardFor } from '../../lib/ogCard'
import { GameDataGate } from '../../lib/useGameData'

/**
 * Build-only OG-card surface.
 *
 * Renders the entity's link preview, `OgCard` (issue 1280): the same
 * ChapterBand, stat boxes and Union bar the pages are built from, at its own
 * 1200 × 630, so `scripts/og-screenshots.ts` photographs it 1:1. It replaced
 * the screenshot of the Catalog tile: the card keeps that pipeline's reason
 * (the preview is drawn by the page's own parts, so it cannot drift from
 * them) at the size a link preview is drawn.
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
      // An unknown schema in the query string: render no card, as for an
      // unknown item. This page only exists for the OG screenshot script.
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

  return (
    <OgCard
      {...ogCardFor(
        target.schema,
        target.item,
        entity,
        pattern ?? undefined,
        target.pattern || undefined
      )}
    />
  )
}

/**
 * Deliberately NOT wrapped in `IslandErrorBoundary`: this is rendered by the
 * build-time screenshot script, never hydrated in a user's browser, so a
 * boundary would have no one to protect. The boundary is for islands that
 * resolve reference data at runtime.
 */
export function OgCardIsland() {
  return (
    <GameDataGate fallback={null}>
      <OgCardResolved />
    </GameDataGate>
  )
}
