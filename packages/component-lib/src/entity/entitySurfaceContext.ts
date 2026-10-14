import type { AnchorHTMLAttributes, ComponentType, ReactNode, Ref } from 'react'
import { createContext, useContext, useMemo } from 'react'
import type { EntityRef, SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CardTextureContext } from '../components/referenceEntity/card/cardTexture'
import type {
  EntityHrefBuilder,
  PatternHrefBuilder,
} from '../components/referenceEntity/entityHrefContext'
import {
  useEntityDetailLink,
  useEntityHrefBuilder,
  usePatternHrefBuilder,
} from '../components/referenceEntity/entityHrefContext'
import type { PageRefIndex } from './pageRefs'

/**
 * THE SURFACE (entity display language, §2): what every form inside it reads
 * once, instead of taking it per call —
 *
 * - `hrefFor(ref)`: the entity's page, where the app has one (the SRD's
 *   routes). A synthetic ref (built from embedded data) never links.
 * - `openPage(ref)`: ITUN's Page opener (the detail dialog).
 * - `texture`: whether bands wear the speckle; the Dashboard turns it off once.
 * - `linkAs`: the app's router link (ITUN's `AppLink`), for an in-app path, so
 *   a link-mode form navigates client-side; an external href stays an `<a>`.
 * - `pageRefs`: the entities on each Workshop Manual page the prose cites, so a
 *   "p. 235" links to the page that covers it (`pageRefs.ts`). Absent, a
 *   reference stays text.
 */
export type EntitySurfaceValue = {
  hrefFor: (ref: EntityRef) => string | undefined
  openPage?: (ref: EntityRef) => void
  linkAs?: EntityLinkComponent
  texture: boolean
  pageRefs?: PageRefIndex
}

/** A router link: an anchor's attributes, a concrete `href`, its children. */
export type EntityLinkComponent = ComponentType<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children?: ReactNode
    ref?: Ref<HTMLAnchorElement>
  }
>

export const EntitySurfaceContext = createContext<Partial<EntitySurfaceValue>>({})

/** The dataset record a ref names, when its schema is loaded. */
function recordOf(ref: EntityRef): SURefEntity | undefined {
  if (ref.synthetic || !SalvageUnionReference.isLoaded(ref.schemaName)) return undefined
  return SalvageUnionReference.get(ref.schemaName, ref.id) as SURefEntity | undefined
}

/**
 * The ADAPTER onto the legacy providers: an app that still
 * supplies `EntityHrefProvider` / `PatternHrefProvider` and links out
 * (`EntityDetailLinkProvider`, the SRD) gets a surface `hrefFor` from them.
 */
function legacyHrefFor(
  entityHref: EntityHrefBuilder | undefined,
  patternHref: PatternHrefBuilder | undefined
): (ref: EntityRef) => string | undefined {
  return (ref) => {
    const record = recordOf(ref)
    if (!record) return undefined
    if (!ref.pattern) return entityHref?.(record)
    const pattern =
      'patterns' in record && Array.isArray(record.patterns)
        ? record.patterns.find((p) => p.name === ref.pattern)
        : undefined
    return pattern ? patternHref?.(record, pattern) : undefined
  }
}

const NO_HREF = () => undefined

/** The surface every form reads, the legacy providers filling what it does not set. */
export function useEntitySurface(): EntitySurfaceValue {
  const own = useContext(EntitySurfaceContext)
  const entityHref = useEntityHrefBuilder()
  const patternHref = usePatternHrefBuilder()
  const linksOut = useEntityDetailLink()
  const legacyTexture = useContext(CardTextureContext)
  return useMemo(
    () => ({
      // An app's own detail view (ITUN's) is not a route: only a surface that
      // links out (the SRD) turns the legacy href builder into links.
      hrefFor: own.hrefFor ?? (linksOut ? legacyHrefFor(entityHref, patternHref) : NO_HREF),
      ...(own.openPage ? { openPage: own.openPage } : {}),
      ...(own.linkAs ? { linkAs: own.linkAs } : {}),
      texture: own.texture ?? legacyTexture,
      ...(own.pageRefs ? { pageRefs: own.pageRefs } : {}),
    }),
    [own, entityHref, patternHref, linksOut, legacyTexture]
  )
}
