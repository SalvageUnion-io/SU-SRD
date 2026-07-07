/**
 * v7 — seed the built-in "Starter Set" workspace (the *Reclamation of the
 * Wastes* pre-generated roster: 6 pilots, their 6 mechs, Crawler #430
 * 'Tenacity' + crew, and the SoftLinks wiring them together).
 *
 * Why a migration (not a runtime bootstrap):
 *   - It runs EXACTLY ONCE per client on the ≤6 → 7 upgrade — for a fresh
 *     install (oldVersion 0) and for every existing player alike, so "every
 *     ITUN has the Starter Set" holds. A same-version re-open never re-runs it,
 *     so a row the user deletes is NOT resurrected. If the user clears all site
 *     data, the DB re-creates from 0 and re-seeds — the intended reset.
 *
 * The seed rows are FULLY STATIC (see lib/starterSet/starterSet.ts): hard-coded
 * reference slugs/ids and a fixed timestamp. This is load-bearing — a migration
 * may only await IndexedDB operations on `tx`; awaiting reference-data reads (or
 * anything non-IDB) lets the versionchange transaction auto-commit mid-write.
 *
 * Each row is written only if its deterministic id is not already present, so a
 * player who has already customised or deleted a seeded row is never clobbered.
 *
 * IMPORTANT: upgrade-path writes bypass crud.ts's Zod parse. The seed test
 * (lib/starterSet/__tests__/starterSet.test.ts) strict-parses every row against
 * its schema so an invalid row fails CI rather than silently landing on disk.
 */

import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
  STARTER_WORKSPACE,
} from '../../starterSet/starterSet'
import { STORE_NAMES } from '../stores'
import type { UpgradeTransaction } from './index'

/** Put each row into `storeName` if its id is not already present. */
async function seedRows(
  tx: UpgradeTransaction,
  storeName: string,
  rows: ReadonlyArray<{ id: string }>
): Promise<void> {
  if (!tx.db.objectStoreNames.contains(storeName)) return
  const store = tx.objectStore(storeName)
  for (const row of rows) {
    const existing = await store.get(row.id)
    if (existing === undefined) await store.put(row)
  }
}

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  await seedRows(tx, STORE_NAMES.workspaces, [STARTER_WORKSPACE])
  await seedRows(tx, STORE_NAMES.pilots, STARTER_PILOTS)
  await seedRows(tx, STORE_NAMES.mechs, STARTER_MECHS)
  await seedRows(tx, STORE_NAMES.crawlers, STARTER_CRAWLERS)
  await seedRows(tx, STORE_NAMES.softLinks, STARTER_SOFT_LINKS)
}
