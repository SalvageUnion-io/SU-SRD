# ITUN IndexedDB Migrations

Each file in this directory handles one schema version upgrade.

## Naming convention

```
<version>-<description>.ts
```

Example: `2-add-cargo-index.ts`

## How to write a migration

Export a single function `migrate(db: IDBPDatabase, tx: IDBPTransaction)` that
applies the upgrade for its version:

```typescript
import type { IDBPDatabase, IDBPTransaction } from 'idb'

export function migrate(db: IDBPDatabase, tx: IDBPTransaction): void {
  db.createObjectStore('newStore', { keyPath: 'id' })
}
```

Then call it from the `upgrade` callback in `src/lib/db/index.ts`:

```typescript
upgrade(db, oldVersion) {
  if (oldVersion < 2) migrate2(db, tx)
}
```

## Rules

- One migration file per version. Never edit a shipped migration — add a new one.
- Migrations are additive. Do not delete object stores unless you are certain
  all users have migrated (check `oldVersion`).
- The current floor is **v1** (pilots, mechs, crawlers, workspaces, softLinks).
