import { createContext, useContext } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

/**
 * Builds a navigable href (show-page link) for an entity. The shape is the
 * consuming app's concern — suref-web supplies its `/schema/.../item/...` route,
 * ITUN its own — so the shared library stays route-agnostic.
 */
export type EntityHrefBuilder = (entity: SURefEntity) => string | undefined

const EntityHrefContext = createContext<EntityHrefBuilder | undefined>(undefined)

/** Provide an app-specific entity href builder to nested entity displays. */
export const EntityHrefProvider = EntityHrefContext.Provider

/** Resolve an entity's href via the provided builder (undefined when none). */
export function useEntityHref(entity: SURefEntity): string | undefined {
  const builder = useContext(EntityHrefContext)
  return builder ? builder(entity) : undefined
}
