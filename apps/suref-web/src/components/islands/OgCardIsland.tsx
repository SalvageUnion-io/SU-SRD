import { useMemo } from 'react'
import { SalvageUnionReference, getEntitySlug } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { GameDataGate } from '../../lib/useGameData'
import { ReferenceEntityIsland } from './ReferenceEntityIsland'

/**
 * Build-only OG-card surface.
 *
 * Resolves an entity from the `?schema=&item=` query string and renders the
 * REAL `ReferenceEntityIsland` (the same component the item page hydrates), so
 * tools/og-screenshots.ts can screenshot a true 1:1 image of the on-page card
 * for each entity's og:image. One static page serves every entity — the slug is
 * resolved client-side against the loaded ORM, so the build emits no per-entity
 * render pages.
 */
function readParams(): { schema: string | null; item: string | null } {
  if (typeof window === 'undefined') return { schema: null, item: null }
  const params = new URLSearchParams(window.location.search)
  return { schema: params.get('schema'), item: params.get('item') }
}

function OgCardResolved() {
  const { schema, item } = useMemo(() => readParams(), [])

  // Match the entity the same way getItemStaticPaths builds the og.png path:
  // by getEntitySlug (which getReferenceEntityData().slug also uses), so every
  // built path resolves here — including unnamed entities that fall back to id.
  const entity = useMemo<SURefEntity | null>(() => {
    if (!schema || !item) return null
    try {
      const all = SalvageUnionReference.findAllIn(schema as SURefEnumSchemaName, () => true)
      return all.find((candidate) => getEntitySlug(candidate) === item) ?? null
    } catch {
      return null
    }
  }, [schema, item])

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
