# Data Flow Architecture

Two data domains meet at render time: **static reference data** (game rules from
`salvageunion-reference`) and **dynamic player data**. The ITUN app is
**local-first** — player records live in the browser's IndexedDB, never on a
server — and hydrates those records by resolving schema references against the
bundled game data.

> **Architecture note (local-first rebuild):** ITUN previously used a hosted
> Postgres backend with auth and realtime sync. That was removed
> in favour of a local-first IndexedDB model with no auth and no backend. The
> only server-side surface that remains is the stateless snapshot-sharing
> service (Netlify Functions + Blobs); see
> [ADR-010](../adrs/ADR-010-snapshot-backend.md). This document describes the
> current local-first design.

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

## Dynamic Player Data (IndexedDB, local-first)

**Location:** `apps/in-the-union-now/src/lib/db/`

Player data is persisted to a single IndexedDB database via the [`idb`](https://github.com/jakearchibald/idb)
wrapper (chosen over Dexie for size + Zod-as-schema-of-record — see the ADR
comment at the top of `src/lib/db/index.ts`).

- **Database:** `itun-v1`, current `DB_VERSION = 4`.
- **Object stores** (all keyed on `id`):

  | Store          | Holds                                                             |
  | -------------- | ----------------------------------------------------------------- |
  | `pilots`       | Player pilots (callsign, class ref, HP/AP/TP, embedded choices)   |
  | `mechs`        | Player mechs (chassis ref, pattern, current HP/SP, pattern items) |
  | `crawlers`     | Player crawler instances (crawler ref, tech level, bays, scrap)   |
  | `mechPatterns` | Saved mech builds (immutable after creation)                      |
  | `workspaces`   | Grouping container for a player's entities                        |
  | `softLinks`    | Typed relationships between pilots/mechs/crawlers                 |

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
- **`hasUpdatedAt`:** Pilot/Mech/Crawler stamp `updatedAt` on write; Workspace,
  SoftLink, and MechPattern carry `createdAt` only.

### Migrations (`src/lib/db/migrations/`)

- Object-store **creation** lives in the `openDB` `upgrade` callback (v1 created
  the core stores; v2 added `mechPatterns`).
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

## State Management (Zustand, write-through)

**Location:** `apps/in-the-union-now/src/stores/`

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
- **`workspaceStore`** — the active workspace and workspace membership.

Writes also call `recordDataWrite()` (`lib/backupNudge`), which periodically
nudges the user to export a backup — the local-first analogue of durability.

---

## TanStack Query

**File:** `apps/in-the-union-now/src/lib/queryClient.ts`

TanStack Query coordinates async/derived data (e.g. snapshot retrieval, derived
sheet views). Default options:

```typescript
queries:   { staleTime: 5 min, gcTime: 10 min, retry: 1, refetchOnWindowFocus: false }
mutations: { retry: 0 }
```

Persistent entity state lives in Zustand/IndexedDB, not in the Query cache.

---

## Snapshot Sharing (the only backend)

Read-only share links are the one server-touching feature. See
[ADR-010](../adrs/ADR-010-snapshot-backend.md).

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
    └──►  recordDataWrite(): maybe show backup nudge

Reference data (class, abilities, traits) is resolved synchronously in a
useMemo via SalvageUnionReference.get(...) using the slug refs on the record.
```

**Error path:** a failed IndexedDB write rejects out of `entityStore.update`;
in-memory state is not mutated and the caller surfaces a toast.

---

## Cross-References

- `.claude/rules/tanstack-query-hooks.md` — Query key factory conventions, hook patterns
- `.claude/rules/entity-data-resolution.md` — Resolving player refs against reference data
- [ADR-010](../adrs/ADR-010-snapshot-backend.md) — Snapshot backend rationale
