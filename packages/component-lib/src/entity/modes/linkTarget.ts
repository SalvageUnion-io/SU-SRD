import type { EntityRef } from 'salvageunion-reference'
import { useEntitySurface } from '../entitySurfaceContext'
import type { EntityMode } from '../types'

/** Where a link-mode form goes: a route, or an opener; neither leaves it inert. */
export type LinkTarget = { href?: string; onOpen?: () => void }

/**
 * LINK's target (E5): the mode's own `href` / `onOpen`, else the surface's —
 * its route for the ref (the SRD), else its Page opener (ITUN). A synthetic
 * ref has neither.
 */
export function useLinkTarget(mode: EntityMode, ref: EntityRef): LinkTarget {
  const surface = useEntitySurface()
  if (mode.kind !== 'link') return {}
  if (mode.href || mode.onOpen) return { href: mode.href, onOpen: mode.onOpen }
  if (ref.synthetic) return {}
  const href = surface.hrefFor(ref)
  if (href) return { href }
  const { openPage } = surface
  return openPage ? { onOpen: () => openPage(ref) } : {}
}
