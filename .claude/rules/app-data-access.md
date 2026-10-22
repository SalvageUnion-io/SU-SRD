---
paths:
  - 'apps/web/src/stores/**'
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

# App data access — modes, stores, Convex

| Mode | When | Source of truth |
| --- | --- | --- |
| **Solo** | not signed in | nothing: **read-only**, writes refused (`signedOut`); no Play |
| **Connected** | signed in, online | Convex; the stores hold its rows in memory |
| **Disconnected** | signed in, offline | read-only: what is on screen stays; no write queue |
| **Outdated** | bundle below `build.floor` | read-only until it reloads |

Resolve the mode with `useConnection()` or `resolveConnectionMode()` /
`writesAllowed()` from `src/lib/connection/`, never `navigator.onLine` or an
auth flag. Two persistence domains:

| Domain | Path | Truth |
| --- | --- | --- |
| **Player entities**: pilots, mechs, crawlers, NPCs, soft links, patterns, encounter NPCs | Zustand stores in `src/stores/`, in memory | Convex when signed in; nothing signed out |
| **Accounts, Games, invites, ownership, proposals, crew** | `useQuery` / `useMutation` from `convex/react` | Convex, always |

## Player entities go through the store

```typescript
const pilots = useEntityStore((s) => s.list('pilots')) // sync; rows arrive via ShelfSync
await useEntityStore.getState().update('pilots', id, { hp: next }) // server-first
```

- `selectBackend()` is `signedOut | remote | blocked`; check `canWrite` before
  offering an edit. A unit test that writes calls `withSignedInBackend()`.
- **Device copy:** only `stores/deviceCopy.ts` (ADR-053) and `accountHint`
  keep player data on the device.
- A container written twice (the row's `gameId` column and the body's) is
  written together; the column wins.
- e2e durability specs need `VITE_TEST_AUTH` and `TEST_AUTH`, else they skip.

## Accounts, Games, ownership: Convex hooks

`useQuery(api.games.members, { gameId })`; **loading is `undefined`**, not a
flag. A unit test rendering a Convex consumer calls `installConvexMocks()`
(`src/components/__tests__/convexMock.ts`).

## Do not

- Add a record kind without a Convex table and commit seam
  (`containerParity.test.ts` fails); if the schema cannot say where a record
  lives, the schema moves.
- Add a Convex-backed collection by hand: copy the `commit` seam of
  `makeHydratedCollectionSlice` (`mechPatterns`, `encounterNpcs`).
- Duplicate what Convex owns (membership, ownership, invites, proposals, crew
  vitals): check `apps/web/convex/` first.
- Add a query cache: entity reads are the hooks in `src/lib/entities/`.
