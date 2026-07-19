# ADR-002: IndexedDB via `idb`, Zod as the Schema Source, Salvage-Read Resilience

## Status

Accepted

## Context

Given the local-first decision ([ADR-001](ADR-001-local-first-no-backend.md)),
ITUN needs durable in-browser storage for pilots, mechs, crawlers, workspaces,
soft-links, and mech patterns. The options were a higher-level wrapper (Dexie),
raw IndexedDB, or a thin promise wrapper.

Two forces shaped the choice:

1. **One source of truth for shape.** ITUN already validates entities with Zod
   schemas (`apps/itun/src/lib/schemas/`). A second schema language
   (e.g. Dexie's index DSL describing the same entities) would be a parallel
   definition to keep in sync.
2. **PWA version skew.** Because ITUN is an auto-updating PWA, a tab can be
   running an older bundle than the data on disk was written by (or vice versa).
   A strict read that throws on an unexpected field would corrupt the user's
   experience after a deploy.

## Decision

- Persist via **`idb`** (v8), a thin promise wrapper over native IndexedDB — not
  Dexie. Object stores are declared in `apps/itun/src/lib/db/`.
- **Zod schemas are the single source of truth** for entity shape. The DB layer
  parses on read/write rather than maintaining a separate storage schema.
- Reads are **salvage-tolerant**: a strict parse is attempted first; on failure
  the row is re-parsed with a lenient "salvage" schema (`.strip()`) and a
  warning is logged. The row heals on its next write (re-parsed strictly). See
  `apps/itun/src/lib/db/crud.ts`.
- Schema/version changes go through the migrations system documented in
  `apps/itun/src/lib/db/migrations/README.md`.
- Reusable mech templates live in their own `mechPatterns` object store rather
  than as a boolean flag on mech records, so they can list and evolve
  independently (`apps/itun/src/lib/schemas/pattern.ts`).

## Consequences

- No parallel schema DSL: change a Zod schema and the DB layer follows.
- The app survives version skew across PWA updates instead of hard-failing on
  unknown/missing fields; unknown references (e.g. a `workspaceId` from a newer
  build) degrade gracefully (treated as unassigned).
- `idb` keeps the abstraction thin — complex querying is done in memory in the
  Zustand stores ([ADR-003](ADR-003-zustand-hydration.md)), not via a query DSL.
- Salvage-on-read can silently strip data a tab is too old to understand;
  warnings are logged, and writes from the newer build restore strict validity.
