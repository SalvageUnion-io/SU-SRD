---
run_id: 2026-05-18-itun-revamp-wave-2
intent: |
  Wave 2 of the ITUN revamp: build the Zustand state layer wrapping the
  Wave 1 IndexedDB CRUD (entity + workspace stores) and a service worker
  that caches the app shell so the app loads fully offline after first
  visit. Two file-disjoint tracks ship as one PR.
acceptance_criteria:
  - id: AC-1
    text: "An entityStore at apps/in-the-union-now/src/stores/entityStore.ts provides typed list/get/create/update/delete for Pilot, Mech, Crawler, and SoftLink — all backed by the Wave 1 db/ wrapper. State is hydrated from IndexedDB on first use; subsequent reads return from the in-memory Zustand state synchronously."
  - id: AC-2
    text: "A workspaceStore at apps/in-the-union-now/src/stores/workspaceStore.ts provides Workspace CRUD plus assign/unassign helpers. Entities expose `workspaceId?: string` (already in the Wave 1 schemas) — unassigned entities show in a global pool, assigned entities show under their workspace."
  - id: AC-3
    text: "Both stores have unit tests covering: hydration from db, CRUD actions calling through to the db layer, Zod-validation error propagation, and assignment semantics for the workspace store. Tests run under happy-dom + fake-indexeddb and pass via bun run check:all."
  - id: AC-4
    text: "A service worker registered at app startup caches the app shell (HTML, JS, CSS bundles) so reloading the app while offline serves it fully. Implementation lives in apps/in-the-union-now/src/lib/sw/ + apps/in-the-union-now/public/ (or via vite-plugin-pwa); the chosen approach is documented in an inline ADR comment."
  - id: AC-5
    text: "main.tsx registers the service worker at boot. A registration smoke test verifies the registration call shape (URL, scope). Full offline behavior is captured as a manual-test checklist in the PR description, not an automated test."
  - id: AC-6
    text: "bun run check:all is green at repo root after both tracks land; PR is opened against yitun-revamp (not main) referencing issues #187 + #186; trust-boundary checks (orchestrator-only files untouched; forbidden paths untouched) pass."
out_of_scope:
  - "Wiring stores into UI builders — that's stories #189/#190/#191 (Wave 3)."
  - "Push notifications, background sync, or other PWA features beyond app-shell caching — not in the M1 scope."
  - "Real-time sync between tabs (BroadcastChannel) — could be added later; not required by REQ-NF-07."
  - "Server-state caching (TanStack Query) — these stores are purely local; TanStack Query layers in when snapshot publishing is wired (Wave 4 / M2)."
  - "Touching Wave 1 modules (schemas/, db/, rules/) — consume them, don't modify."
  - "Touching shared packages or other apps."
proposed_ontology_terms:
  - "entityStore — Zustand store wrapping the db/ CRUD for Pilot/Mech/Crawler/SoftLink with in-memory cache"
  - "workspaceStore — Zustand store for Workspace CRUD + entity assignment helpers"
  - "App shell — the static HTML/JS/CSS bundle the SW caches for offline load"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 2 of ITUN revamp (#187 + #186)"
---

# Intent — itun-revamp-wave-2

## Statement

Wave 2 of the ITUN revamp: build the Zustand state layer wrapping the
Wave 1 IndexedDB CRUD (entity + workspace stores) and a service worker
that caches the app shell so the app loads fully offline after first
visit. Two file-disjoint tracks ship as one PR.

## Acceptance Criteria

- **AC-1**: An `entityStore` at `apps/in-the-union-now/src/stores/entityStore.ts`
  provides typed `list / get / create / update / delete` for Pilot, Mech,
  Crawler, and SoftLink — all backed by the Wave 1 `db/` wrapper. State
  is hydrated from IndexedDB on first use; subsequent reads return from
  the in-memory Zustand state synchronously.
- **AC-2**: A `workspaceStore` at `apps/in-the-union-now/src/stores/workspaceStore.ts`
  provides Workspace CRUD plus assign/unassign helpers. Entities expose
  `workspaceId?: string` (already in the Wave 1 schemas) — unassigned
  entities show in a global pool, assigned entities show under their
  workspace.
- **AC-3**: Both stores have unit tests covering: hydration from db, CRUD
  actions calling through to the db layer, Zod-validation error
  propagation, and assignment semantics for the workspace store. Tests
  run under happy-dom + fake-indexeddb and pass via `bun run check:all`.
- **AC-4**: A service worker registered at app startup caches the app
  shell (HTML, JS, CSS bundles) so reloading the app while offline serves
  it fully. Implementation lives in `apps/in-the-union-now/src/lib/sw/` +
  `apps/in-the-union-now/public/` (or via `vite-plugin-pwa`); the chosen
  approach is documented in an inline ADR comment.
- **AC-5**: `main.tsx` registers the service worker at boot. A
  registration smoke test verifies the registration call shape (URL,
  scope). Full offline behavior is captured as a manual-test checklist
  in the PR description, not an automated test.
- **AC-6**: `bun run check:all` is green at repo root after both tracks
  land; PR is opened against `yitun-revamp` (not main) referencing
  issues #187 + #186; trust-boundary checks (orchestrator-only files
  untouched; forbidden paths untouched) pass.

## Out of Scope

- Wiring stores into UI builders — that's stories #189/#190/#191 (Wave 3).
- Push notifications, background sync, or other PWA features beyond
  app-shell caching — not in the M1 scope.
- Real-time sync between tabs (BroadcastChannel) — could be added later;
  not required by REQ-NF-07.
- Server-state caching (TanStack Query) — these stores are purely local;
  TanStack Query layers in when snapshot publishing is wired
  (Wave 4 / M2).
- Touching Wave 1 modules (`schemas/`, `db/`, `rules/`) — consume them,
  don't modify.
- Touching shared packages or other apps.

## Ontology

- **Reused**: SoftLink, EntityRef, Soft warning (from Wave 1 ontology)
- **Proposed (new)**:
  - **entityStore** — Zustand store wrapping the `db/` CRUD for Pilot/Mech/Crawler/SoftLink with in-memory cache
  - **workspaceStore** — Zustand store for Workspace CRUD + entity assignment helpers
  - **App shell** — the static HTML/JS/CSS bundle the SW caches for offline load

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 2 of ITUN revamp (#187 + #186)
- **bound issues**: #187 (Track A — Zustand stores), #186 (Track B — service worker)
