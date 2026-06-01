# Ontology updates — itun-revamp-wave-2

## Proposed terms

- **entityStore** — Zustand store wrapping the `db/` CRUD for Pilot/Mech/Crawler/SoftLink. Holds an in-memory cache that's hydrated from IndexedDB on first use; writes go through the db wrapper (which does Zod validation) then update the in-memory state.
- **workspaceStore** — Zustand store for Workspace CRUD + entity assignment helpers. Entities carry `workspaceId?: string`; this store exposes `assign(entityId, workspaceId)` / `unassign(entityId)` / `listForWorkspace(workspaceId)` / `listUnassigned()`.
- **App shell** — The static HTML/JS/CSS bundle the SW caches at install time. Loading the app offline after first visit serves this cached shell; data comes from IndexedDB.

## Reused terms

(Wave 1 accreted: SoftLink, EntityRef, Soft warning — all still relevant for Wave 2 consumers)

## Notes

- Five proposed terms across Waves 0-2 now. Promote to `docs/ontology.md` during M3 launch prep (#216) once the vocabulary stabilizes.
