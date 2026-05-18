---
run_id: 2026-05-18-itun-revamp-wave-3
intent: |
  Wave 3 of the ITUN revamp: build the three standalone entity builders
  (pilot wizard, mech builder with capacity enforcement, crawler builder)
  on top of Waves 0-2's foundation, plus a dashboard with delete-build UI
  and a shared ConditionToggle for intact/damaged/destroyed state on
  systems/modules/equipment. Four file-disjoint cycles ship as one PR.
acceptance_criteria:
  - id: AC-1
    text: "A pilot wizard at apps/in-the-union-now/src/routes/pilots/new.tsx (or equivalent) covers all pilot fields: class selection, abilities, equipment, motto/keepsake/appearance. Roll tables (callsign, background, motto, keepsake, appearance) fire correctly from salvageunion-reference. No mech/crawler prompt anywhere in the flow. Finishing the wizard calls entityStore.create('pilot', ...) and persists the pilot."
  - id: AC-2
    text: "A mech builder at apps/in-the-union-now/src/routes/mechs/new.tsx (or equivalent) provides chassis selector + systems/modules grid + cargo. Wires src/lib/rules/capacity.ts so over-slot system/module selection is blocked or surfaces a clear violation. Scrap math (scrap.ts) and cargo capacity (cargo.ts) computed and displayed. Auto stand-in pilot rendered on preview. Finishing calls entityStore.create('mech', ...)."
  - id: AC-3
    text: "A crawler builder at apps/in-the-union-now/src/routes/crawlers/new.tsx (or equivalent) provides tech-level selector, bays, systems. No pilot assignment required. Auto stand-in pilots rendered on preview. Finishing calls entityStore.create('crawler', ...)."
  - id: AC-4
    text: "A dashboard at apps/in-the-union-now/src/routes/index.tsx (or via a /dashboard route) lists existing pilots/mechs/crawlers with a delete affordance per item. Confirm-then-delete flow calls entityStore.delete; the deleted entity disappears from the listing immediately (sync read after the in-memory update)."
  - id: AC-5
    text: "A ConditionToggle component at apps/in-the-union-now/src/components/shared/ConditionToggle.tsx provides intact/damaged/destroyed toggling, wired into mech systems/modules and pilot equipment views. State persists via entityStore.update; the toggle survives a reload (IndexedDB round-trip)."
  - id: AC-6
    text: "bun run check:all is green at repo root after all four cycles land; PR is opened against yitun-revamp (not main) referencing issues #189 + #190 + #191 + #188 + #197; trust-boundary checks (orchestrator-only files untouched; forbidden paths untouched) pass."
out_of_scope:
  - "Sheet view rendering — that's M2 story #198 (Wave 4)."
  - "Soft wiring (mech↔pilot links) — that's story #195 (later in M1; cycle order matters)."
  - "Edit-with-soft-warnings progression — that's story #196 (later in M1)."
  - "Mech pattern save/instantiate — that's story #192 (later in M1)."
  - "Print stylesheets, snapshot publishing, anything M2/M3."
  - "Touching Waves 0-2 modules (schemas/, db/, rules/, stores/, sw/) — consume only."
proposed_ontology_terms:
  - "Pilot wizard — multi-step or tabbed form for assembling a complete pilot"
  - "Mech builder — chassis-first form with capacity/scrap/cargo enforcement"
  - "Crawler builder — TL-first form with bays + systems"
  - "Dashboard — entry-point listing for existing pilots/mechs/crawlers + delete UI"
  - "ConditionToggle — shared intact/damaged/destroyed control for items"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 3 of ITUN revamp (#189 + #190 + #191 + #188 + #197)"
---

# Intent — itun-revamp-wave-3

## Statement

Wave 3 of the ITUN revamp: build the three standalone entity builders
(pilot wizard, mech builder with capacity enforcement, crawler builder)
on top of Waves 0-2's foundation, plus a dashboard with delete-build UI
and a shared ConditionToggle for intact/damaged/destroyed state on
systems/modules/equipment. Four file-disjoint cycles ship as one PR.

## Acceptance Criteria

- **AC-1** (#189): A pilot wizard covers all pilot fields with roll tables
  firing from `salvageunion-reference`; no mech/crawler prompt; finishing
  calls `entityStore.create('pilot', ...)`.
- **AC-2** (#190): A mech builder provides chassis selector + systems/modules
  grid + cargo, wired through `capacity.ts` / `scrap.ts` / `cargo.ts`. Auto
  stand-in pilot on preview. Finishing calls `entityStore.create('mech', ...)`.
- **AC-3** (#191): A crawler builder provides tech-level + bays + systems.
  No pilot assignment required. Finishing calls `entityStore.create('crawler', ...)`.
- **AC-4** (#188): Dashboard lists existing pilots/mechs/crawlers with a
  delete affordance; confirm-then-delete calls `entityStore.delete`;
  deleted items disappear immediately.
- **AC-5** (#197): Shared `ConditionToggle` (intact/damaged/destroyed)
  wired into mech systems/modules and pilot equipment views; state
  persists via `entityStore.update` and survives reload.
- **AC-6**: `bun run check:all` green; PR against `yitun-revamp` references
  all five issues; trust-boundary checks pass.

## Out of Scope

- Sheet view rendering — M2 story #198 (Wave 4).
- Soft wiring (mech↔pilot links) — story #195.
- Edit-with-soft-warnings progression — story #196.
- Mech pattern save/instantiate — story #192.
- Print stylesheets, snapshot publishing, anything M2/M3.
- Touching Waves 0-2 modules (`schemas/`, `db/`, `rules/`, `stores/`,
  `sw/`) — consume only.

## Ontology

- **Reused**: entityStore, workspaceStore, SoftLink, EntityRef, Soft warning, App shell (from prior waves)
- **Proposed (new)**:
  - **Pilot wizard** — multi-step or tabbed form for assembling a complete pilot
  - **Mech builder** — chassis-first form with capacity/scrap/cargo enforcement
  - **Crawler builder** — TL-first form with bays + systems
  - **Dashboard** — entry-point listing for existing pilots/mechs/crawlers + delete UI
  - **ConditionToggle** — shared intact/damaged/destroyed control for items

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 3 of ITUN revamp
- **bound issues**: #189 (Track A — pilot), #190 (Track B — mech), #191 (Track C — crawler), #188 + #197 (Track D — dashboard/delete/condition)
