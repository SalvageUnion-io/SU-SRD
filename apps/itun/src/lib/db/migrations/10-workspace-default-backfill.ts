/**
 * v10 — mandatory current-workspace model.
 *
 * Workspaces became the organizing primitive: there is no cross-workspace
 * "All Builds" view any more, so every build must live in a workspace and the
 * app always lands in a built-in "Default workspace" (see lib/defaultWorkspace).
 *
 * This one-shot migration makes that true for existing data AND fresh installs
 * (idb runs it for both 9 → 10 and 0 → 10):
 *   1. Create the Default workspace record if it isn't already present.
 *   2. Backfill `workspaceId = DEFAULT_WORKSPACE_ID` onto every pilot / mech /
 *      crawler / encounterNpc that has none, so nothing that used to show under
 *      "All Builds" disappears. Records that already carry a `workspaceId`
 *      (Starter Set members, imports) are left untouched.
 *
 * IMPORTANT: this runs inside the versionchange transaction. Only IndexedDB
 * operations on `tx` may be awaited — no reference-data reads (they would let
 * the transaction auto-commit mid-migration). The Default workspace record is a
 * static JS constant, not a reference lookup, so importing it is safe.
 */

import { DEFAULT_WORKSPACE, DEFAULT_WORKSPACE_ID } from '../../defaultWorkspace'
import { isRecord } from '../../isRecord'
import { STORE_NAMES } from '../stores'
import type { UpgradeTransaction } from './index'

/** Object stores whose records get the Default-workspace backfill. */
const BACKFILL_STORES: readonly string[] = [
  STORE_NAMES.pilots,
  STORE_NAMES.mechs,
  STORE_NAMES.crawlers,
  STORE_NAMES.encounterNpcs,
]

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  // 1. Ensure the Default workspace exists (idempotent — skip if present).
  if (tx.db.objectStoreNames.contains(STORE_NAMES.workspaces)) {
    const workspaces = tx.objectStore(STORE_NAMES.workspaces)
    const existing = await workspaces.get(DEFAULT_WORKSPACE_ID)
    if (!existing) await workspaces.put(DEFAULT_WORKSPACE)
  }

  // 2. Backfill unassigned records into the Default workspace.
  for (const storeName of BACKFILL_STORES) {
    if (!tx.db.objectStoreNames.contains(storeName)) continue
    let cursor = await tx.objectStore(storeName).openCursor()
    while (cursor) {
      const raw = cursor.value as unknown
      // == null catches both an absent and an explicitly-null workspaceId.
      if (isRecord(raw) && raw.workspaceId == null) {
        await cursor.update({ ...raw, workspaceId: DEFAULT_WORKSPACE_ID })
      }
      cursor = await cursor.continue()
    }
  }
}
