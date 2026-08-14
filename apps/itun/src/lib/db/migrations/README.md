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
