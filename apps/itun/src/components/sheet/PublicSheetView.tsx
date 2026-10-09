/**
 * PublicSheetView — the `/p/$kind/$appId` page body, minus the router.
 *
 * Lives here rather than in the route file so that file exports nothing but
 * `Route`: any other export stops TanStack Router's `autoCodeSplitting` from
 * moving the route component out of the entry chunk, which is how
 * `PublicSheet` and the whole sheet tree it renders ended up downloaded on
 * every route (audit AP-11). Tests render it directly.
 */

import { buttonVariants, cn } from 'component-lib'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { AppLink } from '../shared/AppLink'
import { PublicSheet } from './PublicSheet'
import { SheetSkeleton } from './SheetSkeleton'

const KINDS = ['pilot', 'mech', 'crawler'] as const
type PublicKind = (typeof KINDS)[number]

function isPublicKind(value: string): value is PublicKind {
  return (KINDS as readonly string[]).includes(value)
}

function NotAvailable() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-xl font-bold">This sheet isn&rsquo;t available</h1>
      <p className="mb-4 text-sm text-wk-muted">
        The link may be wrong, or its owner may have stopped sharing it.
      </p>
      <AppLink
        href="/"
        className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'no-underline')}
      >
        &larr; In The Union Now
      </AppLink>
    </main>
  )
}

/** The half that talks to Convex, reached only with a known kind. */
function PublicSheetQuery({ kind, appId }: { kind: PublicKind; appId: string }) {
  const result = useQuery(api.publicSheet.get, { kind, appId })

  // `undefined` is Convex's "still loading"; `null` is a real "no such public
  // sheet". Collapsing them would flash the not-found page on every load.
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable />

  return <PublicSheet appId={appId} answer={result} />
}

/**
 * Everything the route decides, minus the router. Exported so a test can
 * render it directly rather than through a `RouterProvider`.
 */
export function PublicSheetView({ kind, appId }: { kind: string; appId: string }) {
  // A hand-typed path earns an explanation and a way back, not a validation
  // error from the server.
  if (!isPublicKind(kind)) return <NotAvailable />

  return <PublicSheetQuery kind={kind} appId={appId} />
}
