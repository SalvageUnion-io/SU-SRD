# ITUN IndexedDB Migrations

Each file in this directory handles one schema version upgrade. The registry
in `index.ts` (`MIGRATIONS`) runs them, in order, from the idb `upgrade`
callback in `../index.ts`.

## Naming convention

```
<version>-<description>.ts
```

Example: `3-cargo-to-cargo-lots.ts`

## How to write a migration

1. Bump `DB_VERSION` in `src/lib/db/index.ts`.
2. Create `<version>-<description>.ts` exporting a `migrate` function that
   performs the record rewrites for that version:

   ```typescript
   import type { UpgradeTransaction } from './types'

   export async function migrate(tx: UpgradeTransaction): Promise<void> {
     let cursor = await tx.objectStore('mechs').openCursor()
     while (cursor) {
       // rewrite cursor.value …
       await cursor.update(rewritten)
       cursor = await cursor.continue()
     }
   }
   ```

3. Register it in `MIGRATIONS` in `index.ts` with its `toVersion`.
4. Add a fixture test in `__tests__/` proving an old-version database loads
   through the new migration (see the v2 → v3 cargo test).

## Rules

- **Object-store creation stays in the `upgrade` callback** in
  `../index.ts` — stores must exist before record rewrites run. Migrations
  here are record rewrites only.
- **Only await IndexedDB operations on the provided transaction.** Awaiting
  anything else (fetch, dynamic import, reference-data loading) lets the
  versionchange transaction auto-commit mid-migration.
- One migration file per version. Never edit a shipped migration — add a new
  one.
- Purely additive-optional schema fields need NO migration — strict Zod
  parsing tolerates missing optional keys, and the read salvage path
  (crud.ts) covers drifted records. Migrations are for shape CHANGES
  (renames, restructures) — e.g. v3's `cargo: string[]` → `cargoLots`.
- The current floor is **v1** (pilots, mechs, crawlers, workspaces,
  softLinks); v2 added `mechPatterns`; v3 rewrote cargo → cargoLots.

## Retiring v3–v12 (audit AP-19) — measure first

Ten record rewrites (v3–v15) run from `runMigrations`, and the v3–v12 half
exists only for a browser that last opened ITUN before the v13 container
migration. That half, plus the `workspaceId` fallbacks and `@deprecated` schema
fields that keep its output readable, is the cost of a population nobody could
measure — so it is now measured before anything is removed.

**The signal.** `../upgradeTelemetry.ts` reports one Sentry `info` event,
`itun-db: upgraded a pre-v13 database`, for every successful upgrade whose
`oldVersion` is between 1 and 12 (a fresh database is not counted, and an
upgrade whose transaction aborted is not counted). The event carries
`fromVersion`, so the tail can be read per version.

**The exit criterion.** When that event has not fired in production for a full
quarter (90 days), the tail is gone. Then, in one change:

1. Replace migrations v3–v12 with an export-only path: an `oldVersion < 13`
   open reads the old stores read-only and offers them as a download (the
   `buildLegacyExportBundle` shape) instead of rewriting them in place.
2. Delete `3-…` through `12-…` and their fixture tests; keep v13+ untouched.
3. Remove the `workspaceId` fallback in `containerOf` and the `@deprecated`
   schema fields that only a pre-v13 row could still carry.
4. Delete the telemetry itself — a signal with nothing left to decide is noise.

Do not skip step 0: remove nothing until the event has actually gone quiet. A
migration that is deleted while a browser still needs it turns that player's
roster into a parse failure.
