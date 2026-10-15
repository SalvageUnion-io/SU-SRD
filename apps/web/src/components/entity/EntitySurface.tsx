import type { ReactNode } from 'react'
import { useContext, useMemo } from 'react'
import { CardTextureContext } from '../referenceEntity/card/cardTexture'
import type { EntitySurfaceValue } from './entitySurfaceContext'
import { EntitySurfaceContext } from './entitySurfaceContext'

/**
 * Supply (part of) the SURFACE to every entity form below (`EntitySurfaceValue`):
 * how a ref resolves, the Page opener, texture, the page-reference index and
 * whether the app applies the rules (`appliesRules`). A
 * nested provider overrides only what it sets. Setting `texture` also reaches
 * the legacy `ReferenceEntityCard`s inside, so a surface turns the speckle off
 * once.
 */
export function EntitySurfaceProvider({
  value,
  children,
}: {
  value: Partial<EntitySurfaceValue>
  children: ReactNode
}) {
  const parent = useContext(EntitySurfaceContext)
  const { hrefFor, openPage, linkAs, texture, pageRefs, appliesRules } = value
  const merged = useMemo(
    () => ({
      ...parent,
      ...(hrefFor ? { hrefFor } : {}),
      ...(openPage ? { openPage } : {}),
      ...(linkAs ? { linkAs } : {}),
      ...(texture !== undefined ? { texture } : {}),
      ...(pageRefs ? { pageRefs } : {}),
      ...(appliesRules !== undefined ? { appliesRules } : {}),
    }),
    [parent, hrefFor, openPage, linkAs, texture, pageRefs, appliesRules]
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
