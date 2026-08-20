/**
 * ShelfSync — fills the local cache from the server of record.
 *
 * This is the half of ADR-034 decision 2 that was missing. Writes have mirrored
 * **up** since ADR-030, but nothing outside a Game ever read back **down**, so a
 * signed-in player opening ITUN on a second device saw an empty roster while
 * their builds sat in Convex the whole time. "IndexedDB is a cache" was a
 * description of intent rather than of behaviour: a cache is something that can
 * be filled, and there was nothing to fill it from.
 *
 * ## Server wins, and that is the point
 *
 * Every row that comes down is adopted over whatever the cache held. There is no
 * merge and no conflict resolution, because with one source of truth there is no
 * second writer to conflict with — that is the whole benefit ADR-034 buys, and
 * reintroducing a merge here would spend it.
 *
 * `adopt` keeps each record's own id, so the local copy **is** the entity rather
 * than a fork of it, and it deliberately skips `requireWritableBackend`: filling
 * a cache is not a user write, and a Disconnected reader must still be able to
 * open what they already pulled down.
 *
 * ## Pruning, and the three conditions that make it safe
 *
 * It also deletes local **shelf** rows the server did not return, which is what
 * finally makes "the cache is a reflection" literally true rather than
 * aspirational. It is the most destructive operation in the codebase, so every
 * guard below is load-bearing and none is obvious.
 *
 * **1. Only shelf rows.** A local row absent from `listMine` is ambiguous, and
 * the ambiguity differs by container. `listMine` returns what the caller *owns*,
 * wherever it lives — but a Game's **unclaimed** pre-gens and its communal
 * crawler have no owner at all, and `GameRoster` legitimately caches them. So
 * anything with a `gameId` is a cached view of somebody else's container and is
 * never pruned. A shelf row is different: `gameId: null` with no owner is the
 * one combination ADR-030 calls invalid, so every shelf row must be owned, and
 * every owned row is in `listMine`. Absence therefore means deleted.
 *
 * **3. Only when no anonymous work is waiting to reach the server.** A brand
 * new visitor who built anonymously and signed in has no legacy roster, so
 * guard 2 waves them through — but their builds are exactly as un-uploaded, and
 * if promotion is still running or has FAILED then absence from `listMine`
 * means "never arrived", not "deleted elsewhere". `promotionState()` carries
 * that, and it is read AFTER the adoption loop awaits so a promotion that
 * failed in the meantime is seen.
 *
 * **2. Only in a browser that never held a legacy roster.** This is the guard
 * that is easy to miss and fatal to omit. For a pre-ADR-034 user who has signed
 * in but not yet claimed, their entire roster is local shelf rows the server has
 * never heard of — and rule 1 would read every one of them as "deleted
 * elsewhere" and destroy the lot. `legacyLocalDataState() === 'absent'` is the
 * only state in which a local row can be trusted to have come from a
 * server-accepted write or from this component, which is what makes absence
 * mean deletion rather than not-yet-uploaded.
 */

import { useQuery } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import { promotionState } from '../../lib/account/promotionState'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { legacyLocalDataState } from '../../lib/db/legacyLocalData'
import { mayPrune, rowMayBePruned } from '../../lib/db/pruneRules'
import { captureException } from '../../lib/observability'
import type { MechPattern } from '../../lib/schemas/pattern'
import { selectBackend } from '../../stores/entityBackend'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'

type Row = { appId?: string | null; body: unknown }

function ConnectedShelfSync() {
  // `undefined` while in flight — the Convex convention, not a loading flag.
  const mine = useQuery(api.entities.listMine, {})
  /**
   * Which payload has already been adopted.
   *
   * `listMine` is a live subscription, so it re-emits on every server change —
   * including the ones this component's own adoptions do not cause but a
   * mirrored write does. Without this guard each emission would re-adopt the
   * whole roster, which is a write storm rather than a sync.
   */
  const lastAdopted = useRef<string | null>(null)

  useEffect(() => {
    if (mine === undefined) return

    // Keyed on the ids the server returned, not on how many there are.
    //
    // Counts are not enough, and the gap is not theoretical now that this
    // prunes: one row created and another deleted in the same emission leaves
    // every count identical, so the effect would skip — no adoption, and more
    // seriously no prune, leaving a row that was deleted on another device
    // cached here forever and looking like it still exists.
    const stamp = JSON.stringify(
      [mine.pilots, mine.mechs, mine.crawlers, mine.mechPatterns].map((rows) =>
        (rows as Row[])
          .map((r) => (r.body as { id?: unknown } | null)?.id)
          .filter((id): id is string => typeof id === 'string')
          .sort()
      )
    )
    if (lastAdopted.current === stamp) return
    lastAdopted.current = stamp

    void (async () => {
      const store = useEntityStore.getState()
      const kinds = [
        ['pilot', mine.pilots],
        ['mech', mine.mechs],
        ['crawler', mine.crawlers],
      ] as const

      for (const [kind, rows] of kinds) {
        for (const row of rows as Row[]) {
          try {
            await store.adopt(kind, row.body as never)
          } catch (err) {
            // One unreadable row must not stop the rest of the roster arriving.
            // A body the server accepted that this build cannot parse is a real
            // schema disagreement worth reporting, but the other builds are
            // fine and the player should see them.
            captureException(err)
          }
        }
      }

      // Patterns live in their own store, and until now were fetched and then
      // thrown away: `entities.listMine` returns `mechPatterns`, the stamp
      // above already keys on them — so this effect re-runs when they change —
      // and the `kinds` table above simply had no entry for them. A signed-in
      // player on a second device got their pilots, mechs and crawlers and an
      // empty pattern library, which is the exact gap ADR-034 P4b exists to
      // close. The fetch half had landed; the adopt half had not.
      //
      // Pattern rows carry only `{ body }` — no `appId` — because a pattern is
      // addressed by the id inside its body, which is likely why they were
      // skipped when the `{ appId, body }` kinds were written.
      const patterns = usePatternStore.getState()
      for (const row of mine.mechPatterns as { body: unknown }[]) {
        try {
          await patterns.adopt(row.body as MechPattern)
        } catch (err) {
          // Same rule as the roster loop above: one unreadable pattern must not
          // stop the rest of the library arriving.
          captureException(err)
        }
      }

      // Patterns are deliberately NOT pruned below. The prune answers "the
      // server did not return this, so it was deleted elsewhere", and that
      // inference is only sound for rows this sync is authoritative over.
      // Adopting them is what the bug was; deleting them is a separate decision
      // with a much worse failure mode, and nothing has asked for it.

      // Prune only where absence is unambiguous — see the header. Every guard
      // matters; dropping any one turns this into a roster-deleter.
      //
      // `promotionState()` is read HERE, after the adoption loop above has
      // awaited, rather than captured when the effect started. A promotion
      // running concurrently may have failed in between, and the whole point of
      // the guard is to see that.
      if (!mayPrune(legacyLocalDataState(), promotionState())) return

      for (const [kind, rows] of kinds) {
        const served = new Set(
          (rows as Row[])
            .map((r) => (r.body as { id?: unknown } | null)?.id)
            .filter((id): id is string => typeof id === 'string')
        )
        for (const local of store.list(kind)) {
          // `containerOf` rather than a bare `gameId === null`, so a
          // pre-ADR-030 record that still resolves through `workspaceId` is
          // classified the same way every other reader classifies it.
          if (!rowMayBePruned(local)) continue
          if (served.has(local.id)) continue
          // `forget`, not `delete`: this removes the local COPY and must never
          // become a server delete. The row is already gone there — that is why
          // it is being pruned — and issuing a delete would turn a sync into a
          // destructive write against whatever the server does hold.
          await store.forget(kind, local.id)
        }
      }
    })()
  }, [mine])

  return null
}

export function ShelfSync() {
  // Never call a Convex hook unconditionally: a build with no `VITE_CONVEX_URL`
  // mounts no provider at all. Gating the whole subtree is the established
  // pattern here (`AccountStrip`, `SignInControl`).
  if (!isConvexConfigured) return null
  // Only when the server of record is actually in play. `remote` rather than
  // "signed in" so a Disconnected session does not fire a query it cannot serve.
  if (selectBackend() !== 'remote') return null
  return <ConnectedShelfSync />
}
