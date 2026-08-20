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
 * ## What it does NOT do
 *
 * It does not delete local rows the server does not return. That would be the
 * honest completion of "the cache is a reflection", and it is deliberately left
 * for the phase that turns the account gate on: until then a Solo user's
 * IndexedDB is still their source of truth, and pruning it against a server that
 * has never heard of those rows would delete their roster. The plan records this
 * as the remaining half of the demotion.
 */

import { useQuery } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { captureException } from '../../lib/observability'
import { selectBackend } from '../../stores/entityBackend'
import { useEntityStore } from '../../stores/entityStore'

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

    const stamp = JSON.stringify([
      mine.pilots.length,
      mine.mechs.length,
      mine.crawlers.length,
      mine.mechPatterns.length,
    ])
    if (lastAdopted.current === stamp) return
    lastAdopted.current = stamp

    void (async () => {
      const store = useEntityStore.getState()
      for (const [kind, rows] of [
        ['pilot', mine.pilots],
        ['mech', mine.mechs],
        ['crawler', mine.crawlers],
      ] as const) {
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
