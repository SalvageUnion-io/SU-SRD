---
status: superseded-in-part
supersededBy: [34, 30]
---

# ADR-003: Client State via Zustand — Lazy Auto-Hydration, Write-Through, Cross-Tab via Convex

## Status

**Superseded by [ADR-034](034-persistence-requires-account.md) and [ADR-030](030-accounts-games-server-of-record.md)**, except the
lazy-hydration rule. IndexedDB is a cache of Convex: a write commits to the
server first and reaches the cache only once the server accepts it, and tabs
stay in step through their own Convex subscriptions
([Zustand stores](../ARCHITECTURE.md#zustand-stores)). What stands: the Zustand stores in
`apps/itun/src/stores/` hydrate a collection from the cache on its first
`list(type)` and answer synchronously from memory after that, so no caller
awaits hydration, and filtering happens in memory, which keeps the DB layer a
thin `idb` wrapper.

Full text: `git show c2476d1c:docs/adrs/ADR-003-zustand-hydration.md`
