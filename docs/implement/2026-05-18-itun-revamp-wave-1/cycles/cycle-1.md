# Cycle 1 — IndexedDB persistence + Zod schemas (Track A)

**Branch:** `run/2026-05-18-itun-revamp-wave-1/cycle-1`
**Final SHA:** `111f63408dfb7a98513874891560de9b87124ae4`
**Date:** 2026-05-18
**ACs covered:** AC-1, AC-2, AC-3
**Issue:** #185

> Reconstructed by orchestrator from the worker completion envelope and notification details — the worker's envelope listed this path under `artifacts_written` but the file was not actually committed.

---

## Summary

Track A of Wave 1: Zod schemas for the five entity types and an IndexedDB CRUD wrapper backed by `idb`, plus 38 schema tests + 5 CRUD tests under fake-indexeddb.

Single commit on cycle-1:
- **`111f6340`** — `feat(itun): add Zod schemas and IndexedDB CRUD wrapper (Wave 1, #185)`

---

## Files touched

### Zod schemas (new)
- `apps/in-the-union-now/src/lib/schemas/entity.ts` — `EntityRefSchema` (discriminated union)
- `apps/in-the-union-now/src/lib/schemas/pilot.ts` — `PilotSchema`
- `apps/in-the-union-now/src/lib/schemas/mech.ts` — `MechSchema`
- `apps/in-the-union-now/src/lib/schemas/crawler.ts` — `CrawlerSchema`
- `apps/in-the-union-now/src/lib/schemas/workspace.ts` — `WorkspaceSchema`
- `apps/in-the-union-now/src/lib/schemas/softLink.ts` — `SoftLinkSchema`
- `apps/in-the-union-now/src/lib/schemas/index.ts` — barrel (replaced Wave 0 placeholder)

### Schema tests (new)
- `apps/in-the-union-now/src/lib/schemas/__tests__/entity.test.ts`
- `apps/in-the-union-now/src/lib/schemas/__tests__/pilot.test.ts`
- `apps/in-the-union-now/src/lib/schemas/__tests__/mech.test.ts`
- `apps/in-the-union-now/src/lib/schemas/__tests__/crawler.test.ts`
- `apps/in-the-union-now/src/lib/schemas/__tests__/workspace.test.ts`
- `apps/in-the-union-now/src/lib/schemas/__tests__/softLink.test.ts`

### IndexedDB module (new)
- `apps/in-the-union-now/src/lib/db/index.ts` — DB open + per-entity store accessors + inline ADR comment
- `apps/in-the-union-now/src/lib/db/crud.ts` — generic typed `makeStore<T>` factory
- `apps/in-the-union-now/src/lib/db/stores.ts` — store definitions (`pilots`, `mechs`, `crawlers`, `workspaces`, `softLinks` — all `id` as keyPath)
- `apps/in-the-union-now/src/lib/db/migrations/.gitkeep`
- `apps/in-the-union-now/src/lib/db/migrations/README.md` — explains where future migrations land
- `apps/in-the-union-now/src/lib/db/__tests__/crud.test.ts` — round-trip + ordering + update-merge + delete + Zod rejection

### Config + test wiring (modified)
- `apps/in-the-union-now/bunfig.toml` — added `fake-indexeddb/auto` to test preload
- `apps/in-the-union-now/package.json` — added `idb` (runtime) + `fake-indexeddb` (dev)
- `apps/in-the-union-now/test/scaffold.test.ts` — migrated from `placeholderSchema` to `PilotSchema` (the Wave 0 placeholder it imported was replaced)
- `knip.json` — added `src/lib/schemas/index.ts` + `src/lib/db/` to the new app workspace's `entry` so Wave 2/3 consumers don't trip knip's unused-export check
- `bun.lock` — refreshed

---

## AC coverage

| AC | Criteria | Evidence |
|----|----------|----------|
| AC-1 | Zod schemas for 5 entity types + EntityRef; tests reject missing required fields | 38 schema tests pass (6-7 per schema covering happy-path parse + each required-field rejection + unknown-field rejection via `.strict()`) |
| AC-2 | IndexedDB CRUD wrapper with inline ADR + migration doc | `db/index.ts` carries the ADR block (idb chosen over Dexie: ~3 KB vs ~30 KB, no opinionated query DSL, Zod owns schema so Dexie's TableSchema would duplicate). Migration strategy: `migrations/<n>-<description>.ts` per `db/migrations/README.md` |
| AC-3 | round-trip + ordering + update-merge + delete + Zod-rejection under fake-indexeddb | `db/__tests__/crud.test.ts`: 5 pilots-CRUD tests covering exactly those behaviors |

---

## Verification

- `bun --filter in-the-union-now typecheck` — passed
- `bun --filter in-the-union-now lint` — passed
- `bun --filter in-the-union-now test` — 54 passing
- `bun run check:all` — green (1690 tests total)

---

## ADR (inline)

**Chose `idb` over Dexie.**

- `idb` is a thin promise wrapper around IndexedDB (~3 KB). Dexie is ~30 KB and bundles a query DSL we don't need.
- Our access patterns are object-store CRUD; we never need Dexie's `where()` / `orderBy()` chain.
- Schema is owned by Zod (not Dexie's `TableSchema`), so giving Dexie a separate schema definition would be duplication.

**Migration strategy.** Each entity Zod schema carries `schemaVersion: 1`. Future v2 schemas land under `migrations/<n>-<description>.ts` and run on `db.upgrade()`. For now v1 is the floor.

---

## Design notes (worker)

- **`makeStore<T>` accepts a `hasUpdatedAt: boolean` flag** instead of auto-detecting from Zod schema shape. Workspace and SoftLink pass `false` (they're immutable-ish records); Pilot/Mech/Crawler pass `true`. Explicit at the call site, no coupling to Zod internals.
- **Test isolation via `_clearAllStores()`** rather than `deleteDB` from idb (which hung under fake-indexeddb v6). Faster and reliable.
- **`_resetDbSingleton()`** is test-only and intentionally NOT re-exported from the barrel. Wave 2 store tests should import it directly from `../db/index` or use `_clearAllStores()`.
