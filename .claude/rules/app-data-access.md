---
paths:
  - 'apps/web/src/replica/**'
  - 'apps/web/src/lib/entities/**'
  - 'apps/web/src/lib/connection/**'
  - 'apps/web/src/lib/export/**'
  - 'apps/web/src/build/**'
  - 'apps/web/src/play/**'
  - 'apps/web/src/components/shared/**'
  - 'apps/web/convex/**'
  - 'apps/web/e2e/**'
  - 'packages/game-domain/**'
---

# App data access: the replica, the sync status, Convex

Player units (pilots, mechs, crawlers, NPCs, links, patterns, tray NPCs,
encounters) live in the **replica** (`src/replica/`): rows the server sent,
kept in IndexedDB, read through hooks. Accounts, Games, invites and crew are
Convex hooks (`useQuery`; **loading is `undefined`**).

One **sync status**, `useSync()` (`syncContext.ts`): `signedOut` (read-only,
no Play), `syncing`, `live`, `offline`, plus `outdated`. Writes go
`live` (own sheets queue offline); offer edits on `canWrite`, not
`navigator.onLine` or an auth flag.

```typescript
const pilots = useUnits((s) => s.pilots) // the replica's view
await units.update('pilot', id, { hp: next }, meta) // an op, server-first
```

- Reads: `useUnits`, `usePatterns`, `useTray`, `useEncounters`, or the hooks in
  `src/lib/entities/`. Writes: their API, which sends through `outbox.ts`
  and holds the server's answer. Nothing else holds a server row.
- A unit test that writes calls `withSignedInBackend()`; seed with `adopt` or
  `useUnits.setState`. A Convex consumer's test calls `installConvexMocks()`.
- A container written twice (the row's `gameId` column and the body's) is
  written together; the column wins.
- e2e durability specs need `VITE_TEST_AUTH` and `TEST_AUTH`, else they skip.

## Do not

- Add a table to the replica without a `RECORD_KINDS` entry and an `outbox`
  send.
- Keep server rows anywhere but the replica: `src/stores/` is UI state only.
- Duplicate what Convex owns (membership, ownership, invites, proposals, crew
  vitals): check `apps/web/convex/` first.
