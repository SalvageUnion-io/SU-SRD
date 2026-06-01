# Ontology updates — itun-revamp-wave-5

## Proposed terms

- **Sheet view** — Read-only entity rendering for at-the-table use. Renders pilot, mech, or crawler (and any combination via SoftLinks) at a parameterized route. Distinct from the builder (CREATE) and the entity detail view (small EDIT-and-link affordance) — the sheet is for PLAY.
- **Composition mode** — One of `pilot-only` | `mech-only` | `crawler-only` | `wired`. Determined at render time by the sheet view by inspecting the requested entity's SoftLinks for related entities.
- **Snapshot** — Immutable JSON capture of a build, persisted via the anonymous publishing backend. No PII. Identified by a short URL slug.
- **Snapshot backend** — Serverless storage scaffold (Netlify Functions + Blobs preferred). Exposes POST publish + GET retrieve endpoints. Rate-limited per IP. PATCH/PUT/DELETE return 405.

## Reused terms

All prior wave terms.

## Notes

- 21 proposed terms total across Waves 0-5. Promote to `docs/ontology.md` during M3 launch prep (#216) — getting close to the natural moment.
