# ADR-003: Client State via Zustand — Lazy Auto-Hydration, Write-Through, Cross-Tab Invalidation

## Status

Accepted

## Context

ITUN holds user entities in IndexedDB ([ADR-002](ADR-002-indexeddb-idb-zod.md)),
but components need synchronous, reactive access to that data — IndexedDB is
async and not reactive. With no backend ([ADR-001](ADR-001-local-first-no-backend.md)),
there is no server cache to lean on; the in-memory store _is_ the working copy.

The store must: load on demand without every caller awaiting hydration, keep the
in-memory copy and IndexedDB consistent, and stay correct when the user has the
app open in multiple tabs.

## Decision

ITUN uses **Zustand** stores (`entityStore`, `workspaceStore` in
`apps/in-the-union-now/src/stores/`) with three properties:

- **Lazy auto-hydration.** The first `list(type)` triggers hydration from
  IndexedDB; subsequent calls return synchronously from memory.
- **Write-through.** Mutations persist to IndexedDB **first**, then update
  in-memory state. The DB is authoritative; memory is the cache.
- **Cross-tab invalidation via Broadcast Channel.** A successful write publishes
  on a broadcast channel (`apps/in-the-union-now/src/lib/db/broadcast.ts`);
  other tabs invalidate their cache and re-hydrate from IndexedDB.

TanStack Query is used only for transient/derived data, **not** as the
persistence cache — persistent entity state flows through the Zustand stores.

## Consequences

- Components read entity data synchronously after first load; no per-component
  hydration boilerplate.
- Multi-tab edits stay consistent: a write in one tab is reflected in others
  without a server round-trip.
- The DB-first write order means a crash between persist and in-memory update
  leaves the durable copy correct (the next read re-hydrates).
- Querying/filtering happens in memory over hydrated collections, which is why
  the DB layer can stay a thin `idb` wrapper rather than a query engine.
- Do not route persistent entity state through TanStack Query; mixing the two
  caches reintroduces the consistency problem this decision avoids.
