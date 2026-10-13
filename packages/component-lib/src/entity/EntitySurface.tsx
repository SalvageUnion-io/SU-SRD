import type { ReactNode } from 'react'
import { useContext, useMemo } from 'react'
import { CardTextureContext } from '../components/referenceEntity/card/cardTexture'
import type { EntitySurfaceValue } from './entitySurfaceContext'
import { EntitySurfaceContext } from './entitySurfaceContext'

/**
 * Supply (part of) the SURFACE to every entity form below (`EntitySurfaceValue`):
 * how a ref resolves, the Page opener, texture, where a roll shows, and the
 * page-reference index. A
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
  const { hrefFor, openPage, linkAs, texture, announceRoll, pageRefs } = value
  const merged = useMemo(
    () => ({
      ...parent,
      ...(hrefFor ? { hrefFor } : {}),
      ...(openPage ? { openPage } : {}),
      ...(linkAs ? { linkAs } : {}),
      ...(texture !== undefined ? { texture } : {}),
      ...(announceRoll ? { announceRoll } : {}),
      ...(pageRefs ? { pageRefs } : {}),
    }),
    [parent, hrefFor, openPage, linkAs, texture, announceRoll, pageRefs]
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
