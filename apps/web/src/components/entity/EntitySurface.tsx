import type { ReactNode } from 'react'
import { useContext, useMemo } from 'react'
import { CardTextureContext } from '../referenceEntity/card/cardTexture'
import type { EntitySurfaceValue } from './entitySurfaceContext'
import { EntitySurfaceContext } from './entitySurfaceContext'

/**
 * Supply (part of) the SURFACE to every entity form below (`EntitySurfaceValue`,
 * EDL E13): how a ref resolves, the Page opener, texture, the page- and name-reference
 * indexes, whether the app applies the rules (`appliesRules`) and the external
 * cross-link (`externalLink`, `null` for none). A nested provider overrides
 * only what it sets. Setting `texture` also reaches `ReferenceEntityCard`'s own
 * read of it (`CardTextureContext`, until the card reads the surface), so a
 * surface turns the speckle off once.
 */
export function EntitySurfaceProvider({
  value,
  children,
}: {
  value: Partial<EntitySurfaceValue>
  children: ReactNode
}) {
  const parent = useContext(EntitySurfaceContext)
  const { hrefFor, openPage, linkAs, texture, pageRefs, nameRefs, appliesRules, externalLink } =
    value
  const merged = useMemo(
    () => ({
      ...parent,
      ...(hrefFor ? { hrefFor } : {}),
      ...(openPage ? { openPage } : {}),
      ...(linkAs ? { linkAs } : {}),
      ...(texture !== undefined ? { texture } : {}),
      ...(pageRefs ? { pageRefs } : {}),
      ...(nameRefs ? { nameRefs } : {}),
      ...(appliesRules !== undefined ? { appliesRules } : {}),
      ...(externalLink !== undefined ? { externalLink } : {}),
    }),
    [parent, hrefFor, openPage, linkAs, texture, pageRefs, nameRefs, appliesRules, externalLink]
  )
  const provided = (
    <EntitySurfaceContext.Provider value={merged}>{children}</EntitySurfaceContext.Provider>
  )
  return texture === undefined ? (
    provided
  ) : (
    <CardTextureContext.Provider value={texture}>{provided}</CardTextureContext.Provider>
  )
}
