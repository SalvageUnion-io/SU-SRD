import type { UpgradeTransaction } from './types'

/**
 * v13 → v14: record Starter Set provenance as `seedRef`.
 *
 * The Starter Set used to be written under the template's own fixed ids
 * (`starter-pilot-bonesaw`, …), because id equality doubled as the idempotence
 * guard — a `put` of a known id overwrites, so re-seeding could not duplicate.
 * That was fine while the ids stayed on one device and wrong once they did not:
 * a seeded row's `id` becomes its `appId` on the server of record (ADR-030), so
 * every player who seeded this roster carried the same twelve ids into a shared
 * backend — where a duplicate resolves to the oldest row, and the later
 * player's writes are refused as somebody else's entity.
 *
 * Seeding now mints a fresh UUID per row and records the template slug in
 * `seedRef`. This backfills that field for rows seeded the old way, so the
 * "is the Starter Set already here?" check — which now asks about `seedRef` —
 * still recognises an existing roster instead of laying down a second copy of
 * it beside the first.
 *
 * **Ids are deliberately not re-minted.** A row that has already been claimed
 * exists on the server under its old `appId`; changing it here would strand
 * that row and mirror the entity again as a new one, turning a collision that
 * is now merely declined into duplicated data. The colliding ids that already
 * exist are handled where the collision happens — the claim declines them, and
 * `convex/maintenance.ts` repairs any duplicate already written.
 *
 * Values are inlined rather than imported: migrations may only await IndexedDB
 * operations, since a module import can let the versionchange transaction
 * commit mid-run (see this directory's README).
 */

/** Inlined from lib/starterSet/starterSet.ts — see the note above on imports. */
const STARTER_IDS: Record<string, readonly string[]> = {
  pilots: [
    'starter-pilot-bonesaw',
    'starter-pilot-pickle',
    'starter-pilot-judge',
    'starter-pilot-driftwood',
    'starter-pilot-hotdog',
    'starter-pilot-razor',
  ],
  mechs: [
    'starter-mech-scrapper',
    'starter-mech-spectrum',
    'starter-mech-mule',
    'starter-mech-bobcat',
    'starter-mech-mazona',
    'starter-mech-thresher',
  ],
  crawlers: ['starter-crawler-tenacity'],
}

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  for (const [store, ids] of Object.entries(STARTER_IDS)) {
    let cursor = await tx.objectStore(store).openCursor()
    while (cursor) {
      const row = cursor.value as { id?: unknown; seedRef?: unknown }

      // Idempotent, and narrow: only a row still sitting under a known template
      // id is stamped. A row the user built themselves that happens to be here
      // is untouched, and a row already carrying a `seedRef` keeps it.
      if (row.seedRef === undefined && typeof row.id === 'string' && ids.includes(row.id)) {
        await cursor.update({ ...row, seedRef: row.id })
      }

      cursor = await cursor.continue()
    }
  }
}
