# Data Flow Architecture

Two data domains meet at render time: **static reference data** (game rules from
`salvageunion-reference`) and **dynamic player data**. Player records hydrate by
resolving slug references against the bundled game data, whichever persistence
domain they came out of.

Player data has **two persistence domains**, chosen by connection mode
([ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md), which supersedes
[ADR-001](../adrs/ADR-001-local-first-no-backend.md)):

| Mode             | Who                | Truth     | Reads                 | Writes      |
| ---------------- | ------------------ | --------- | --------------------- | ----------- |
| **Solo**         | not signed in      | IndexedDB | local                 | local       |
| **Connected**    | signed in, online  | Convex    | reactive subscription | to Convex   |
| **Disconnected** | signed in, offline | Convex    | local cache           | **blocked** |

**Solo is not Disconnected.** Anonymous play is first-class and permanent: a
build with no `VITE_CONVEX_URL` compiled in (CI, a fresh checkout, a deliberately
backend-free deploy) is permanently Solo, and no Solo write is ever refused. A
signed-in user who loses connectivity goes **read-only** rather than falling back
to IndexedDB — falling back would fork their data against the server of record
and reintroduce the conflict resolution that choosing a server of record exists
to avoid.

The mode is resolved by one pure function, `resolveConnectionMode()` in
`apps/itun/src/lib/connection/connectionMode.ts` — never by reading
`navigator.onLine` or an auth flag directly.

> **Architecture note (history):** ITUN previously used a hosted Postgres backend
> with auth and realtime sync; that was removed in favour of a local-first
> IndexedDB model with no auth and no backend (ADR-001), and the only server-side
> surface for a while was the stateless snapshot-sharing service (Netlify
> Functions + Blobs, [ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md)).
> ADR-030 then reintroduced a server of record — **Convex**, for accounts, Games,
> and entity ownership — without displacing Solo. Snapshot sharing is unchanged
> and remains the account-free way to share a build.

## Static Reference Data

**Package:** `packages/salvageunion-reference/`

### How It Works

Game data ships as JSON and is loaded via `preload()` (dynamic `import()`, so
the corpus can be code-split). Zod schemas validate data at model construction.
Each entity type gets a `BaseModel<T>` with O(1) ID lookups via an internal
`Map`. See [package-contracts.md](package-contracts.md) for the `preload()` API
and the module-scope-call hazard.

### Access Patterns

```typescript
import { SalvageUnionReference } from 'salvageunion-reference'

await SalvageUnionReference.preload('all') // load before access

SalvageUnionReference.Chassis.getById('iron-mongrel') // O(1) lookup
SalvageUnionReference.get('chassis', 'iron-mongrel') // by schema name + ID
SalvageUnionReference.getByRef('chassis::iron-mongrel') // by reference string
SalvageUnionReference.search({ query: 'laser', limit: 10 }) // in-memory search
```

ITUN preloads the full dataset once at the root via `GameDataReady`
(`src/components/shared/GameDataReady.tsx`) so every route can render any
cross-referenced entity without per-route preload lists.

---

## Dynamic Player Data (IndexedDB — Solo truth, Connected cache)

**Location:** `apps/itun/src/lib/db/`

Player data is persisted to a single IndexedDB database via the [`idb`](https://github.com/jakearchibald/idb)
wrapper (chosen over Dexie for size + Zod-as-schema-of-record — see the ADR
comment at the top of `src/lib/db/index.ts`).

- **Database:** `itun-v1`, current `DB_VERSION = 13`
  (`src/lib/db/index.ts`).
- **Object stores** (`src/lib/db/stores.ts` — the entity stores are keyed on
  `id`; `changeLog` is the one exception):

  | Store           | Key                 | Holds                                                                                                                                                |
  | --------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pilots`        | `id`                | Player pilots (callsign, class ref, HP/AP/TP, embedded choices)                                                                                      |
  | `mechs`         | `id`                | Player mechs (chassis ref, pattern, current HP/SP, pattern items)                                                                                    |
  | `crawlers`      | `id`                | Player crawler instances (crawler ref, tech level, bays, scrap)                                                                                      |
  | `mechPatterns`  | `id`                | Saved mech builds (immutable after creation)                                                                                                         |
  | `encounterNpcs` | `id`                | Mediator encounter-tray NPC instances                                                                                                                |
  | `softLinks`     | `id`                | Typed relationships between pilots/mechs/crawlers                                                                                                    |
  | `changeLog`     | autoIncrement `seq` | Append-only per-entity provenance ([ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md)); `by-entity` index; append/list only, no CRUD surface |
  | `workspaces`    | `id`                | **Retired** (ADR-030 §2) — kept so migrations v10/v13 still run                                                                                      |

Player records store **slug references** into reference entities (e.g.
`class_ref: 'hybrid-wolf'`), never copies of game data — the same
reference-by-slug pattern the dataset uses internally. There is no `entity_refs`
bridge table and no Postgres; references are plain fields on the record,
resolved against `SalvageUnionReference` at render time.

### CRUD layer (`src/lib/db/crud.ts`)

`makeStore(getDb, schema, storeName, opts)` builds a typed per-store accessor.
Key behaviours:

- **Validation on write:** records are parsed against their Zod schema before
  persisting.
- **Salvage path on read:** reads use `schema.strip()` so a drifted record
  (e.g. after a PWA auto-update version skew) has unknown fields stripped with a
  console warning instead of bricking hydration.
- **`hasUpdatedAt`:** Pilot/Mech/Crawler stamp `updatedAt` on write;
  SoftLink, and MechPattern carry `createdAt` only.

### Migrations (`src/lib/db/migrations/`)

- Object-store **creation** lives in the `openDB` `upgrade` callback (v1 created
  the core stores; v2 added `mechPatterns`; v5 added `encounterNpcs`; v9 added
  `changeLog` + its `by-entity` index).
- Record **rewrites** are one file per version under `migrations/`, registered
  in `migrations/index.ts` and run by `runMigrations()` inside the
  `versionchange` transaction.
- **Atomicity:** if any migration throws, the upgrade transaction is aborted —
  rolling back the version bump and rejecting the open, so callers never receive
  a half-migrated database.

### Referential integrity

`deleteEntityWithSoftLinks()` removes an entity and every SoftLink referencing
it (`from.id`/`to.id`) in a single readwrite transaction spanning both stores —
either all are removed together, or nothing changes (no orphaned links).

---

## Server of Record (Convex — accounts, Games, ownership)

**Location:** `apps/itun/convex/` (schema + 17 function modules) and
`apps/itun/src/lib/connection/` (client wiring).

For the delivery phases, permission rules, and the Convex/Netlify/Discord
operational reference, read
[accounts-and-games.md](accounts-and-games.md) — this section covers only how
the data reaches the client. Do not duplicate that document here.

### What lives server-side

`convex/schema.ts` defines the tables that only make sense across users:
`@convex-dev/auth`'s auth tables plus an extended `users` row (display name,
avatar), `games`, `memberships`, invites, proposals, downtime, and the entity
rows themselves. Ownership and scoping are the columns Convex indexes:

- **Two containers, not one.** An entity lives in a shared `games` row **or** on
  its owner's personal Shelf. `gameId` is nullable and `null` **means** Shelf.
- **Ownership is nullable.** A `null` `ownerId` is an _unclaimed_ entity — a
  normal state (a player left, the Mediator pre-built a character, a Game
  template). `gameId == null && ownerId == null` is the one invalid combination
  and is unreachable through any mutation.

### Why entity bodies are opaque

Convex validates and indexes what it needs to **query** — ownership, scoping,
timestamps — and stores the entity body as `v.any()`. The Zod schemas in
`apps/itun/src/lib/schemas/` stay the single source of truth for entity shape,
exactly as `SnapshotStorage` already treats snapshot payloads. The trade is
real: Convex cannot reject a malformed body on write, so **every mutation must
parse with the Zod schema before persisting**. This is a documented decision —
see the header comment in `convex/schema.ts`.

### Where the two domains meet

`entityStore` reaches persistence through one indirection, `dbStoreFor(type)`,
so the backend swaps without rewriting the store. `src/stores/entityBackend.ts`
picks it:

- `selectBackend()` returns `'local'` unless the app is genuinely Connected —
  not signed in, no Convex URL compiled in, or offline all resolve away from
  `'remote'`. The ordering is deliberate: the worst outcome in this migration is
  a Solo user's writes silently going nowhere.
- Disconnected returns `'blocked'` and throws `WritesBlockedOffline`; it never
  falls back to local. Surfaces check `canWrite` before offering the affordance.
- In `'remote'`, `mirrorWrite()` mirrors the local write to Convex **addressed
  by app id**, not by Convex's own `_id` (an indexed `appId` column stands in for
  a mapping table). It is an **upsert** — an entity built while Solo has no
  server row until the account is claimed — and **fire-and-forget**: the local
  write already succeeded and is what the UI reads, so a mirror failure warns
  rather than rolling back.

Reactive reads use `convex/react` (`useQuery`) directly in the Connected
surfaces (`src/components/games/`, `src/components/account/`,
`src/components/container/`), provided by `AppConvexProvider`. Those
subscriptions are the Connected-mode analogue of `entityStore`'s in-memory
cache — they are not routed through TanStack Query.

---

## State Management (Zustand, write-through)

**Location:** `apps/itun/src/stores/`

ITUN uses Zustand stores layered over the db/ CRUD layer (no React Context for
shared state):

- **`entityStore`** — pilots, mechs, crawlers, softLinks.
  - **Lazy auto-hydration:** `list(type)` hydrates that type from IndexedDB on
    first call (returning a Promise); later reads return the in-memory array
    synchronously.
  - **Write-through:** create/update/delete persist to IndexedDB _first_; only
    on success is in-memory state updated via `set()`. On failure the db error
    propagates and in-memory state is untouched.
  - **Multi-tab:** every successful write publishes the affected store via
    `lib/db/broadcast`; writes from other tabs invalidate this tab's cache so
    already-hydrated stores re-read from IndexedDB.
- **`activeContainerStore`** — the current container: a Game, or the Shelf.
  Only consulted in Connected mode; a Solo user has one unfiltered pile.

Writes also call `recordDataWrite()` (`lib/backupNudge`), which periodically
nudges the user to export a backup — the local-first analogue of durability.

---

## TanStack Query (mounted, currently unused)

**File:** `apps/itun/src/lib/queryClient.ts`

`QueryClientProvider` is mounted in `src/routes/__root.tsx` with these defaults:

```typescript
queries:   { staleTime: 5 min, gcTime: 10 min, retry: 1, refetchOnWindowFocus: false }
mutations: { retry: 0 }
```

**No component currently calls `useQuery`/`useMutation` from
`@tanstack/react-query`** — the only two importers in `apps/itun/src` are the
client module and the root provider. Snapshot retrieval runs in a TanStack
Router loader instead (`src/routes/s/$id.tsx`), and the Connected surfaces use
Convex's own `useQuery` from `convex/react`. Query is available for genuinely
async, non-Convex, cacheable work, but it is not load-bearing anywhere; don't
reach for it just because it is mounted, and never route persistent entity state
through it.

---

## Snapshot Sharing (account-free share links)

Read-only share links are the account-free server surface, unchanged by ADR-030.
See [ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md).

- **Client:** `src/lib/snapshot/client.ts` — `publishSnapshot(payload)` POSTs to
  `/api/snapshots` and returns `{ id, url }`; `retrieveSnapshot(id)` GETs
  `/api/snapshots/:id`; `probeSnapshotService()` feature-detects the backend.
- **Backend:** two Netlify Functions (`netlify/functions/snapshot-publish.ts`,
  `snapshot-retrieve.ts`) backed by **Netlify Blobs**. The store is
  unauthenticated and anonymous: no PII, a 256 KB payload cap, per-IP rate
  limiting, and crypto-random 8-char Crockford-base32 IDs.
- **Trust boundary:** retrieved payloads are re-validated with Zod
  (`safeParse`) on the client before rendering, so a tampered blob cannot inject
  unexpected shapes.

---

## Full Data Flow Trace: Editing a Pilot's HP

```
User clicks +/- on the HP stat
    │
    ▼
Component handler → entityStore.update('pilots', id, { hp: next })
    │
    ▼
db.pilots.put(record)  ──►  Zod validate ──►  IndexedDB write (itun-v1 / pilots)
    │  (on success)
    ▼
Zustand set(): in-memory pilots array updated   ──►  React re-renders
    │
    ├──►  broadcast: publishStoreChange('pilots')  ──►  other tabs re-hydrate
    ├──►  recordDataWrite(): maybe show backup nudge
    └──►  Connected only: mirrorWrite('pilot', { kind: 'upsert', appId, gameId, body })
              └──►  convex api.entities.upsertByAppId  (fire-and-forget)

Reference data (class, abilities, traits) is resolved synchronously in a
useMemo via SalvageUnionReference.get(...) using the slug refs on the record.
```

**Error path:** a failed IndexedDB write rejects out of `entityStore.update`;
in-memory state is not mutated and the caller surfaces a toast. In Disconnected
mode the write never reaches IndexedDB at all — `selectBackend()` returns
`'blocked'` and `WritesBlockedOffline` is thrown, so a signed-in offline user is
read-only rather than forking against the server of record.

---

## Cross-References

- [accounts-and-games.md](accounts-and-games.md) — ADR-030 delivery phases + the Convex/Netlify/Discord operational reference
- `.claude/rules/tanstack-query-hooks.md` — which domain a given read/write belongs to
- [ADR-002](../adrs/ADR-002-indexeddb-idb-zod.md) — IndexedDB / `idb` / Zod-as-schema persistence
- [ADR-003](../adrs/ADR-003-zustand-hydration.md) — Zustand store hydration + write-through
- [ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md) — Snapshot backend rationale
- [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md) — **governing** — accounts, Games, ownership, Convex as server of record
