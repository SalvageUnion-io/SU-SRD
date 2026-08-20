---
paths:
  - 'apps/itun/src/**'
---

# Data access in ITUN — stores, Convex, TanStack Query

There are **two persistence domains**, and the first thing to work out before
writing a hook is which one you are in
([ADR-030](../../docs/adrs/ADR-030-accounts-games-server-of-record.md), which
supersedes ADR-001; delivery plan in
[accounts-and-games.md](../../docs/architecture/accounts-and-games.md)).

| Domain                                                                              | Path                                                | Truth                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| **Player entities** — pilots, mechs, crawlers, soft-links, patterns, encounter NPCs | Zustand stores in `src/stores/`, over `src/lib/db/` | IndexedDB in Solo; Convex once Connected (mirrored through the store) |
| **Accounts, Games, invites, ownership, proposals, crew**                            | Convex `useQuery`/`useMutation` from `convex/react` | Convex, always                                                        |

Connection mode (`solo` / `connected` / `disconnected`) is resolved in
`src/lib/connection/` — use `useConnection()` or `resolveConnectionMode()` /
`writesAllowed()`, never `navigator.onLine` or an auth flag directly.

## Player entities — go through the store, not a hook

Persistent entity state flows through the **Zustand stores**
(`src/stores/entityStore.ts`, `encounterStore.ts`, `patternStore.ts`), which
write through to IndexedDB
([ADR-002](../../docs/adrs/ADR-002-indexeddb-idb-zod.md),
[ADR-003](../../docs/adrs/ADR-003-zustand-hydration.md)).

Being signed in does **not** change that call shape. `src/stores/entityBackend.ts`
picks the backend behind the store (`selectBackend()` → `local | remote |
blocked`) and mirrors a local write to the server of record; the store's public
API, its in-memory cache, its lazy hydration and its broadcast behaviour are the
same in every mode. `blocked` means Disconnected: signed in and offline is
**read-only**, not a write queue — check `canWrite` before offering the
affordance.

```typescript
// read (synchronous after hydration)
const pilots = useEntityStore((s) => s.list('pilots'))

// write (persists, mirrors if Connected, then updates memory + broadcasts)
await useEntityStore.getState().update('pilots', id, { hp: next })
```

## Accounts / Games / ownership — Convex hooks

These surfaces (`src/components/games/`, `src/components/account/`,
`src/components/container/`) read and write the server of record directly:

```typescript
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

const members = useQuery(api.games.members, { gameId })
const claim = useMutation(api.ownership.claim)
```

Two things that bite:

- **Loading is `undefined`, not a flag.** `useQuery` returns `undefined` until
  the first result lands (`CrewVitals.tsx` is the reference handling).
- **There may be no provider.** A build with no `VITE_CONVEX_URL` (CI, a fresh
  checkout, a deliberately backend-free deploy) compiles with a null
  `convexClient`, and `AppConvexProvider` then mounts no Convex context at all —
  a supported, permanently-Solo build. So **never call a Convex hook
  unconditionally**: gate the subtree on `isConvexConfigured`
  (`src/lib/connection/convexClient.ts`), the way `AccountStrip.tsx:40` and
  `SignInControl.tsx:75` do.

## TanStack Query — mounted, currently unused

`QueryClientProvider` is mounted in `src/routes/__root.tsx` with defaults from
`src/lib/queryClient.ts`:

```typescript
queries: { staleTime: 5 min, retry: 1 }
```

As of this writing **no component calls `useQuery`/`useMutation` from
`@tanstack/react-query`** — the only two importers in `apps/itun/src` are the
client module and the root provider. Snapshot retrieval
([ADR-004](../../docs/adrs/ADR-004-snapshot-netlify-functions.md)) runs in a
TanStack Router loader instead (`src/routes/s/$id.tsx` → `retrieveSnapshot()`
from `src/lib/snapshot/client.ts`).

So Query is available for genuinely async, non-Convex, cacheable work —
snapshot publish/retrieve if you want it cached, expensive derived views you
want deduped across components — but it is not currently load-bearing anywhere.
Do not reach for it just because it is mounted.

## Do Not

- Do **not** route pilots/mechs/crawlers through TanStack Query. Read them from
  `entityStore` (synchronous after lazy hydration) and mutate via
  `entityStore.update(...)` / `create` / `delete`, which handles the Solo vs
  Connected difference for you.
- Do **not** build a local-only duplicate of something Convex already owns
  (membership, ownership, invites, proposals, crew vitals). Check
  `apps/itun/convex/` first.
- Do **not** add a store, field or flow that persists **only on a device**, even
  where the current code would let you.
  [ADR-034](../../docs/adrs/ADR-034-account-required-persistence.md) makes Convex
  the only source of truth for every persisted record; IndexedDB is a cache of
  it. A row with no Convex counterpart is invisible on the user's other devices,
  invisible to sync, and lost when browser storage clears.
  - This is a rule about **new** code. Solo mode still runs today and the phases
    that remove it have not landed — see
    [persistence-and-pwa.md](../../docs/architecture/persistence-and-pwa.md).
  - Three stores already violate it and are being repaired in P0: `mechPatterns`
    and `encounterNpcs` write locally with no mirror, and client Change Log
    appends never leave the device. **Do not copy their shape**; copy
    `entityStore`'s `mirrorWrite`.
  - If the schema cannot express where a record needs to live, **the schema
    moves**. #871 is the worked example: `crawlers` gained `ownerId` and a
    nullable `gameId` so a crawler leaving a deleted Game lands in Convex rather
    than in a browser.
- Do **not** reintroduce `fetchEntity`/`updateEntity`, hosted-DB `Tables<...>`
  types, or `isLocalId` checks — those are from the removed Postgres era and
  have nothing to do with Convex.

## If you do add a TanStack Query hook

Export a hierarchical key factory next to it:

```typescript
export const snapshotKeys = {
  all: ['snapshots'] as const,
  detail: (id: string) => [...snapshotKeys.all, id] as const,
}
```

Naming: `use*` for queries, `useUpdate*` / `useCreate*` for mutations,
`use*Keys` for the exported key factory (not a hook).

See [data-flow.md](../../docs/architecture/data-flow.md) and
[accounts-and-games.md](../../docs/architecture/accounts-and-games.md) for the
full picture, and `apps/itun/CLAUDE.md` for the mode table.
