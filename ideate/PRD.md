2026-05-17

Ideate Phase
Product Requirements Document
Salvage Union Community Tooling — alxjrvs

**Product Requirements Document: In The Union Now (ITUN) — Revamp**

## 1.0 Document Overview

| Field                          | Value                                                                                                                           |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **Version**                    | 0.1 (research draft)                                                                                                            |
| **Date**                       | 2026-05-17                                                                                                                      |
| **Status**                     | In Progress (Wave 1 complete; Wave 2 / Requirements pending)                                                                    |
| **Target Release / Milestone** | MVP "Single-Player Builder" — no hard date, quality-gated release                                                               |
| **Authors / Contributors**     | alxjrvs (sole maintainer) + Claude Code (ideate pipeline)                                                                       |

**Subject of this PRD:** A focused, quality-first rewrite of the "In The Union Now" (ITUN) web application — a player-side character-building and sheet-tracking tool for the Salvage Union TTRPG. The rebuild replaces today's cloud-first multiplayer-aspirant ITUN with a local-first, single-player builder where pilot/mech/crawler are independently composable first-class entities, with an architectural runway back toward the original multiplayer-manager ambition.

## 2.0 Executive Summary

### 2.1 The Initiative

ITUN today is a half-built multiplayer campaign manager. Its scope has outpaced what a solo maintainer can ship at quality; 22 P0–P4 gameplay gaps and seven race conditions are catalogued but unshipped, while the cloud-first / auth-required architecture imposes friction on the most common use case: a single player just trying to build and share a character. The Revamp inverts the prioritization. The new ITUN is a **single-player, local-first character builder** that respects Salvage Union's composability — every "level" of a character (pilot alone, mech alone, crawler alone, or any wired combination) is independently buildable, shareable, and printable. Multiplayer, GM tools, and live-combat automation are deliberately deferred to an explicit upgrade path so they do not foreclose shipping the core loop at quality.

### 2.2 Vision & Scope

**In scope (MVP):** Build/save/share/print pilots, mechs, and crawlers; mech pattern system; capacity and budget enforcement; roll tables in pilot creation; equipment condition tracking; manual live-stat editing during play; soft-warning progression edits; anonymous backend snapshot publishing (short URLs); workspace-per-campaign grouping; contextual in-line SU reference; local-first IndexedDB persistence; mobile-responsive desktop-primary UI; A4 + US Letter print quality; WCAG 2.1 AAA for sheet display, AA elsewhere.

**Out of scope (this iteration):** Real-time multiplayer / live-sync; accounts and auth at MVP; GM/Mediator tools (NPCs, encounters, factions, rumors); active combat tracking (action buttons that decrement resources, automated damage flow, heat-link); guided downtime / progression wizards; campaign-shared workspaces; Discord bot changes; full SRD reference duplication inside ITUN; image uploads; vehicle/faction/bio-titan tracking.

**Architectural runway (must remain credible, not built):** Cloud sync; magic-link or full-account auth layered on top of anonymous snapshots; light-automation combat; campaign-shared multiplayer workspaces with realtime sync; GM-side tooling.

### 2.3 Success Metrics

Solo-maintainer, no-revenue context — success is defined by shippability, sustainability, and community uptake, not commercial KPIs.

| Metric                                          | Measurement                                            | Desired Outcome                                              |
| :---------------------------------------------- | :----------------------------------------------------- | :----------------------------------------------------------- |
| **Time-to-first-build for a new visitor**       | Manual timing: load page → first saved pilot/mech/crawler | ≤ 10 minutes, no account, no install                          |
| **Builds shareable via single-URL snapshot**    | Functional check on publish + open-snapshot round-trip | 100% of build types (pilot-only, mech-only, crawler-only, wired) |
| **Print-quality sheet output**                  | Visual review of A4 + US Letter PDF for each build type | Professional fidelity at both page sizes                     |
| **Sheet-view accessibility**                    | Automated `a11y-scan` CI run                            | Zero WCAG 2.1 AAA violations on the sheet view; zero AA elsewhere |
| **Mobile sheet legibility at the table**        | Manual test on iPhone / Android viewport               | Critical info readable without zoom; touch targets ≥ 44 px   |
| **Community uptake**                            | Self-reported: SU Discord / forum mentions, GitHub stars, anecdotal use | ≥ a handful of SU players outside the maintainer reach a finished build and use it |
| **Maintainer ship cadence**                     | Internal: ratio of merged PRs to in-progress branches  | The maintainer stops dreading the codebase                   |

## 3.0 Background & Strategic Fit

The Salvage Union TTRPG has an active community of homebrew builders, table groups, and digital tinkerers. Existing digital tooling falls into three buckets:

1. **The current ITUN itself** — feature-rich on paper (26 implemented mechanics covering pilot/mech/crawler creation, pattern system, capacity enforcement, condition tracking, live stats, cargo, scrap, realtime sync, change log, comrade tracking, member roster, and RLS) but unfinished in practice (22 P0–P4 gameplay gaps; race conditions blocking reliable multiplayer; cloud + auth friction).
2. **Community spreadsheets and Google Docs** — print-friendly, zero-friction, but rule-unaware. Capacity enforcement, ability/equipment cross-references, and roll-table integration are all missing.
3. **Generic VTTs (Roll20, Foundry SU module) and PDF character sheets** — usable inside their host context but not standalone, and rarely link-shareable.

`suref-web` (this monorepo's sibling app) already serves as the canonical SRD reference site for Salvage Union, backed by the same `salvageunion-reference` data package. ITUN's *building* function complements `suref-web`'s *reference* function; the two are deliberately separate concerns. The Revamp does not change that boundary.

Strategically, the project's core asset is the `salvageunion-reference` package — a TypeScript-typed, Zod-validated, JSON-backed data layer covering every chassis, system, module, ability, roll table, and equipment item in the game. Any consumer of that package starts with the best-curated SU data layer in the community. ITUN should compound that asset, not compete with it; the new app keeps `salvageunion-reference` and `suref-react` as preserved shared dependencies and rebuilds only the app shell, data flow, and feature surface.

### 3.1 Problem Statement

A single Salvage Union player today cannot quickly build, save, and share a character at the level they actually want to. The available tools assume either a full campaign context (current ITUN), an unstructured paper-document workflow (Google Docs), or a hosting platform (Roll20). The gap is a **friction-free, composability-respecting, link-shareable, print-friendly builder** for the most common use cases:

- *"I want to build just a mech for a one-shot — without inventing a pilot."*
- *"I want a pilot I can drop into someone else's game — without designing the crawler."*
- *"I want a crawler the table will share — without locking it to any one pilot."*
- *"I want a fully wired pilot+mech+crawler to bring to a campaign — once everything is set."*
- *"I want to print a clean sheet for table use without owning a printer-friendly subscription tool."*
- *"I want to share my build to a friend via one URL — without making them sign up."*

The current ITUN's data model nests these entities (pilot owns mech, crawler hosts pilot), which forecloses the standalone use cases. Its cloud-first/auth-required posture additionally costs every visitor an account-creation hurdle before they can even play with the builder.

### 3.2 Goal & Opportunity

**Goal:** Ship a quality-first, single-player Salvage Union character builder where pilot, mech, and crawler are independently composable first-class entities — buildable alone, wirable together, link-shareable, print-friendly, and locally persisted with optional anonymous publishing.

**Strategic opportunity:** Across the SU tooling landscape, **no single tool nails all four of: composability, no-account friction, link-shareable snapshots, and print-quality sheets**. The new ITUN occupies that position, anchored to the canonical `salvageunion-reference` data layer (the project's strongest moat in the SU community). The composability model also doubles as a multiplayer-ready foundation — independent entities with optional wiring are the natural shape for a future multi-player workspace, so the MVP architecture invests in the right direction even while keeping multiplayer out of scope.

**Why now:** The current ITUN's scope is the project's load-bearing risk. The maintainer wants a sustainable codebase that can grow into the long-term multiplayer-manager vision without continuing to compound tech debt and unshipped features. Re-grounding on a smaller, quality-first MVP buys back maintainer capacity and credibility with the player community.

### 3.3 Dependencies & Constraints

**Hard constraints (user-confirmed):**
- **Browser support** — Evergreen browsers only; drop Safari < 16. Modern CSS, View Transitions, native dialog, container queries are fair game.
- **Print** — A4 *and* US Letter must both render professionally. Print stylesheet is a first-class deliverable, not an afterthought.
- **Accessibility** — WCAG 2.1 AAA for the sheet display; AA for everything else. The existing `a11y-scan` CI skill is the enforcement mechanism.
- **Shared packages** — `suref-react` (no build step, source-exported component library) and `salvageunion-reference` (Zod schemas + JSON dataset + TS ORM) are preserved as workspace dependencies. They are the moat; do not fork.
- **Legacy handling** — The existing `apps/in-the-union-now/` is archived to `apps/itun-legacy/`. The legacy Supabase project (`dshtuchbleipwqacyokz`) is decommissioned. **Zero real users** to migrate.

**Soft preferences:**
- **Hosting** — Netlify is preferred (current deployment target) but not strictly required.
- **Sync backend choice** — Deferred to `/ideate:architecture`. PRD records the snapshot-publishing requirement but does not pick a backend.

**Inherited project conventions** (per repo `CLAUDE.md` and `.claude/rules/`):
- TypeScript, relative imports only (no `@/` path aliases), `type` over `interface`, named exports, Bun toolchain, ShadCN + Tailwind v4, Zod for validation, no React Context (Zustand + TanStack Query for state).

### 3.4 Pain Points with Existing Systems

Synthesized from `plan-docs/long-term-goals.md`, `plan-docs/audit-follow-up.md`, `docs/audit/AUDIT-BACKLOG.md`, and the existing ITUN codebase:

1. **Composability not honored** — The current data model assumes `pilot → owns → mech` and `crawler → contains → pilots`. Building a standalone mech, a standalone pilot, or a standalone crawler requires phantom parents. The shared-link/share-with-friend story breaks because there is no shareable single-entity view.

2. **Cloud-first / auth-required friction** — A visitor cannot try the builder without creating an account. For a creative single-player tool whose primary use case is "let me build a mech in 10 minutes," account-creation is a meaningful drop-off.

3. **Scope-vs-capacity mismatch** — 22 P0–P4 gameplay gaps are catalogued (action execution, damage flow, heat management, downtime wizard, pushing, crafting, salvage, ability training, etc.). Shipping the full multiplayer-manager vision is not viable for a solo maintainer at the current quality bar.

4. **Tech-debt drag** — `usePilotSheet` is a 405-line "god hook"; seven race conditions block reliable multiplayer (`createGame`, `createPilot`, `createCrawler`, `instantiateMechFromPattern`, `updateMechEntityRefs`, `updateCrawlerWeapon`, `joinGame`); the reference package eager-loads ~1.4 MB of JSON at import time. Each is a load-bearing refactor before any feature work compounds.

5. **No print path** — The current sheet view is screen-only. Players who want a paper sheet at the table fall back to Google Docs or PDFs.

6. **No standalone share** — Sharing a character today implies inviting someone into a campaign. There is no read-only public URL for a build.

7. **Mobile sheet ergonomics** — The current sheet is responsive but not designed for at-the-table phone use under glare conditions. Sheet display is the highest-frequency view and the weakest WCAG candidate.

8. **Mediator / GM ambition burden** — Half-built GM features (campaign archiving UI, invite codes without join flow, no NPC tracking despite reference data existing) add maintenance surface without delivering complete value.

9. **Data model coupled to backend** — Domain logic and Supabase schemas are entangled. Switching backends or going local-first today would touch nearly every module.

### 3.5 Competitive Landscape

| Tool | Audience | Strengths | Weaknesses (vs. proposed ITUN) |
| :--- | :--- | :--- | :--- |
| **Current ITUN (legacy)** | SU campaign players + GMs | Real-time sync, RLS, condition tracking, broad mechanic coverage on paper | Auth-required; cloud-first; pilot-owns-mech model; unfinished combat / downtime; tech debt; no print; no public share link |
| **Community Google Docs / spreadsheets** | Individual SU players | Zero friction; print-friendly; collaborative via Google share | Rule-unaware; no capacity enforcement; no roll-table integration; no entity cross-references; manual everything |
| **Roll20 SU sheets / Foundry SU module** | VTT-using groups | Integrated with VTT play; dice + canvas | Locked to host VTT; standalone share not native; not print-first; not free |
| **Official + fan-made PDF sheets** | All SU players | Print-perfect; no software dependency; canonical layout | Static; not interactive; no rule-enforcement; no save/share-link |
| **`suref-web` (sibling app)** | Anyone browsing SU rules | Best-in-class SU reference site; canonical data; great UX | Reference-only; not a builder; explicitly different concern (ITUN complements, doesn't replace) |

**Market gaps the Revamp targets:**

- **Composability gap** — No tool treats pilot/mech/crawler as independently first-class buildable entities. Every other tool either forces a full party or accepts unstructured docs.
- **Friction gap** — No SU-specific tool is account-optional *and* link-shareable *and* print-quality. Each tool nails ≤ 2 of those three.
- **Data-quality gap** — Only ITUN and `suref-web` are backed by `salvageunion-reference`. Community spreadsheets drift from canonical data; PDFs go stale with each errata.

**Differentiation thesis:** The Revamp wins on the underserved intersection of *no-account friction*, *composability*, *link-shareable snapshots*, and *print-quality output*, anchored to the project's data-quality moat (`salvageunion-reference`). It does *not* try to be a VTT, a multiplayer campaign manager (in MVP), or a GM screen — those are upgrade-path territory or other tools' lane.

**Key takeaways:**
- Primary competitor in the medium term is **the current ITUN itself** (legacy). The Revamp must ship something the maintainer will themselves switch to.
- Strongest threat to differentiation is **scope creep** — every multiplayer / GM / live-combat feature pulled into MVP weakens the friction-free single-player position.
- Strongest opportunity for compounding value is **`salvageunion-reference` reuse** — every additional consumer of that package improves the data layer's maintenance economics.

<!-- Sections 4.0–8.0 populated by downstream waves (requirements, prd-verify). -->

## 4.0 Target Audience & Personas

_To be populated by Wave 3 (prd-verify)._

## 5.0 Key Features & Requirements

_To be populated by Wave 2 (requirements) with REQ-NNN IDs and MoSCoW priorities._

## 6.0 Verification & Validation

_To be populated by Wave 3 (prd-verify)._

## 7.0 Risks, Assumptions, & Mitigations

_To be populated by Wave 3 (prd-verify)._

## 8.0 Appendix

### 8.1 Glossary

_To be populated by Wave 3 (prd-verify)._

### 8.2 References

_To be populated by Wave 3 (prd-verify)._

### 8.3 Requirements Traceability

_To be populated by Wave 2 (requirements)._
