import type { AnchorHTMLAttributes, ComponentType, ReactNode, Ref } from 'react'
import { createContext, useContext, useMemo } from 'react'
import type { EntityRef, RefEntity } from 'salvageunion-reference'
import type { PageRefIndex } from './pageRefs'

/**
 * THE SURFACE (entity display language, §2): what every form inside it reads
 * once, instead of taking it per call —
 *
 * - `hrefFor(ref)`: the entity's page, where the app has one (the SRD's
 *   routes). A synthetic ref (built from embedded data) never links.
 * - `openPage(ref)`: the app's Page opener (the detail dialog).
 * - `texture`: whether bands wear the speckle; a surface that stays flat turns
 *   it off once.
 * - `linkAs`: the app's router link for a root-relative path (The app's
 *   `SiteLink`, since entity pages are site paths outside its base), so a
 *   link-mode form navigates client-side; an external href stays an `<a>`.
 * - `pageRefs`: the entities on each Workshop Manual page the prose cites, so a
 *   "p. 235" links to the page that covers it (`pageRefs.ts`). Absent, a
 *   reference stays text.
 * - `appliesRules`: the app applies the rules the data encodes (The app, ADR-029
 *   §6), so a rules-bearing paragraph wears the AUTO stamp. Absent (the SRD,
 *   which applies nothing), the same paragraph is plain prose.
 * - `externalLink(entity)`: the cross-link a full card's foot and the detail
 *   Page carry (the app's "View in the Reference"). The SRD, which IS the
 *   Reference, sets none; `null` turns it off below (a sheet, a pick).
 */
export type EntitySurfaceValue = {
  hrefFor: (ref: EntityRef) => string | undefined
  openPage?: (ref: EntityRef) => void
  linkAs?: EntityLinkComponent
  texture: boolean
  pageRefs?: PageRefIndex
  appliesRules?: boolean
  externalLink?: EntityExternalLinkBuilder | null
}

/**
 * Builds an entity's external cross-link node, or `undefined` for an entity
 * with no page to link out to.
 */
export type EntityExternalLinkBuilder = (entity: RefEntity) => ReactNode | undefined

/** A router link: an anchor's attributes, a concrete `href`, its children. */
export type EntityLinkComponent = ComponentType<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children?: ReactNode
    ref?: Ref<HTMLAnchorElement>
  }
>

export const EntitySurfaceContext = createContext<Partial<EntitySurfaceValue>>({})

/**
 * Whether the app applies the rules the data encodes (`appliesRules`): read
 * per paragraph, so it reads the one context rather than the whole surface.
 */
export function useAppliesRules(): boolean {
  return useContext(EntitySurfaceContext).appliesRules === true
}

/** The surface's external cross-link for an entity (`externalLink`), if it sets one. */
export function useEntityExternalLink(entity: RefEntity | undefined): ReactNode | undefined {
  const build = useContext(EntitySurfaceContext).externalLink
  return build && entity ? build(entity) : undefined
}

const NO_HREF = () => undefined

/** The surface every form reads, its defaults filling what no provider sets. */
export function useEntitySurface(): EntitySurfaceValue {
  const own = useContext(EntitySurfaceContext)
  return useMemo(
    () => ({
      ...own,
      // A surface with no routes (the app's detail view is not one) links nowhere.
      hrefFor: own.hrefFor ?? NO_HREF,
      texture: own.texture ?? true,
    }),
    [own]
  )
}
