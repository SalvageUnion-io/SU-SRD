import type { UpgradeTransaction } from './index'

/**
 * v12 → v13: give every entity an explicit container (ADR-030 §2).
 *
 * Before this, an entity's home was `workspaceId`, and the built-in Default
 * workspace was a real row every unassigned build was backfilled into (v10).
 * ADR-030 splits that into two containers — a shared **Game** or the owner's
 * personal **Shelf** — encoded as one nullable `gameId`.
 *
 * The mapping:
 *
 *   workspaceId === DEFAULT_WORKSPACE_ID  →  gameId: null   (the shelf)
 *   workspaceId === <anything else>       →  gameId: <that> (a game)
 *   workspaceId absent                    →  gameId: null   (the shelf)
 *
 * The Default workspace becoming the shelf is the substantive claim here, and
 * it is a restoration rather than a reinterpretation: the Default workspace was
 * never a campaign. It existed because the app required *some* container and
 * these builds belonged to no particular one — which is exactly what a shelf
 * is. Mapping it to a Game would invent a campaign nobody ran.
 *
 * `workspaceId` is **not** stripped. The entity schemas are `.strict()`, so a
 * record written by this migration still has to parse on a build that predates
 * it; removing the key is a separate, irreversible follow-up. The constant is
 * inlined rather than imported because migrations may only await IndexedDB
 * operations — a module import could let the versionchange transaction commit
 * mid-run (see this directory's README).
 */

/** Inlined from lib/defaultWorkspace.ts — see the note above on imports. */
const DEFAULT_WORKSPACE_ID = 'default-workspace'

const STORES = ['pilots', 'mechs', 'crawlers'] as const

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  for (const store of STORES) {
    let cursor = await tx.objectStore(store).openCursor()
    while (cursor) {
      const row = cursor.value as { workspaceId?: unknown; gameId?: unknown }

      // Idempotent: a row that already has a decision keeps it. Re-running must
      // never move an entity that has since been placed deliberately.
      if (row.gameId === undefined) {
        const workspaceId = typeof row.workspaceId === 'string' ? row.workspaceId : undefined
        const gameId =
          workspaceId === undefined || workspaceId === DEFAULT_WORKSPACE_ID ? null : workspaceId
        await cursor.update({ ...row, gameId })
      }

      cursor = await cursor.continue()
    }
  }
}
