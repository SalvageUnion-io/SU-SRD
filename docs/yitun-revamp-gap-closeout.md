# YITUN Revamp — Gap Closeout

Follow-on to [`yitun-revamp-plan.md`](./yitun-revamp-plan.md). Closes the gaps found by auditing the live code against the **real design bundle** (`board-*.jsx` + `itun.css`, Claude Design handoff `FhrBhG9CiZwEsxphh5V5mA`).

**Decisions (confirmed with stakeholder 2026-05-31):**
- ITUN scope = **everything incl. features** (stepper wizards, master-detail, bay catalog selector, conditions).
- SRD entity images = **keep design behavior** (detail pages only; compact listings stay image-free, per `.ec--compact .ec__art{display:none}`). No change.
- No counts on catalog items — already satisfied.

Sequence: shared card layer (suref-react) → SRD polish → ITUN sheets → ITUN builders → ITUN features. Verify (`typecheck`, package tests, lint) + commit per phase. Tests stay green; flag stale style-assertions rather than bending the design.

---

## Phase A — Shared card layer (`packages/suref-react`)
- [ ] **A1** Flavor text on *all* entity types with a description (drop the `isAbility` guard in `ReferenceEntityRightHeaderContent.tsx`), italic right-aligned, `var(--deep)` tone.
- [ ] **A2** Body outer left-accent bar — 4px `var(--acc)` down the whole white body wrapper (`ReferenceEntityDisplayContent.tsx`), per `itun.css:154-157`.
- [ ] **A3** `.ec__art` art slot parity — confirm `CardImage` matches design art column (detail-only; hidden in compact). No regression to image rendering.
- [ ] Verify: `bun --filter suref-react test`, typecheck, lint.

## Phase B — SRD polish (`apps/suref-web`) — ✅ DONE
- [x] **B1** Browse filters moved to a 230px left sidebar rail; stacks on mobile; grid 2-col at lg. (commit e93f9bbe) Verified: suref-web 940 pass.

## Phase F — ITUN dashboard polish — ✅ partial
- [x] **F1** `EntityListItem` 1.5px border + optional `meta` sub-line; pilot rows show callsign + class. (commit) Mech/crawler meta TODO.
- [x] **F2** `EmptyState` dash → `--wk-faint` (#a7b4bd), 1.5px.

## Phase C — ITUN sheets (`apps/in-the-union-now`) — ✅ DONE
- [x] **C1** Pip trackers — added `PipTracker` primitive to suref-react; pilot HP(10)/AP(5) constants, mech SP/EP/Heat from chassis. Crawler SP skipped (no max source yet — schema TODO). (commits 8f0cd312, 2102418a)
- [x] **C2** Pilot conditions block — `pilot.conditions[]` as chips on the sheet. Read display; `+ Add` editing not yet wired. (commit b946603b)
- [x] **C3** Fixed `Class: <uuid>` — `resolveClassName` on `PilotSheet.tsx` + `routes/pilots/$id.tsx`. (commit b946603b)
- [x] Verified: typecheck clean, suref-react 144 pass, itun 576 pass.

## Phase D — ITUN builders (structural)
- [x] **D1** Mech builder → Chassis/Loadout/Identity/Review stepper wizard
  mirroring PilotWizard (commit 81431f14). Unit suite green; `mech-build` +
  `mech-corner-cases` e2e updated to the stepper flow (CI verifies Playwright).
- [x] **D2** Crawler builder → Tech Level/Loadout/Identity/Review stepper
  (commit ee9787f4). Unit + responsive tests and both crawler e2e specs updated
  to the step flow; off-design pilot placeholder dropped. Unit suite green.
- [x] **D3** Class/Chassis master-detail (commit 783700b6). `ClassStep` +
  `ChassisSelector` now render a `.pick`-style row list (left) + selected-entity
  detail pane (right); detail renders only after a row is selected.

## Phase E — ITUN crawler bays — ✅ DONE (commit dc54adde)
Decision taken: add an extensible `crawlerBays` field distinct from the
crew/mech assignment `bays`.
- [x] **E0** `crawlerBays: z.array(z.string()).optional()` on the crawler schema
  (optional → existing records validate on read, no migration). `crawler.ts`.
- [x] **E1** `BayCatalogSelector` — pick SRD crawler-bays as pink entity cards in
  the wizard Loadout step (accent via the shared card's crawler-bay mapping).
- [x] **E2** `CrawlerSheet` renders installed bays as pink cards.
- ⏳ Default static-bay seeding deferred until the canonical default-bay list is confirmed.

## Phase A — Card layer (`suref-react`)
- [x] **A2** 4px `var(--acc)` body accent bar (commit 08be71ac). Visual-only;
  coloured from the header accent via `borderColorFromHeaderBg`. **No SRD test
  changed** (suref-react 144 / suref-web 940 green untouched).
- [ ] **A1** Flavor on all entity types — **not done (out of styling scope).**
  The design's header flavor is a distinct quip; for non-abilities "flavor" is a
  `content` block, not a top-level field, so relocating it would duplicate body
  text. Needs a content-model decision, not a restyle.

---

## Wave 2 — follow-ups (decisions confirmed 2026-06-01)

**Settled:** keep building (don't merge #239 yet) · A1 stays abilities-only ·
accent bar stays on all cards · wizard steps stay combined "Loadout" · fresh
entities start HP/AP/SP/EP = max, Heat = 0 · screenshots delivered.

- [x] **W2-1** Fresh-stat defaults seeded on create; crawler SP max wired from
  tech level (20/25/30/35/40/50) + SP pip on the sheet. (committed)
- [x] **W2-2** Dashboard meta sub-lines: mech (chassis · TL), crawler (TL · bays). (committed)
- [ ] **W2-3** Editable conditions on the pilot sheet (+ Add / remove → store writes).
- [ ] **W2-4** Mobile live-sheet segmented Pilot/Mech/Crawler switcher.
- [ ] **W2-5 (large) — crawler bay re-model.** Research found 9 bays, each
  embedding an NPC (`npc.position` + `npc.hitPoints` 4 + freeform Name/Motto).
  Official sheets pre-print all 9 → **all 9 are the default set**. Re-model:
  - Seed all 9 bay ids on crawler creation (extensible — can add more later).
  - Track per-bay NPC state (current HP, name) in player data — replaces the flat
    `crawlerBays: string[]` and the free-text crew `BaysEditor`.
  - Sheet renders each bay as a pink card with its NPC + an editable HP tracker
    (the shared card already exposes an `npc` hpSlot).
  - Builder: drop the free-text crew editor + the catalog multi-select (bays are
    default, not chosen).
