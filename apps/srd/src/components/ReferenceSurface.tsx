import type { PageRefIndex } from 'component-lib'
import { EntitySurfaceProvider } from 'component-lib'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

/**
 * The SRD's card surface: a Reference context (ruleset §1), so a roll table
 * reads but carries no rust Roll (`rolls: false`, §2's Reference cell), and
 * the book's "p. N" references link where `pageRefs` (`lib/pageRefIndex.ts`)
 * resolves them.
 */
export function ReferenceSurface({
  pageRefs,
  children,
}: {
  pageRefs?: PageRefIndex
  children: ReactNode
}) {
  const value = useMemo(() => ({ rolls: false, ...(pageRefs ? { pageRefs } : {}) }), [pageRefs])
  return <EntitySurfaceProvider value={value}>{children}</EntitySurfaceProvider>
}
