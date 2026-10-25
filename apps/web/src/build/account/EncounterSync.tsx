/**
 * EncounterSync — brings the Mediator's encounters down (ADR-059), as
 * `ShelfSync` brings patterns: from `shelf.encounters`, each row adopted when
 * it is newer than the one this tab last saw (`planRowSync`), and forgotten
 * when the server no longer has it. Encounters are personal and shelf-only,
 * so absence means deleted, the shelf rule; `forget`, never `delete`.
 *
 * Each applied answer is saved to the device copy (ADR-058), so an offline
 * reload still has the night's prep.
 *
 * Mounted by `ShelfSync`, under its registration (`rowArrival.ts`).
 */

import { useQuery } from 'convex/react'
import type { Encounter } from 'game-domain/schemas/encounter'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import type { ServedRow } from '../../lib/links/linkSync'
import { planRowSync } from '../../lib/links/linkSync'
import { captureException } from '../../lib/observability'
import { saveCopy } from '../../stores/deviceCopy'
import { usePrepStore } from '../../stores/prepStore'
import { noteVersion, serverVersions } from '../../stores/serverVersions'

export function EncounterSync() {
  // `undefined` while in flight — the Convex convention, not a loading flag.
  const served = useQuery(api.shelf.encounters, {})

  useEffect(() => {
    if (served === undefined) return
    // A newer emission supersedes this one, as in `ShelfSync`.
    let superseded = false
    void (async () => {
      const store = usePrepStore.getState()
      try {
        const rows = served as ServedRow[]
        for (const { id, updatedAt, row } of planRowSync({
          local: store.list(),
          served: rows,
          adoptedAt: serverVersions(),
        })) {
          if (superseded) return
          try {
            await store.adopt(row.body as Encounter)
            noteVersion(id, updatedAt)
          } catch (err) {
            // One unreadable encounter must not stop the rest arriving.
            captureException(err)
          }
        }
        if (superseded) return
        const ids = new Set(rows.map((r) => (r.body as { id?: unknown } | null)?.id))
        for (const local of usePrepStore.getState().list()) {
          if (!ids.has(local.id)) await store.forget(local.id)
        }
      } finally {
        if (!superseded) {
          store.markArrived()
          void saveCopy({ encounters: served })
        }
      }
    })()
    return () => {
      superseded = true
    }
  }, [served])

  return null
}
