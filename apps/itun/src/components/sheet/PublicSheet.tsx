/**
 * PublicSheet — one published sheet, read-only, for a reader with no account
 * ([ADR-032](../../../../../docs/adrs/ADR-032-public-read-only-sheets.md)).
 *
 * The third consumer of `frozenSheet.ts`, after the snapshot page and the Game
 * crew view. All three need the same thing — render an entity the viewer does
 * not own, without adopting it into local state — so none of them owns a
 * renderer, and this file adds no rendering code at all.
 *
 * The difference from a snapshot is what it is fed. A snapshot is a frozen blob
 * fetched from Netlify Blobs; this is a live Convex read, so it reflects the
 * sheet as it stands right now and needs nobody to have pressed publish for
 * this particular copy. The banner says so, because "read-only" and "frozen"
 * are different promises and a reader should not have to guess which one they
 * are looking at.
 */

import { useMemo } from 'react'
import { makeFrozenStore, parseFrozenEntity } from './frozenSheet'
import { Sheet } from './Sheet'

type PublicSheetProps = {
  kind: string
  /** The bare entity body, exactly as Convex stores it — not yet validated. */
  body: unknown
}

export function PublicSheet({ kind, body }: PublicSheetProps) {
  const result = useMemo(() => parseFrozenEntity(kind, body), [kind, body])
  const store = useMemo(() => (result.ok ? makeFrozenStore(result) : null), [result])

  if (!result.ok || !store) {
    // The body is `v.any()` on the server, so an unparseable one is a real
    // shape rather than an impossible one. `setPublic` parses before it
    // publishes precisely so the owner meets this first, but a schema that
    // moves afterwards can still land somebody here.
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-xl font-bold">Could not render this sheet</h1>
        <p className="text-wk-muted mb-1 text-sm">
          This build&rsquo;s data doesn&rsquo;t match anything this app knows how to show. It may
          have been made with a newer or older version.
        </p>
        {!result.ok && (
          <p className="text-wk-muted mb-4 break-words font-body text-xs">{result.reason}</p>
        )}
      </main>
    )
  }

  return (
    <div>
      <div
        role="note"
        aria-label="Read-only sheet"
        className="border-b-2 border-ink bg-caution px-4 py-2 font-body text-sm font-semibold text-ink sm:px-[30px]"
      >
        This sheet is shared read-only. It updates as its owner plays.
      </div>

      <Sheet kind={result.kind} id={result.entity.id} store={store} readOnly />
    </div>
  )
}
