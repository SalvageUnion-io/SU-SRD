import type { ReactNode } from 'react'
import { useContext, useMemo } from 'react'
import { EntitySurfaceContext } from '../../entity/entitySurfaceContext'
import { EntityExternalLinkProvider } from '../entityHrefContext'
import { InsidePickContext } from './insidePick'

/** A ref that links nowhere: the entities inside a pick resolve to no page. */
const NO_PAGE = () => undefined

/**
 * A card that IS the pick holds no other control (N7; WCAG 4.1.2, axe's
 * nested-interactive): the entities inside it read, linking and opening
 * nothing, and its foot offers no Reference link.
 */
export function PickSurface({ children }: { children: ReactNode }) {
  const parent = useContext(EntitySurfaceContext)
  const surface = useMemo(() => {
    const { openPage: _opens, ...rest } = parent
    return { ...rest, hrefFor: NO_PAGE }
  }, [parent])
  return (
    <InsidePickContext.Provider value={true}>
      <EntityExternalLinkProvider value={undefined}>
        <EntitySurfaceContext.Provider value={surface}>{children}</EntitySurfaceContext.Provider>
      </EntityExternalLinkProvider>
    </InsidePickContext.Provider>
  )
}
