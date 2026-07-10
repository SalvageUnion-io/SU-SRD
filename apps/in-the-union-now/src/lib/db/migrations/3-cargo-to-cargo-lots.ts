/**
 * v3 — rewrite mech + mechPattern records from the legacy `cargo: string[]`
 * field to `cargoLots: CargoLot[]` (plan 2.1/2.3, design §2.12).
 *
 * Each legacy cargo string becomes a 1-unit SEALED unit-lot — faithful to how
 * legacy entries were counted (1 slot each, no category/TL metadata existed).
 *
 * IMPORTANT: this function runs inside the versionchange transaction. Only
 * IndexedDB operations on `tx` may be awaited — awaiting anything else lets
 * the transaction auto-commit out from under the migration.
 */

import type { UpgradeTransaction } from './index'
import { normalizeLegacyCargoRecord } from '../../schemas/cargoLot'
import { STORE_NAMES } from '../stores'

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  for (const storeName of [STORE_NAMES.mechs, STORE_NAMES.mechPatterns]) {
    if (!tx.db.objectStoreNames.contains(storeName)) continue
    let cursor = await tx.objectStore(storeName).openCursor()
    while (cursor) {
      const raw = cursor.value as unknown
      if (
        typeof raw === 'object' &&
        raw !== null &&
        Array.isArray((raw as Record<string, unknown>).cargo)
      ) {
        await cursor.update(normalizeLegacyCargoRecord(raw as Record<string, unknown>))
      }
      cursor = await cursor.continue()
    }
  }
}
