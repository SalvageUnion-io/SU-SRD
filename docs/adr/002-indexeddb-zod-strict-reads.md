---
status: accepted
---

# ADR-002: IndexedDB via `idb`, Zod as the Schema Source, Strict Reads

## Status

Accepted. **Amended 2026-10-08 (#1152):** IndexedDB is a cache of Convex
([ADR-034](034-persistence-requires-account.md)), so a version change no longer migrates records — the
upgrade empties the cache and the server refills it. The migrations system the
decision below once pointed to is deleted. **Amended 2026-10-09 (#1181):**
reads are strict. The lenient salvage re-parse and the read-time legacy
normalizers are deleted: an unreadable cached row is skipped with a warning and
refilled from Convex, and the build floor reloads a tab too old to read what
the server serves.

## Context

Given the local-first decision ([ADR-001](001-local-first-no-backend.md)),
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
- Reads are **strict** (amended, #1181): an unreadable cached row is skipped
  with a warning and refilled from Convex. See `apps/itun/src/lib/db/crud.ts`.
- A schema/version change bumps `DB_VERSION` in `apps/itun/src/lib/db/index.ts`;
  the upgrade drops every store and the cache refills from Convex.
- Reusable mech templates live in their own `mechPatterns` object store rather
  than as a boolean flag on mech records, so they can list and evolve
  independently (`apps/itun/src/lib/schemas/pattern.ts`).

## Consequences

- No parallel schema DSL: change a Zod schema and the DB layer follows.
- One unreadable row never bricks hydration of its store: it is skipped, not
  thrown on.
- `idb` keeps the abstraction thin — complex querying is done in memory in the
  Zustand stores ([ADR-003](003-zustand-hydration.md)), not via a query DSL.
- A tab too old to read a field a newer build wrote skips that row until the
  build floor reloads it.
