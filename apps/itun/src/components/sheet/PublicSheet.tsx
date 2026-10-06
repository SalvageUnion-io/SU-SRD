/**
 * PublicSheet — one published sheet, read-only, for a reader with no account
 * ([ADR-032](../../../../../docs/adrs/ADR-032-public-read-only-sheets.md)).
 *
 * Rendered by the same live `<Sheet>` as every other surface, from a store built
 * out of `publicSheet.get` (`readOnlySheetStore.ts`), so it adds no rendering
 * code of its own. That query is reactive: the page reflects the sheet as it
 * stands right now, assignments included — its mech, its crawler, a crawler's
 * crew.
 *
 * It is the only account-free way to share a sheet: frozen snapshots were
 * retired (ADR-036), and an old `/s/:id` link redirects here when its entity
 * is public. The banner says the page is live, because "read-only" and
 * "frozen" are different promises and a reader should not have to guess.
 *
 * When the entity at the other end of an assignment is published too, its row
 * carries its name, its vitals and a View into its own public page. When it is
 * not, the server sends its kind and nothing else, and its slot says "Not
 * shared" (`WithheldUnitRow`) — publishing your pilot never names, let alone
 * republishes, your crewmate's.
 */

import { useMemo } from 'react'
import type { EntityRef } from '../../lib/schemas/entity'
import type { PublicSheetAnswer } from './readOnlySheetStore'
import { makeReadOnlySheetStore, sheetDataFromPublic } from './readOnlySheetStore'
import { Sheet } from './Sheet'

type PublicSheetProps = {
  /** The app id the page is addressed by — the published entity's own id. */
  appId: string
  /** `publicSheet.get`'s answer; bodies in it are not yet validated. */
  answer: PublicSheetAnswer & {
    /**
     * Ability refs of the pilot flying this mech, resolved server-side.
     *
     * Load-bearing, not decorative: a mech's Max SP and Cargo depend on its
     * pilot (ADR-029), and that pilot's sheet is usually not published — so
     * without this a published mech reads LOWER than the same mech on its
     * owner's sheet.
     */
    pilotAbilities?: string[]
  }
}

export function PublicSheet({ appId, answer }: PublicSheetProps) {
  const { data, withheld, published } = useMemo(
    () => sheetDataFromPublic(answer, appId),
    [answer, appId]
  )
  const store = useMemo(() => makeReadOnlySheetStore(data), [data])
  // Only a published entity has a page a reader can open.
  const hrefFor = useMemo(
    () => (kind: EntityRef['type'], id: string) =>
      published.has(id) ? `/p/${kind}/${id}` : undefined,
    [published]
  )
  const kind = answer.kind

  if (
    (kind !== 'pilot' && kind !== 'mech' && kind !== 'crawler') ||
    store.getState().get(kind, appId) === null
  ) {
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

      <Sheet
        kind={kind}
        id={appId}
        store={store}
        pilotAbilities={kind === 'mech' ? answer.pilotAbilities : undefined}
        hrefFor={hrefFor}
        withheld={withheld}
        readOnly
      />
    </div>
  )
}
