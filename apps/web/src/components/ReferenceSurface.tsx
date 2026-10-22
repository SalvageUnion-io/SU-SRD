import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { srdHrefFor } from '../lib/entityHref'
import type { NameRefIndex, PageRefIndex } from './index'
import { EntitySurfaceProvider } from './index'

/**
 * The SRD's card surface: a Reference context (ruleset §1) whose entities link
 * to their pages (`srdHrefFor`: an entity's, a pattern's under its chassis)
 * and whose "p. N" references link where `pageRefs` (`lib/pageRefIndex.ts`)
 * resolves them, and whose plain-word names link where `nameRefs`
 * (`lib/nameRefIndex.ts`) holds them. Its
 * roll tables raise their results as toasts, as every roll does (`toastRoll`,
 * into the page's one toaster, `ToasterMount`).
 */
export function ReferenceSurface({
  pageRefs,
  nameRefs,
  children,
}: {
  pageRefs?: PageRefIndex
  nameRefs?: NameRefIndex
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      hrefFor: srdHrefFor,
      ...(pageRefs ? { pageRefs } : {}),
      ...(nameRefs ? { nameRefs } : {}),
    }),
    [pageRefs, nameRefs]
  )
  return <EntitySurfaceProvider value={value}>{children}</EntitySurfaceProvider>
}
