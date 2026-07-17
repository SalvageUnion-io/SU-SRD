import { useEffect, useMemo, useState } from 'react'
import { SalvageUnionReference, getEntitySlug } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { GameDataGate } from '../../lib/useGameData'
import { ReferenceEntityIsland } from './ReferenceEntityIsland'

/**
 * Build-only OG-card surface.
 *
 * Renders the REAL ReferenceEntityIsland (the same component the item page
 * hydrates) so tools/og-screenshots.ts can screenshot a true 1:1 image of the
 * on-page card for each entity's og:image.
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
type Target = { schema: string; item: string }

declare global {
  interface Window {
    __ogSetEntity?: (schema: string, item: string) => void
  }
}

function readParams(): Target {
  if (typeof window === 'undefined') return { schema: '', item: '' }
  const params = new URLSearchParams(window.location.search)
  return { schema: params.get('schema') ?? '', item: params.get('item') ?? '' }
}

function OgCardResolved() {
  const [target, setTarget] = useState<Target>(() => readParams())

  // Expose the external entity-swapping hook + signal data readiness. This
  // component only mounts inside GameDataGate, so reaching here means the ORM
  // is loaded.
  useEffect(() => {
    window.__ogSetEntity = (schema, item) => setTarget({ schema, item })
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

  // Publish which entity is now committed so the tool captures the right card.
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-og-current',
      entity ? `${target.schema}/${target.item}` : `MISSING:${target.schema}/${target.item}`
    )
  }, [entity, target])

  if (!entity) return null
  return <ReferenceEntityIsland item={entity} titleAs="h1" />
}

export function OgCardIsland() {
  return (
    <GameDataGate fallback={null}>
      <OgCardResolved />
    </GameDataGate>
  )
}
