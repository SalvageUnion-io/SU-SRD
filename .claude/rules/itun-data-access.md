---
paths:
  - 'apps/itun/src/stores/**'
  - 'apps/itun/src/hooks/**'
  - 'apps/itun/src/lib/db/**'
  - 'apps/itun/src/lib/connection/**'
  - 'apps/itun/src/lib/account/**'
  - 'apps/itun/src/lib/export/**'
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
| **Player entities** — pilots, mechs, crawlers, soft-links, patterns, encounter NPCs | Zustand stores in `src/stores/`, over `src/lib/db/` | Convex when signed in (IndexedDB is its cache); nothing when anonymous (read-only) |
| **Accounts, Games, invites, ownership, proposals, crew** | Convex `useQuery` / `useMutation` from `convex/react` | Convex, always |

Resolve the connection mode with `useConnection()` or
`resolveConnectionMode()` / `writesAllowed()` from `src/lib/connection/` —
never `navigator.onLine` or an auth flag.

## Player entities — go through the store

```typescript
// read (synchronous after lazy hydration)
const pilots = useEntityStore((s) => s.list('pilots'))
// write (server-first, then the cache; refused signed out)
await useEntityStore.getState().update('pilots', id, { hp: next })
```

The store's call shape is the same in every mode. `src/stores/entityBackend.ts`
picks the backend (`selectBackend()` → `remote | blocked | signedOut`):
`signedOut` is any anonymous visitor, in every build, and is **read-only** —
building needs an account, so its writes are refused — and reads nothing: every
store goes through `readableRows`, never IndexedDB; `blocked` is
signed-in-and-offline or mid-handshake — read-only too, not a write queue. Check
`canWrite` before offering any edit affordance. A unit test that writes runs
signed in via `withSignedInBackend()` (`src/stores/__tests__/signedInBackend.ts`).

## Accounts / Games / ownership — Convex hooks

```typescript
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

const members = useQuery(api.games.members, { gameId })
```

- **Loading is `undefined`**, not a flag (`CrewVitals.tsx` is the reference).
- **The provider is always there** (`AppConvexProvider`): every build has a
  deployment. A unit test that renders a Convex consumer mocks the hooks with
  `installConvexMocks()` (`src/components/__tests__/convexMock.ts`).

## Do not

- **Add an IndexedDB store without a Convex commit seam** —
  `apps/itun/src/lib/db/__tests__/storeSeams.test.ts` fails on one.
  [ADR-034](../../docs/ARCHITECTURE.md#adr-034) and
  [ADR-035](../../docs/ARCHITECTURE.md#adr-035) make Convex
  the only source of truth; a row with no Convex counterpart is a defect. If
  the schema cannot say where a record lives, **the schema moves** (#871:
  `crawlers` gained `ownerId` and a nullable `gameId`).
- Add a new mirrored collection by hand: copy the `commit` seam on
  `makeHydratedCollectionSlice` (`mechPatterns`, `encounterNpcs`) or
  `commitChangeLog`. The Change Log commit is the one deliberate
  fire-and-forget write; everything else awaits.
- Build a local duplicate of something Convex owns (membership, ownership,
  invites, proposals, crew vitals) — check `apps/itun/convex/` first.
- Add a query cache. TanStack Query was removed (audit AP-10); entity reads are
  the typed hooks in `src/hooks/entities/` over the stores, and Connected reads
  use `convex/react`.

Full picture: [data flow](../../docs/ARCHITECTURE.md#data-flow),
[accounts](../../docs/ARCHITECTURE.md#accounts-and-games-operations).
