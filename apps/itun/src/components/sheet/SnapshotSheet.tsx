/**
 * SnapshotSheet — renders a published snapshot payload as a read-only sheet
 * on the rebuilt Header C shell (plan 4.8).
 *
 * Store-free: the frozen snapshot entity is wrapped in a private read-only
 * Zustand store (writes throw; they are unreachable because every edit
 * affordance is suppressed by `readOnly`) and threaded into the same Sheet /
 * composition-resolver path the live sheets use. The app's entityStore,
 * SoftLinks and IndexedDB are never touched, so the /s/$id route renders
 * fully independent of local state. With no SoftLinks the resolver yields
 * the single-entity mode — no rail chips to other people's data.
 *
 * The frozen store and the Zod parse both live in `frozenSheet.ts`, shared with
 * the Game crew view (`GameEntitySheet`), which needs the same
 * read-without-owning mechanism for a crewmate's build.
 *
 * Snapshot payload shape (as published by PublishButton v1):
 *   { kind: 'pilot' | 'mech' | 'crawler', entity: <entity object> }
 *
 * Payloads are Zod-validated; a graceful error state renders on mismatch.
 */

import { useMemo } from 'react'

import { isRecord } from '../../lib/isRecord'
import { AppLink } from '../shared/AppLink'
import { makeFrozenStore, parseFrozenEntity } from './frozenSheet'

import { Sheet } from './Sheet'

type SnapshotSheetProps = {
  /** The raw payload returned by retrieveSnapshot — not yet validated. */
  snapshot: Record<string, unknown>
}

/**
 * Ability refs of the pilot this instance was published with.
 *
 * A snapshot shares a LIVE INSTANCE, and a live mech's maxima depend on its
 * pilot: Beefcake raises the piloted mech's Max SP and Cargo (ADR-029). Without
 * this a shared mech reads LOWER than the same mech on its owner's sheet.
 *
 * Absent on snapshots published before the field existed, and on kinds that have
 * no piloting context — treated as "no contributions", never as an error.
 */
function parseContext(snapshot: Record<string, unknown>): string[] | undefined {
  const context = snapshot.context
  if (!isRecord(context)) return undefined
  const refs = context.pilotAbilities
  if (!Array.isArray(refs)) return undefined
  return refs.filter((r): r is string => typeof r === 'string')
}

export function SnapshotSheet({ snapshot }: SnapshotSheetProps) {
  const result = useMemo(() => parseFrozenEntity(snapshot.kind, snapshot.entity), [snapshot])
  const store = useMemo(() => (result.ok ? makeFrozenStore(result) : null), [result])
  const pilotAbilities = useMemo(() => parseContext(snapshot), [snapshot])

  if (!result.ok || !store) {
    // Styled validation-failure state (plan 5.2) — invalid payloads land
    // here, never in a crash: the Zod parse above is the only consumer of
    // the untrusted payload.
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-xl font-bold">Could not render snapshot</h1>
        <p className="text-wk-muted mb-1 text-sm">
          This snapshot&rsquo;s data doesn&rsquo;t match any build this app knows how to show. It
          may have been published by a newer or older version.
        </p>
        {!result.ok && (
          <p className="text-wk-muted mb-4 break-words font-body text-xs">{result.reason}</p>
        )}
        <AppLink href="/" className="text-sm underline">
          &larr; Back to Roster
        </AppLink>
      </main>
    )
  }

  return (
    <div>
      {/* Snapshot banner — makes read-only context clear */}
      <div
        role="note"
        aria-label="Read-only snapshot"
        className="border-b-2 border-ink bg-caution px-4 py-2 font-body text-sm font-semibold text-ink sm:px-[30px]"
      >
        This is a read-only snapshot. Changes made in-game are not reflected here.
      </div>

      <Sheet
        kind={result.kind}
        id={result.entity.id}
        store={store}
        pilotAbilities={result.kind === 'mech' ? pilotAbilities : undefined}
        readOnly
      />
    </div>
  )
}
