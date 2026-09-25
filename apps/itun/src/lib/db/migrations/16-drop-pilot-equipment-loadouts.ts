/**
 * v16 — delete the retired `equipmentLoadouts` key from stored pilots.
 *
 * v11 lifted every slug-keyed loadout into `Pilot.partners` and deliberately
 * left the key behind, because `PilotSchema` is `.strict()` and still declared
 * the field: dropping the key and the field in one release would have made
 * every migrated record unparseable at once. The field is gone from the schema
 * now (audit AP-18), so the key is removed from the rows too.
 *
 * The rewrite is `normalizeLegacyPilotRecord`, the same function every other
 * pilot entry point runs (import, snapshots, the Convex edge parse, and this
 * store's own reads). A record that somehow reaches v16 without having gone
 * through v11 is therefore lifted into `partners` rather than losing its
 * loadouts; one that already has `partners` keeps them untouched.
 *
 * IMPORTANT: this function runs inside the versionchange transaction. Only
 * IndexedDB operations on `tx` may be awaited — awaiting anything else lets
 * the transaction auto-commit out from under the migration.
 */

import { isRecord } from '../../isRecord'
import { normalizeLegacyPilotRecord } from '../../schemas/pilot'
import { STORE_NAMES } from '../stores'
import type { UpgradeTransaction } from './types'

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  if (!tx.db.objectStoreNames.contains(STORE_NAMES.pilots)) return
  let cursor = await tx.objectStore(STORE_NAMES.pilots).openCursor()
  while (cursor) {
    const raw = cursor.value as unknown
    if (isRecord(raw) && 'equipmentLoadouts' in raw) {
      await cursor.update(normalizeLegacyPilotRecord(raw))
    }
    cursor = await cursor.continue()
  }
}
