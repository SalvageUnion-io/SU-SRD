---
paths:
  - 'apps/itun/src/stores/**'
  - 'apps/itun/src/hooks/**'
  - 'apps/itun/src/lib/db/**'
  - 'apps/itun/src/lib/connection/**'
  - 'apps/itun/src/lib/snapshot/**'
  - 'apps/itun/src/components/account/**'
  - 'apps/itun/src/components/container/**'
  - 'apps/itun/src/components/games/**'
  - 'apps/itun/convex/**'
---

# Data access in ITUN — stores and Convex

Two persistence domains; work out which one you are in before writing a hook.
The storage modes themselves (Solo / Connected / Disconnected) are owned by
[`apps/itun/CLAUDE.md`](../../apps/itun/CLAUDE.md).

| Domain | Path | Truth |
| --- | --- | --- |
| **Player entities** — pilots, mechs, crawlers, soft-links, patterns, encounter NPCs | Zustand stores in `src/stores/`, over `src/lib/db/` | Convex when signed in (IndexedDB is its cache); nothing when anonymous (in-memory backend) |
| **Accounts, Games, invites, ownership, proposals, crew** | Convex `useQuery` / `useMutation` from `convex/react` | Convex, always |

Resolve the connection mode with `useConnection()` or
`resolveConnectionMode()` / `writesAllowed()` from `src/lib/connection/` —
never `navigator.onLine` or an auth flag.

## Player entities — go through the store

```typescript
// read (synchronous after lazy hydration)
const pilots = useEntityStore((s) => s.list('pilots'))
// write (server-first when signed in, then memory + cross-tab broadcast)
await useEntityStore.getState().update('pilots', id, { hp: next })
```

The store's call shape is the same in every mode. `src/stores/entityBackend.ts`
picks the backend (`selectBackend()` → `remote | blocked | memory`): `memory` is
any anonymous visitor, in every build (nothing persists — there is no `local`
backend any more), `blocked` is signed-in-and-offline or mid-handshake —
**read-only**, not a write queue, so check `canWrite` before offering the
affordance. A unit test that asserts durability runs signed in via
`withSignedInBackend()` (`src/stores/__tests__/signedInBackend.ts`).

## Accounts / Games / ownership — Convex hooks

```typescript
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

const members = useQuery(api.games.members, { gameId })
```

- **Loading is `undefined`**, not a flag (`CrewVitals.tsx` is the reference).
- **There may be no provider.** A build with no `VITE_CONVEX_URL` (CI, a fresh
  checkout) mounts no Convex context, so gate the subtree on
  `isConvexConfigured` (`src/lib/connection/convexClient.ts`) as
  `AccountStrip.tsx` does — never call a Convex hook unconditionally.

## There is no TanStack Query

It was mounted in `src/routes/__root.tsx` and never called, so it was removed
(audit AP-10). Components read entities through the typed hooks in
`src/hooks/entities/` (`usePilots()`, `useMech()`, …), which are selectors over
the Zustand stores — the folder used to be called `hooks/queries`, which is
why that name still turns up in old notes. Snapshot retrieval runs in a router
loader; Connected reads use `convex/react`. Don't re-add a query cache
speculatively, and never route player entities through one.

## Do not

- **Persist anything only on a device.**
  [ADR-034](../../docs/adrs/ADR-034-account-required-persistence.md) and
  [ADR-035](../../docs/adrs/ADR-035-no-isolated-local-only-data.md) make Convex
  the only source of truth; a row with no Convex counterpart is a defect. If
  the schema cannot say where a record lives, **the schema moves** (#871:
  `crawlers` gained `ownerId` and a nullable `gameId`).
- Add a new mirrored collection by hand: copy the `commit` seam on
  `makeHydratedCollectionSlice` (`mechPatterns`, `encounterNpcs`) or
  `commitChangeLog`. The Change Log commit is the one deliberate
  fire-and-forget write; everything else awaits.
- Build a local duplicate of something Convex owns (membership, ownership,
  invites, proposals, crew vitals) — check `apps/itun/convex/` first.
- Reintroduce `fetchEntity` / `updateEntity`, `Tables<...>` or `isLocalId` —
  those are from the removed Postgres era.

Full picture: [data-flow.md](../../docs/architecture/data-flow.md),
[accounts-and-games.md](../../docs/architecture/accounts-and-games.md).
