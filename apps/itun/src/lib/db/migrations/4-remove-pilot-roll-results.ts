/**
 * v4 — drop the vestigial `rollResults` field from pilot records (plan 6.1).
 *
 * The field was always written as `[]` and never read; it has been removed
 * from the strict PilotSchema, so persisted records that still carry it must
 * be rewritten or every read would fall through to the salvage path.
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
    if (isRecord(raw) && 'rollResults' in raw) {
      await cursor.update(normalizeLegacyPilotRecord(raw))
    }
    cursor = await cursor.continue()
  }
}
