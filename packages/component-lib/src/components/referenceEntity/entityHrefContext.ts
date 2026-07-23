import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

/**
 * Builds a navigable href (show-page link) for an entity. The shape is the
 * consuming app's concern — srd supplies its `/schema/.../item/...` route,
 * ITUN its own — so the shared library stays route-agnostic.
 */
export type EntityHrefBuilder = (entity: SURefEntity) => string | undefined

const EntityHrefContext = createContext<EntityHrefBuilder | undefined>(undefined)

/** Provide an app-specific entity href builder to nested entity displays. */
export const EntityHrefProvider = EntityHrefContext.Provider

/** Resolve an entity's href via the provided builder (undefined when none). */
export function useEntityHref(entity: SURefEntity | undefined): string | undefined {
  const builder = useContext(EntityHrefContext)
  return builder && entity ? builder(entity) : undefined
}

const EntityDetailLinkContext = createContext<boolean>(false)

/**
 * Opt nested "View details" controls into opening the entity's show page in a
 * new tab (via the provided href builder) instead of the in-place modal.
 * srd — a navigable reference site — sets this; ITUN leaves it default
 * `false` so its detail view stays an in-app modal rather than linking out.
 */
export const EntityDetailLinkProvider = EntityDetailLinkContext.Provider

/** Whether "View details" should link out (new tab) instead of opening a modal. */
export function useEntityDetailLink(): boolean {
  return useContext(EntityDetailLinkContext)
}

/**
 * Builds an external cross-link node for an entity (e.g. ITUN's
 * "View in SRD →" deep link out to srd). Full — non-compact,
 * non-listing — entity cards render it in their foot band, which includes the
 * `useDetailModal` detail view (its content renders full). Return `undefined`
 * for entities without an external page. srd (which *is* the SRD)
 * provides no builder, so nothing renders there.
 */
export type EntityExternalLinkBuilder = (entity: SURefEntity) => ReactNode | undefined

const EntityExternalLinkContext = createContext<EntityExternalLinkBuilder | undefined>(undefined)

/** Provide an app-specific external cross-link builder to nested entity displays. */
export const EntityExternalLinkProvider = EntityExternalLinkContext.Provider

/** Resolve an entity's external cross-link via the provided builder (undefined when none). */
export function useEntityExternalLink(entity: SURefEntity | undefined): ReactNode | undefined {
  const builder = useContext(EntityExternalLinkContext)
  return builder && entity ? builder(entity) : undefined
}
