---
paths:
  - 'apps/web/src/stores/**'
  - 'apps/web/src/hooks/**'
  - 'apps/web/src/lib/connection/**'
  - 'apps/web/src/lib/export/**'
  - 'apps/web/src/components/{account,entityContainer,crawler,dashboard,export,games,mech,mediator,npc,roster,shared,sharing,sheet,shelves,starterSet,wiring,wizard}/**'
  - 'apps/web/convex/**'
  - 'apps/web/e2e/cantina/**'
  - 'packages/cantina-domain/**'
---

# Cantina data access — modes, stores, Convex

Why: [ADR-030, 034, 035](../../docs/ARCHITECTURE.md#decisions).

| Mode | When | Source of truth |
| --- | --- | --- |
| **Solo** | not signed in, in **every** build | nothing: **read-only** — writes refused (`signedOut`); no Dashboard |
| **Connected** | signed in, online | Convex; the stores hold its rows in memory |
| **Disconnected** | signed in, offline | read-only: what is on screen stays; not a write queue |
| **Outdated** | bundle below `build.floor` | read-only until it reloads |

Resolve the mode with `useConnection()` or `resolveConnectionMode()` /
`writesAllowed()` from `src/lib/connection/` — never `navigator.onLine` or an
auth flag. Two persistence domains; know which you are in before writing a hook:

| Domain | Path | Truth |
| --- | --- | --- |
| **Player entities** — pilots, mechs, crawlers, built NPCs, soft-links, patterns, encounter NPCs | Zustand stores in `src/stores/`, in memory | Convex when signed in; nothing signed out |
| **Accounts, Games, invites, ownership, proposals, crew** | `useQuery` / `useMutation` from `convex/react` | Convex, always |

## Player entities — go through the store

```typescript
const pilots = useEntityStore((s) => s.list('pilots')) // sync; rows arrive via ShelfSync
await useEntityStore.getState().update('pilots', id, { hp: next }) // server-first
```

- **There is no anonymous backend.** `selectBackend()` (`src/stores/entityBackend.ts`)
  is `signedOut | remote | blocked`. `signedOut` holds nothing and refuses
  writes; `blocked` is offline, mid-handshake or Outdated, read-only too.
  Check `canWrite` before offering an edit. A unit test that writes calls
  `withSignedInBackend()` (`src/stores/__tests__/signedInBackend.ts`).
- **[No device cache](../../docs/ARCHITECTURE.md#no-device-cache).** Nothing player-owned goes in IndexedDB or
  `localStorage` but `accountHint` and the active container's id
  (a preference). `AccountReconciler` (root) mounts `ShelfSync` while
  Connected; `hydrate()` waits for its first answer (`src/stores/rowArrival.ts`),
  and a tab's rows go when its session ends (`src/stores/sessionRows.ts`).
- **A container written twice is written together** — the row's `gameId`
  column and the body's `gameId`; where they disagree, the column wins.
- **e2e durability specs need an account** (`e2e/cantina/fixtures.ts`): without
  `VITE_TEST_AUTH` and `CANTINA_TEST_AUTH` they SKIP (nightly runs them).

## Accounts / Games / ownership — Convex hooks

`useQuery(api.games.members, { gameId })`. **Loading is `undefined`**, not a
flag (`DowntimeTrack.tsx`). The provider (`AppConvexProvider`) is always there;
a unit test rendering a Convex consumer mocks the hooks with
`installConvexMocks()` (`src/components/__tests__/convexMock.ts`).

## Do not

- **Add a record kind without a Convex table and commit seam** —
  `apps/web/test/convex/__tests__/containerParity.test.ts` fails on one. A row with
  no Convex counterpart is a defect; if the schema cannot say where a record
  lives, **the schema moves**.
- Add a Convex-backed collection by hand: copy the `commit` seam on
  `makeHydratedCollectionSlice` (`mechPatterns`, `encounterNpcs`) or
  `commitChangeLog` — the one deliberate fire-and-forget write.
- Duplicate locally what Convex owns (membership, ownership, invites,
  proposals, crew vitals) — check `apps/web/convex/` first.
- Add a query cache: entity reads are the hooks in `src/hooks/entities/`.

More: [data flow](../../docs/ARCHITECTURE.md#data-flow),
[accounts](../../docs/ARCHITECTURE.md#convex).
