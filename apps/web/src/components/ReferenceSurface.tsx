import type { PageRefIndex } from 'component-lib'
import { EntitySurfaceProvider } from 'component-lib'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

/**
 * The SRD's card surface: a Reference context (ruleset §1) whose "p. N"
 * references link where `pageRefs` (`lib/pageRefIndex.ts`) resolves them. Its
 * roll tables raise their results as toasts, as every roll does (`toastRoll`,
 * into `ReferenceEntityIsland`'s `<Toaster />`).
 */
export function ReferenceSurface({
  pageRefs,
  children,
}: {
  pageRefs?: PageRefIndex
  children: ReactNode
}) {
  const value = useMemo(() => (pageRefs ? { pageRefs } : {}), [pageRefs])
  return <EntitySurfaceProvider value={value}>{children}</EntitySurfaceProvider>
}
