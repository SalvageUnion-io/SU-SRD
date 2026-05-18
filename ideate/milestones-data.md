<!-- Produced by ideate:architecture Phase 1 (Milestones) — orchestrated, autonomous mode -->
# Milestone Data — ITUN Revamp

**Source:** `ideate/PRD.md` (62 traced REQs) + `ideate/prd-audit.md` (Discovery Q&A)
**Mode:** Orchestrator-dispatched, autonomous (no Q&A, no timing estimates)
**Date:** 2026-05-17

---

## Release Gate Structure

This project has no billing gates. Instead each milestone is gated by a **quality-gated Definition of Done**. The next milestone begins only when the prior milestone's DoD is fully met and CI is green.

| Gate | Trigger |
| :--- | :--- |
| M1 → M2 | All M1 DoD criteria pass; `bun run check:all` is green; maintainer has manually verified an end-to-end build+save+load cycle for all three entity types (standalone). |
| M2 → M3 | All M2 DoD criteria pass; print output reviewed by maintainer on A4 and US Letter; snapshot publish + open round-trip passes for all four composition modes. |
| M3 → Release | All M3 DoD criteria pass; `a11y-scan` CI reports zero WCAG 2.1 AAA violations on sheet view and zero AA violations elsewhere; maintainer completes fresh pilot+mech+crawler build without consulting the codebase. |
| M4 (optional) | Begins after Release; driven by maintainer availability. |

---

## Milestone Sequence

| # | Name | MoSCoW Coverage | Gate-In | Gate-Out |
| :- | :--- | :--- | :--- | :--- |
| M1 | Foundation & Local-First Composable Builds | 21 Must-Have functional REQs + REQ-NF-01, 02, 07, 18, 19, 20, 22 | Project kickoff | M1 DoD pass + CI green |
| M2 | Sheet, Print & Snapshot Publishing | REQ-016..019 + REQ-NF-04..06, 08..09, 10..16 | M1 gate pass | M2 DoD pass + print review |
| M3 | Polish, A11y & Launch | REQ-020, 021 + REQ-NF-03, 11, 17 | M2 gate pass | M3 DoD pass + a11y CI green + final manual QA |
| M4 | Should-Have Backlog (optional) | REQ-022..026 + REQ-NF-21 | Post-release | Per-story DoD; no gate-out |

---

## Workstream Dependencies

Single React app + shared packages (unchanged) + a thin snapshot backend. The backend is a one-way write path (publish) + one-way read path (open-by-URL); it is not in the critical path for M1.

```
┌─────────────────────────────────────────────────────────┐
│  packages/salvageunion-reference  (preserved, no change) │
│  packages/suref-react             (preserved, no change) │
└─────────────────┬───────────────────────────────────────┘
                  │ workspace imports
         ┌────────▼─────────────────────────────┐
         │  apps/in-the-union-now (new, M1..M3)  │
         │    ├── IndexedDB persistence (M1)      │
         │    ├── Composable build flows (M1)     │
         │    ├── Sheet rendering (M2)            │
         │    ├── Print stylesheet (M2)           │
         │    └── A11y + polish (M3)              │
         └──────────────────┬───────────────────-┘
                            │ HTTPS
                   ┌────────▼───────────┐
                   │  Snapshot backend   │
                   │  (TBD — M2 picks)  │
                   │  publish + retrieve │
                   └────────────────────┘
```

The snapshot backend is first touched in M2. M1 builds the full local-first app without any backend dependency.

---

## AI Leverage Key

| Rating | Meaning |
| :----- | :--- |
| High | Claude Code can drive most of this autonomously from clear acceptance criteria |
| Medium | Claude Code assists; maintainer reviews key decisions |
| Low | Requires maintainer judgment (design taste, print visual review, community context) |

---

## M1 — Foundation & Local-First Composable Builds

### Features

| Feature | Description | REQ-IDs |
| :--- | :--- | :--- |
| Repo scaffolding | Archive legacy to `itun-legacy/`; create new `in-the-union-now/` with full stack setup (Vite, React 19, TanStack Router/Query, Zustand, ShadCN, Tailwind v4, Zod) | REQ-NF-20 |
| Local-first persistence | IndexedDB layer (via `idb` or Dexie) for all entity types; offline-tolerant reads/writes; delete a build | REQ-006, REQ-007, REQ-008, REQ-NF-02 |
| Standalone pilot builder | Build a complete pilot (class, abilities, equipment, roll-table results, motto/keepsake/appearance); no mech or crawler required | REQ-001, REQ-010 |
| Standalone mech builder | Build a chassis + systems + modules + cargo without a real pilot record; auto stand-in rendered on sheet | REQ-002, REQ-005, REQ-009, REQ-013, REQ-014, REQ-015 |
| Standalone crawler builder | Build a crawler without pilots assigned; auto stand-in rendered | REQ-003, REQ-005 |
| Soft wiring | Assign an existing mech to a pilot and a pilot to a crawler; wires are soft-references with no cascade-delete | REQ-004 |
| Edit-with-soft-warnings | Free editing of saved builds; surface rule-violation warnings; allow confirm-and-proceed | REQ-011, REQ-012 |
| Performance baseline | TTI ≤ 3 s; save latency ≤ 100 ms; shared-package reuse; CI hooks pass | REQ-NF-01, REQ-NF-02, REQ-NF-07, REQ-NF-18, REQ-NF-19, REQ-NF-22 |

### Definition of Done

**Functional**
- Maintainer can complete a fresh standalone pilot, a fresh standalone mech, and a fresh standalone crawler — each in a separate session — without the other two entity types being required.
- Soft wiring: a mech can be linked to a pilot; deleting the mech does not delete the pilot and vice versa.
- All builds persist across browser close and reopen (IndexedDB round-trip passes).
- App functions fully offline after initial load (service worker or equivalent cache in place).
- Capacity enforcement blocks over-slot mech builds; scrap budget reflects tier math; cargo capacity computes correctly.
- Soft-warning flow fires when a progression edit appears rule-violating; user can dismiss and proceed.
- Roll tables fire correctly in pilot creation.

**Quality**
- `bun run check:all` passes (lint, format, typecheck, test, validate).
- All rule-enforcement utilities (capacity, scrap, slot math) have unit tests.
- Lefthook pre-commit + pre-push hooks green.
- No inline game data — all entity types resolved through `salvageunion-reference`.
- No shared UI reimplemented — all cross-cutting components pulled from `suref-react`.

**Process**
- Legacy app committed to `apps/itun-legacy/`; new app running at `apps/in-the-union-now/`.
- Supabase project decommissioned (documented in commit message or ADR).

### Release Gate (M1 → M2)
All DoD items above pass. Maintainer manually confirms end-to-end build + save + load for all three composition modes in a single sitting.

---

### Deliverable Groups

#### 1A — Repo Scaffolding & Archive

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Archive `apps/in-the-union-now/` to `apps/itun-legacy/` | Legacy runs at `itun-legacy/` path; no monorepo breakage | Medium |
| New `apps/in-the-union-now/` bootstrapped | Vite + React 19 + TanStack Router/Query + Zustand + ShadCN + Tailwind v4 + Zod; `bun run dev:itun` starts cleanly | High |
| Supabase decommission documented | Commit or ADR records project ID `dshtuchbleipwqacyokz` as decommissioned; no live Supabase calls in new app | Medium |
| CI hooks wired | Lefthook pre-commit (lint, format, typecheck) and pre-push (test, validate) pass on first commit | High |

#### 1B — Local-First Persistence Layer

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| IndexedDB wrapper (via `idb` or Dexie) | CRUD for Pilot, Mech, Crawler, Workspace entities; typed with Zod schemas | High |
| Save latency ≤ 100 ms | Measured on mid-range device; write path does not block UI render | High |
| Offline operation | Manual test: load, disconnect, build, save, reload — all data intact | Medium |
| Delete a build | Soft-delete or hard-delete; removed from listing immediately | High |

##### 1B1 — Data Schema

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Zod schemas for local entity types (Pilot, Mech, Crawler, Workspace, SoftLink) | Schemas enforce required fields; export TypeScript types | High |
| Migration strategy documented | IndexedDB version migration approach defined; v1 schema committed | Medium |

##### 1B2 — Zustand Stores

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| `entityStore` (Zustand) | Provides list/get/create/update/delete for each entity type, backed by IndexedDB | High |
| `workspaceStore` (Zustand) | Workspace CRUD; entities can be unassigned (global list) or assigned to a workspace | High |

#### 1C — Composable Builder Flows

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Standalone pilot builder (multi-step wizard or tabbed form) | All pilot fields present (class, abilities, equipment, roll tables, motto/keepsake/appearance); no mech/crawler prompt | High |
| Standalone mech builder | Chassis selector + systems/modules grid + cargo; capacity enforcement active; auto stand-in pilot rendered on preview | High |
| Standalone crawler builder | Crawler form with tech level, bays, systems; auto stand-in pilots rendered on preview | High |
| Roll-table integration (pilot) | Callsign, background, motto, keepsake, appearance tables fire correctly from `salvageunion-reference` | High |
| Capacity & scrap enforcement | Over-slot actions blocked; scrap tier math correct; cargo capacity computed; rule violations flagged | High |
| Mech pattern system | Save named pattern; instantiate a copy from saved pattern | High |

##### 1C1 — Rule-Enforcement Utilities

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| `capacity.ts` utility | Computes remaining system/module slots; returns violation if exceeded | High |
| `scrap.ts` utility | Handles TL1–TL6 tier translation per rules | High |
| `cargo.ts` utility | Computes cargo capacity for custom + reference-linked items | High |
| `softWarnings.ts` utility | Returns warning messages for rule-violating edits | High |
| Unit tests for all four utilities | All edge cases covered; `bun test` passes | High |

#### 1D — Soft Wiring & Entity Relationships

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Soft-link data model | `SoftLink { from: EntityRef, to: EntityRef, type: 'mech-to-pilot' | 'pilot-to-crawler' }` stored in IndexedDB | High |
| Link assignment UI | UI to assign mech → pilot, pilot → crawler from any entity detail view | High |
| No-cascade-delete behavior | Deleting linked entity removes the link, not the other entity | High |
| Auto stand-in rendering | Sheet renders clean `[No Pilot Assigned]` / `[No Crawler Assigned]` markers, not blanks or dummy stats | Medium |

#### 1E — Edit-with-Soft-Warnings

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Rule-violation detection on save | `softWarnings.ts` called on every build save; warnings surfaced in UI | High |
| Confirm-and-proceed flow | User sees warning + "Save anyway" or "Fix it"; both paths work correctly | Medium |
| Condition tracking (intact/damaged/destroyed) | Toggle on each system/module/equipment item; state persists | High |

---

### Story/REQ-ID Mapping Skeleton — M1

| Story Title | REQ-IDs |
| :--- | :--- |
| Archive legacy app and scaffold new ITUN | REQ-NF-20 |
| Set up IndexedDB persistence with Zod schemas | REQ-006, REQ-007, REQ-NF-02 |
| Implement offline-tolerant service worker | REQ-007, REQ-NF-07 |
| Build standalone pilot wizard with roll tables | REQ-001, REQ-010 |
| Build standalone mech builder with capacity enforcement | REQ-002, REQ-009, REQ-014, REQ-015 |
| Build standalone crawler builder | REQ-003 |
| Implement mech pattern save/instantiate | REQ-013 |
| Implement auto stand-in rendering | REQ-005 |
| Implement soft wiring (assign/unassign) | REQ-004 |
| Implement condition tracking (intact/damaged/destroyed) | REQ-011 |
| Implement edit-with-soft-warnings progression | REQ-012 |
| Delete a saved build | REQ-008 |
| Wire CI hooks (Lefthook pre-commit + pre-push) | REQ-NF-22 |
| Enforce shared-UI and game-data conventions | REQ-NF-18, REQ-NF-19 |
| Unit tests for rule-enforcement utilities | REQ-NF-20 |

---

## M2 — Sheet, Print & Snapshot Publishing

### Features

| Feature | Description | REQ-IDs |
| :--- | :--- | :--- |
| Sheet view — live stat editing | Full sheet render for each composition mode; click-to-edit HP/AP/TP/SP/EP/Heat | REQ-016 |
| Print stylesheet (A4 + US Letter) | Professional-grade print output at both page sizes | REQ-019, REQ-NF-13, REQ-NF-14 |
| Anonymous snapshot publishing | One-click publish → short URL immutable snapshot; no account | REQ-017, REQ-NF-04, REQ-NF-05, REQ-NF-06 |
| Open snapshot by URL | Anyone opens snapshot URL — read-only view, no account required | REQ-018 |
| Mobile sheet layout | Responsive sheet legible at 320 px; touch targets ≥ 44 px | REQ-NF-10, REQ-NF-12, REQ-NF-15 |
| Browser support matrix | Verified on Chrome, Firefox, Safari ≥ 16, Edge | REQ-NF-16 |
| Snapshot backend selection | Architecture decision: pick backend (Netlify Functions + Blobs, Cloudflare Workers + KV, or equivalent) | REQ-NF-08, REQ-NF-09 |

### Definition of Done

**Functional**
- Sheet renders correctly for all four composition modes (pilot-only, mech-only, crawler-only, wired).
- HP/AP/TP/SP/EP/Heat are each click-editable and persist immediately to IndexedDB.
- Print preview on Chrome and Firefox produces professional output at A4 and US Letter (maintainer visual review).
- Publish flow: submit build → receive short URL → open URL in incognito → correct read-only sheet renders.
- Published snapshots are immutable: PATCH/PUT/DELETE return 405.
- No PII is transmitted to or stored by the snapshot backend.

**Quality**
- `bun run check:all` passes.
- Sheet smoke tests cover render of each composition mode.
- Snapshot publish + retrieve tested end-to-end (manual).
- Mobile touch targets ≥ 44 px verified on sheet view.
- No horizontal scroll at 320 px viewport.

**Process**
- Backend ADR written documenting the snapshot backend choice and rate-limit decision (REQ-NF-04).

### Release Gate (M2 → M3)
All DoD items pass. Maintainer prints A4 and US Letter sheets from a real browser, reviews output. Snapshot publish/retrieve round-trip works for all four composition modes.

---

### Deliverable Groups

#### 2A — Sheet Rendering

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Sheet layout component for pilot | All pilot fields rendered; condition toggles wired | High |
| Sheet layout component for mech | HP/AP/TP/SP/EP/Heat editable; system/module conditions rendered | High |
| Sheet layout component for crawler | Crawler fields, tech level, bays; pilot roster stand-ins | High |
| Wired sheet view | Pilot + mech + crawler sections composited on one sheet | High |
| Stand-in sections in sheet | "No pilot assigned" etc. render cleanly in all partial-composition modes | Medium |

#### 2B — Live Stat Editing

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Click-to-edit HP/AP/TP/SP/EP/Heat | Each stat is an inline editable; change persists ≤ 100 ms | High |
| Undo-last-edit (optional, if low cost) | Ctrl+Z / Cmd+Z reverts last stat change within session | Low |

#### 2C — Print Stylesheet

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| A4 print stylesheet | No cut-off fields; typography legible at print | Low |
| US Letter print stylesheet | Correct page-break placement; margins within US Letter safe zone | Low |
| Print-preview CI checkpoint | Documented manual-review checklist attached to print PRs | Medium |

Note: print stylesheet quality is maintainer-reviewed (Low AI leverage = design taste call).

#### 2D — Snapshot Backend

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Backend ADR (architecture decision) | Documents chosen backend, rate-limit value, retention policy, idempotency mode | Medium |
| Publish endpoint | POST → returns short URL; per-IP rate limiting active | High |
| Retrieve endpoint | GET by short URL → returns snapshot JSON; 404 for unknown IDs | High |
| Immutability enforcement | PATCH/PUT/DELETE return 405 | High |
| No-PII audit | Snapshot payload contains no IP, user agent, or other identifying data | Medium |

#### 2E — Mobile Sheet & Browser Support

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Mobile-responsive sheet | 320 px viewport: no horizontal scroll, no clipped controls | High |
| Touch targets ≥ 44 px | Verified on sheet view primary actions | High |
| Browser matrix test | Manual pass on Chrome, Firefox, Safari ≥ 16, Edge | Low |

---

### Story/REQ-ID Mapping Skeleton — M2

| Story Title | REQ-IDs |
| :--- | :--- |
| Implement sheet view for all four composition modes | REQ-016 |
| Implement click-to-edit stat fields | REQ-016 |
| Implement print stylesheet — A4 | REQ-019, REQ-NF-13 |
| Implement print stylesheet — US Letter | REQ-019, REQ-NF-14 |
| Choose and scaffold snapshot backend | REQ-NF-04, REQ-NF-08, REQ-NF-09 |
| Implement publish endpoint (POST) | REQ-017, REQ-NF-04, REQ-NF-05, REQ-NF-06 |
| Implement retrieve endpoint (GET by short URL) | REQ-018 |
| Implement share-URL UX in app | REQ-017, REQ-018 |
| Mobile-responsive sheet layout | REQ-NF-10, REQ-NF-12, REQ-NF-15 |
| Browser matrix verification | REQ-NF-16 |
| Sheet smoke tests | REQ-NF-20 |

---

## M3 — Polish, A11y & Launch

### Features

| Feature | Description | REQ-IDs |
| :--- | :--- | :--- |
| Workspace grouping UI | Named workspace CRUD; assign/unassign builds to workspaces; unassigned builds listed in global pool | REQ-020 |
| Contextual SU reference | Inline entity displays + tooltips during builder flows; deep-links to `suref-web` for full SRD | REQ-021 |
| WCAG 2.1 AAA sheet compliance | Full a11y audit of sheet view; zero AAA violations in CI | REQ-NF-10, REQ-NF-11 |
| Performance polish | Mobile 60 FPS sheet scroll; TTI re-verified | REQ-NF-01, REQ-NF-03 |
| First-build timing study | Maintainer measures time-to-first-completed-pilot on a clean session | REQ-NF-17 |
| Legacy archive policy | Tag legacy commit; frozen dependencies policy documented | — |

### Definition of Done

**Functional**
- Workspace CRUD works; builds can be created inside or outside a workspace and moved.
- Contextual entity displays render inline for chassis, system, module, ability, equipment selections.
- `suref-web` deep-links are correct and functional for all entity types.
- Maintainer completes a fresh pilot + mech + crawler build, publishes snapshots, prints both page sizes — in a single uninterrupted session, without consulting the codebase.

**Quality**
- `a11y-scan` CI: zero WCAG 2.1 AAA violations on sheet view; zero AA violations elsewhere.
- 60 FPS sheet scroll maintained on iPhone-class device (tested manually or with DevTools).
- TTI ≤ 3 s on broadband desktop.
- First-build time ≤ 10 min (maintainer timing study documented).

**Process**
- Legacy `apps/itun-legacy/` has a frozen-state commit tag and documented maintenance policy.
- New ITUN passes deployment swap (Netlify or equivalent) at same canonical URL as prior ITUN.
- PRD success metrics (§2.3, §6.1) have a baseline measurement documented.

### Release Gate (M3 → Release)
All DoD items pass. `a11y-scan` CI is green. Maintainer completes the end-to-end acceptance session. Deployment swap confirmed.

---

### Deliverable Groups

#### 3A — Workspace Grouping

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Workspace CRUD UI | Create / rename / delete workspaces | High |
| Build-to-workspace assignment | Drag or select to assign builds to a workspace | High |
| Unassigned builds pool | Builds not in any workspace shown in global "All Builds" list | High |

#### 3B — Contextual SU Reference

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| Inline entity display in builders | Chassis, system, module, ability, equipment selections show entity tooltip/popover from `suref-react` | High |
| Deep-link to `suref-web` | Each inline display has a "View in SRD →" link to the canonical `suref-web` entity page | High |

#### 3C — A11y & Polish

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| WCAG 2.1 AAA audit on sheet view | Run `a11y-scan`; zero violations; color/contrast fixes applied | Medium |
| WCAG 2.1 AA audit on all other views | Run `a11y-scan`; zero violations | Medium |
| Mobile scroll performance | 60 FPS maintained on sheet scroll on iPhone-class device | Medium |
| TTI verification | Lighthouse run: TTI ≤ 3 s on broadband desktop | High |

#### 3D — Launch Preparation

| Deliverable | Acceptance Criteria | AI Leverage |
| :--- | :--- | :--- |
| First-build timing study | Documented: maintainer session time for first pilot | Low |
| Legacy archive policy | Git tag on legacy commit; README in `itun-legacy/` documenting frozen status | High |
| Deployment swap | New ITUN live at canonical URL; Netlify config updated | Medium |
| Baseline metrics documented | PRD §2.3 / §6.1 metrics documented at release | Low |

---

### Story/REQ-ID Mapping Skeleton — M3

| Story Title | REQ-IDs |
| :--- | :--- |
| Workspace CRUD and build assignment | REQ-020 |
| Contextual entity displays in builder flows | REQ-021 |
| deep-links to suref-web | REQ-021 |
| WCAG 2.1 AAA audit + fixes on sheet view | REQ-NF-10 |
| WCAG 2.1 AA audit + fixes on all other views | REQ-NF-11 |
| Mobile scroll performance (60 FPS) | REQ-NF-03 |
| TTI re-verification + performance budget | REQ-NF-01 |
| First-build timing study | REQ-NF-17 |
| Legacy archive policy + tag | — |
| Deployment swap + canonical URL verification | — |

---

## M4 — Should-Have Backlog (Optional, Post-Release)

M4 is not gated. Stories are worked in any order after release, driven by maintainer availability and community feedback.

| Feature | Description | REQ-IDs | AI Leverage |
| :--- | :--- | :--- | :--- |
| JSON export | Download build as JSON file | REQ-024 | High |
| JSON import | Load build from JSON file | REQ-025 | High |
| Comrade / drone display | Comrades + drones on sheet with actions and EP tracking | REQ-023 | High |
| Crawler tech-level upgrade flow | Upgrade TL by spending scrap; soft warnings on violations | REQ-022 | High |
| Pattern publishing | Publish a named mech pattern as anonymous snapshot; community cloneable | REQ-026 | High |
| Rule-enforcement test coverage | Comprehensive unit tests for all rule utilities | REQ-NF-21 | High |
| Mobile 60 FPS (if missed in M3) | (Carry-over) | REQ-NF-03 | Medium |
| Could-Have: dice roller | Basic d20 / stat-check roller | REQ-027 | High |
| Could-Have: QR code | QR code rendering of snapshot URL | REQ-028 | High |

### Story/REQ-ID Mapping Skeleton — M4

| Story Title | REQ-IDs |
| :--- | :--- |
| Export build as JSON | REQ-024 |
| Import build from JSON | REQ-025 |
| Comrade / drone display on sheet | REQ-023 |
| Crawler TL upgrade flow | REQ-022 |
| Pattern snapshot publishing | REQ-026 |
| Unit tests for rule-enforcement utilities (full coverage) | REQ-NF-21 |
| Generic dice roller helper | REQ-027 |
| Snapshot QR code | REQ-028 |

---

## REQ-ID Coverage Check

All Must-Have functional and non-functional REQs are covered in M1–M3 as follows:

| REQ-ID | Milestone |
| :----- | :--- |
| REQ-001 | M1 |
| REQ-002 | M1 |
| REQ-003 | M1 |
| REQ-004 | M1 |
| REQ-005 | M1 |
| REQ-006 | M1 |
| REQ-007 | M1 |
| REQ-008 | M1 |
| REQ-009 | M1 |
| REQ-010 | M1 |
| REQ-011 | M1 |
| REQ-012 | M1 |
| REQ-013 | M1 |
| REQ-014 | M1 |
| REQ-015 | M1 |
| REQ-016 | M2 |
| REQ-017 | M2 |
| REQ-018 | M2 |
| REQ-019 | M2 |
| REQ-020 | M3 |
| REQ-021 | M3 |
| REQ-022 | M4 (Should) |
| REQ-023 | M4 (Should) |
| REQ-024 | M4 (Should) |
| REQ-025 | M4 (Should) |
| REQ-026 | M4 (Should) |
| REQ-027 | M4 (Could) |
| REQ-028 | M4 (Could) |
| REQ-NF-01 | M1 (initial), M3 (re-verified) |
| REQ-NF-02 | M1 |
| REQ-NF-03 | M3 (Should) |
| REQ-NF-04 | M2 |
| REQ-NF-05 | M2 |
| REQ-NF-06 | M2 |
| REQ-NF-07 | M1 |
| REQ-NF-08 | M2 |
| REQ-NF-09 | M2 (Should) |
| REQ-NF-10 | M2 (initial), M3 (CI-gated) |
| REQ-NF-11 | M3 |
| REQ-NF-12 | M2 |
| REQ-NF-13 | M2 |
| REQ-NF-14 | M2 |
| REQ-NF-15 | M2 |
| REQ-NF-16 | M2 |
| REQ-NF-17 | M3 (Should) |
| REQ-NF-18 | M1 |
| REQ-NF-19 | M1 |
| REQ-NF-20 | M1 |
| REQ-NF-21 | M4 (Should) |
| REQ-NF-22 | M1 |

**Uncovered REQs:** None. All 62 REQ-IDs are assigned.

---

## Milestone Summary Table

| Milestone | Deliverable Groups | Functional REQs Covered | NF REQs Covered | Priority |
| :--- | :--- | :--- | :--- | :--- |
| M1 | 1A, 1B, 1C, 1D, 1E (5 groups, 1B+1C decomposed) | REQ-001..015 | REQ-NF-01, 02, 07, 18, 19, 20, 22 | Must |
| M2 | 2A, 2B, 2C, 2D, 2E (5 groups) | REQ-016..019 | REQ-NF-04..06, 08..10, 12..16 | Must |
| M3 | 3A, 3B, 3C, 3D (4 groups) | REQ-020, 021 | REQ-NF-01(re), 03, 11, 17 | Must |
| M4 | (story list, no groups) | REQ-022..028 | REQ-NF-21 | Should/Could |

---

## Key Assumptions & Risk Factors

1. **Snapshot backend is not on the M1 critical path.** The entire local-first builder can be built and validated in M1 with zero backend. The backend decision (ADR) is made early in M2 before any backend code is written.

2. **suref-react and salvageunion-reference are stable during M1.** If either shared package needs changes (e.g., new entity display slot props), those changes are made in-line with the consuming stories and promoted up after the fact, per `docs/architecture/package-contracts.md`.

3. **Print quality is maintainer-reviewed, not CI-automated.** There is no reliable programmatic print-quality assertion. The DoD for M2 includes an explicit manual print-review checkpoint. This is by design (per R-3 in PRD §7.0).

4. **WCAG 2.1 AAA on sheet view may require brand color adjustments.** The `a11y-scan` gate in M3 may surface contrast failures on existing SU brand colors. The resolution policy (AAA wins on sheet view; brand color preserved elsewhere, per R-5 in PRD §7.0) is pre-decided and should not require an architecture decision mid-implementation.

5. **REQ-NF-10 (sheet AAA) is partially addressed in M2 (initial mobile work) but fully CI-gated in M3.** The split is intentional: M2 builds the sheet; M3 audits and certifies it. Early violations found in M2 are fixed before M3 opens.

6. **M4 Should-Haves are ordered by maintainer value, not technical dependency.** JSON export/import (REQ-024/025) are simpler and higher-value to most users; comrade/drone display (REQ-023) requires more data-model work. Suggested order: 024 → 025 → 023 → 022 → 026.

7. **REQ-NF-21 (full rule-enforcement test coverage) is Should-Have in M4, not Must in M1.** M1 requires tests for the core capacity/scrap/cargo/softWarnings utilities. Full coverage of all rule utilities is deferred to M4 as a polish item — this is a practical concession to solo-maintainer velocity, not a quality compromise on the tested core.

8. **Workspace semantics are local-only in MVP (REQ-020).** Workspaces are purely an IndexedDB construct in M3. No sharing, no invites, no roles. The Zod schema for Workspace should be designed upgrade-path-aware (has an `id` field that could be a Supabase record ID later), but no backend is wired in M3.
