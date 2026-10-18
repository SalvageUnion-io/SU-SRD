import type { ComponentProps, ReactNode } from 'react'
import type { EntitySurfaceValue } from '../index'
import { EntitySurfaceProvider } from '../index'

type EntityLink = NonNullable<EntitySurfaceValue['linkAs']>

/** A plain anchor: following it loads the page. */
function DocumentAnchor({ children, ...rest }: ComponentProps<EntityLink>) {
  return <a {...rest}>{children}</a>
}

const SURFACE = { linkAs: DocumentAnchor } satisfies Partial<EntitySurfaceValue>

/**
 * The entity links below it are reference pages, which live outside any
 * router: on a static page and in the app alike (where the surface's
 * router link would put a root-relative path under `/build/`), each one is a
 * plain `<a href>` that opens the page in the same tab.
 */
export function DocumentLinks({ children }: { children: ReactNode }) {
  return <EntitySurfaceProvider value={SURFACE}>{children}</EntitySurfaceProvider>
}
