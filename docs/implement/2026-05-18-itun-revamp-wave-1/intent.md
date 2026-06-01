---
run_id: 2026-05-18-itun-revamp-wave-1
intent: |
  Wave 1 of the ITUN revamp: build the local-first data layer (IndexedDB
  persistence + Zod schemas for Pilot/Mech/Crawler/Workspace/SoftLink) and
  the rule-enforcement utilities (capacity, scrap, cargo, soft-warnings)
  on top of the Wave 0 scaffold. Two file-disjoint tracks ship as one PR.
acceptance_criteria:
  - id: AC-1
    text: "Zod schemas for Pilot, Mech, Crawler, Workspace, and SoftLink exist in apps/in-the-union-now/src/lib/schemas/; each exports TS types via z.infer; required-field rejection is unit-tested."
  - id: AC-2
    text: "An IndexedDB CRUD wrapper at apps/in-the-union-now/src/lib/db/ provides typed list/get/create/update/delete for all five entity types; the picked library (idb or Dexie) is documented in an inline ADR comment at the top of the wrapper; migration strategy (v1 schema committed, future-version path) is documented in the same comment."
  - id: AC-3
    text: "Round-trip + ordering + update-merge + delete + Zod-rejection unit tests run under happy-dom + fake-indexeddb and pass via bun run check:all."
  - id: AC-4
    text: "Four pure-TS rule utilities exist at apps/in-the-union-now/src/lib/rules/: capacity.ts (computeMechCapacity), scrap.ts (salvageValueFor / scrapCostFor / tierUpgradeCost), cargo.ts (computeCargoCapacity), softWarnings.ts (evaluateSoftWarnings). No React, no IndexedDB imports."
  - id: AC-5
    text: "Each rule utility has unit tests covering happy path + documented violation cases + the documented edge cases (zero items, max-capacity, mixed reference+custom for cargo). All tests pass via bun run check:all."
  - id: AC-6
    text: "bun run check:all is green at repo root after both tracks land; PR is opened against yitun-revamp (not main) referencing issues #185 + #193; trust-boundary checks (orchestrator-only files untouched; forbidden paths untouched) pass."
out_of_scope:
  - "Implementing Zustand stores on top of the IndexedDB wrapper — that's story #187 (Wave 2)."
  - "Wiring stores into UI builders — that's stories #189/#190/#191 (Wave 3)."
  - "Service worker for offline support — that's story #186 (Wave 2)."
  - "Full coverage for every rule utility beyond the four core utilities listed above — that's M4 story #225 (REQ-NF-21)."
  - "Touching shared packages (suref-react, salvageunion-reference) — preserved as-is per Wave 0."
  - "Touching apps/itun-legacy, apps/suref-web, apps/discord-bot."
proposed_ontology_terms:
  - "SoftLink — non-cascading relationship between two entities (mech→pilot, pilot→crawler) stored as a separate IndexedDB record"
  - "EntityRef — discriminated union { type: 'pilot' | 'mech' | 'crawler', id: string } used by SoftLinks and stand-ins"
  - "Soft warning — a non-blocking rule violation surfaced at save time; user can dismiss and proceed"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 1 of ITUN revamp (#185 + #193)"
---

# Intent — itun-revamp-wave-1

## Statement

Wave 1 of the ITUN revamp: build the local-first data layer (IndexedDB
persistence + Zod schemas for Pilot, Mech, Crawler, Workspace, SoftLink)
and the rule-enforcement utilities (capacity, scrap, cargo, soft-warnings)
on top of the Wave 0 scaffold. Two file-disjoint tracks ship as one PR.

## Acceptance Criteria

- **AC-1**: Zod schemas for Pilot, Mech, Crawler, Workspace, and SoftLink
  exist in `apps/in-the-union-now/src/lib/schemas/`; each exports TS types
  via `z.infer`; required-field rejection is unit-tested.
- **AC-2**: An IndexedDB CRUD wrapper at `apps/in-the-union-now/src/lib/db/`
  provides typed `list / get / create / update / delete` for all five entity
  types; the picked library (idb or Dexie) is documented in an inline ADR
  comment at the top of the wrapper; migration strategy (v1 schema committed,
  future-version path) is documented in the same comment.
- **AC-3**: Round-trip + ordering + update-merge + delete + Zod-rejection
  unit tests run under happy-dom + fake-indexeddb and pass via
  `bun run check:all`.
- **AC-4**: Four pure-TS rule utilities exist at
  `apps/in-the-union-now/src/lib/rules/`:
  - `capacity.ts` — `computeMechCapacity`
  - `scrap.ts` — `salvageValueFor`, `scrapCostFor`, `tierUpgradeCost`
  - `cargo.ts` — `computeCargoCapacity`
  - `softWarnings.ts` — `evaluateSoftWarnings`
  No React, no IndexedDB imports.
- **AC-5**: Each rule utility has unit tests covering happy path +
  documented violation cases + the documented edge cases (zero items,
  max-capacity, mixed reference+custom for cargo). All tests pass via
  `bun run check:all`.
- **AC-6**: `bun run check:all` is green at repo root after both tracks
  land; PR is opened against `yitun-revamp` (not main) referencing issues
  #185 + #193; trust-boundary checks (orchestrator-only files untouched;
  forbidden paths untouched) pass.

## Out of Scope

- Implementing Zustand stores on top of the IndexedDB wrapper — that's
  story #187 (Wave 2).
- Wiring stores into UI builders — that's stories #189/#190/#191 (Wave 3).
- Service worker for offline support — that's story #186 (Wave 2).
- Full coverage for every rule utility beyond the four core utilities
  listed above — that's M4 story #225 (REQ-NF-21).
- Touching shared packages (`suref-react`, `salvageunion-reference`) —
  preserved as-is per Wave 0.
- Touching `apps/itun-legacy`, `apps/suref-web`, `apps/discord-bot`.

## Ontology

- **Reused**: (none — `docs/ontology.md` does not yet exist)
- **Proposed (new)**:
  - **SoftLink** — non-cascading relationship between two entities
    (mech→pilot, pilot→crawler) stored as a separate IndexedDB record
  - **EntityRef** — discriminated union `{ type: 'pilot' | 'mech' | 'crawler', id: string }`
    used by SoftLinks and stand-ins
  - **Soft warning** — a non-blocking rule violation surfaced at save
    time; user can dismiss and proceed

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 1 of ITUN revamp (#185 + #193)
- **bound issues**: #185 (Track A — IndexedDB + Zod), #193 (Track B — rule utilities)
