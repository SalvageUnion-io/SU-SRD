# Ontology updates — itun-revamp-wave-1

## Proposed terms

- **SoftLink** — Non-cascading relationship between two entities (mech→pilot, pilot→crawler) stored as a separate IndexedDB record. Distinct from a foreign-key cascade: deleting one endpoint removes the link but never the other endpoint.
- **EntityRef** — Discriminated union `{ type: 'pilot' | 'mech' | 'crawler', id: string }` used by SoftLinks and by sheet stand-ins (e.g. "No pilot assigned" rendering).
- **Soft warning** — A non-blocking rule violation surfaced at save time. The user can dismiss and proceed (via "Save anyway") or fix it (via "Fix it"). Contrast with a hard validation error which prevents save.
- **Workspace** — A user-named grouping of entities. Builds without a workspace appear in a global "All Builds" pool. (Implemented in #209 / Wave 4; the schema lands now in Wave 1 to make the data layer complete.)

## Reused terms

(none — `docs/ontology.md` does not yet exist for this monorepo)

## Notes

- These terms are accreted from Wave 0's ontology file. Promote to a real `docs/ontology.md` during M3 launch prep (#216 / first-build timing study is a good triggering moment).
