import { createFileRoute, useParams } from '@tanstack/react-router'
import { buttonVariants, SheetSkeleton } from 'component-lib'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AppLink } from '../components/shared/AppLink'
import { PublicSheet } from '../components/sheet/PublicSheet'
import { cn } from '../lib/utils'

/**
 * `/p/$kind/$appId` — one published sheet, readable with no account
 * ([ADR-032](../../../../docs/adrs/ADR-032-public-read-only-sheets.md)).
 *
 * Addressed by the **app id**, not the Convex row id, so the owner can build
 * this URL with no round trip and the Discord bot can build it from the `appId`
 * it is already sent. The query is deliberately unauthenticated; what makes
 * that safe is that it serves nothing unless the owner set `publicRead`.
 *
 * A non-public sheet and a nonexistent one are the same page on purpose —
 * "this exists but is private" is itself a disclosure.
 */
export const Route = createFileRoute('/p/$kind/$appId')({
  component: PublicSheetRoute,
})

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

function PublicSheetRoute() {
  const { kind, appId } = useParams({ from: '/p/$kind/$appId' })

  // Narrowed before it reaches the query, which takes a literal union: a
  // hand-typed path earns an explanation and a way back, not a validation
  // error from the server.
  const valid = isPublicKind(kind)
  const result = useQuery(api.publicSheet.get, valid ? { kind, appId } : 'skip')

  if (!valid) return <NotAvailable />
  // `undefined` is Convex's "still loading"; `null` is a real "no such public
  // sheet". Collapsing them would flash the not-found page on every load.
  if (result === undefined) return <SheetSkeleton />
  if (result === null) return <NotAvailable />

  return <PublicSheet kind={result.kind} body={result.body} />
}
