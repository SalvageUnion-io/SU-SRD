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

### 5.1 Functional Requirements

Requirements grouped by MoSCoW priority. User-story format `As a [persona], I want [goal] so that [benefit]`. Acceptance criteria use Given/When/Then where applicable. Primary persona is the **Individual Player** (see §4.0).

#### Must-Have (MVP — required for first release)

**Composability — independent first-class entities**

- **REQ-001 — Build a standalone pilot.** *As an individual player, I want to build just a pilot (no mech, no crawler) so that I can join someone else's game without designing equipment I'll never use.* GIVEN I open the builder, WHEN I choose "new pilot," THEN I can complete a full pilot (class, abilities, equipment, roll-table results, motto/keepsake/appearance) without ever being prompted for mech or crawler details. Priority: **Must**.

- **REQ-002 — Build a standalone mech.** *As an individual player, I want to build just a mech (with an auto-generated stand-in pilot record) so that I can sketch a chassis loadout for a one-shot or share a build concept.* GIVEN I choose "new mech," WHEN I complete chassis + systems + modules + cargo, THEN the resulting build is saveable, shareable, and printable on its own. Priority: **Must**.

- **REQ-003 — Build a standalone crawler.** *As an individual player (typically running or contributing to one), I want to build just a crawler so that the table can share a single canonical crawler regardless of which pilots are assigned.* Priority: **Must**.

- **REQ-004 — Wire entities together via soft links.** *As a player who has built multiple entities, I want to assign a mech to a pilot and a pilot to a crawler without those links being ownership-enforcing.* GIVEN a saved pilot and a saved mech exist independently, WHEN I link them, THEN the link is a reference both can dereference; deleting one does not delete the other. Priority: **Must**.

- **REQ-005 — Auto stand-ins for missing entities.** *As a player viewing a standalone mech sheet, I want the sheet to render cleanly even without a pilot record so that I can read the sheet without dummy data leaking in.* GIVEN a build has only a mech, WHEN the sheet renders, THEN pilot-derived fields show a clear "no pilot assigned" stand-in (not blanks, not dummy stats). Priority: **Must**.

**Persistence — local-first**

- **REQ-006 — Local-first persistent storage.** *As a player, I want my builds to persist across browser sessions without an account so that I can return to my work later.* GIVEN I save a build, WHEN I close and reopen the browser, THEN my builds are still listed. Implementation: IndexedDB or equivalent. Priority: **Must**.

- **REQ-007 — Offline-tolerant.** *As a player, I want the builder to keep working when I lose network so that I can keep building in transit or at a poor-connectivity table.* GIVEN I have loaded the app once, WHEN I go offline, THEN all build/edit/save/load operations continue to work; only snapshot publishing requires network. Priority: **Must**.

- **REQ-008 — Delete a saved build.** *As a player, I want to delete builds I no longer want.* Priority: **Must**.

**Building — rule-aware**

- **REQ-009 — Capacity and budget enforcement.** *As a player, I want the builder to block me from exceeding slot counts, cargo capacity, and scrap budgets so that I can trust my finished build is rules-legal.* GIVEN I am building a mech, WHEN I attempt to add a system that exceeds remaining slots, THEN the action is blocked with a clear explanation. Priority: **Must**.

- **REQ-010 — Roll tables in pilot creation.** *As a player, I want the pilot wizard to offer randomized rolls for callsign, background, motto, keepsake, and appearance so that I can ground my character in the SU tone without leaving the app.* Priority: **Must**.

- **REQ-011 — Equipment condition tracking.** *As a player, I want to mark mech systems / modules / pilot equipment as intact / damaged / destroyed so that my sheet reflects the current narrative state.* Priority: **Must**.

- **REQ-012 — Edit-with-soft-warnings progression.** *As a player advancing my character between sessions, I want to freely edit any field on a saved build, with the app warning me when an edit appears to violate the published rules.* GIVEN I edit a saved pilot to add an ability normally locked at higher level, WHEN I save, THEN the app surfaces a warning ("this ability is normally locked until level 4"), allows me to confirm, and persists the change. Priority: **Must**.

- **REQ-013 — Mech pattern system.** *As a player, I want to save a completed mech build under a name and instantiate copies of it so that I can share or reuse mech designs.* Priority: **Must**.

- **REQ-014 — Capacity calculation for cargo.** *As a player, I want cargo capacity computed correctly across custom and reference-linked items.* Priority: **Must**.

- **REQ-015 — Scrap inventory by tech-level tier.** *As a player, I want to track scrap by tier (TL1–TL6) and have the app handle inter-tier translation per the rules.* Priority: **Must**.

**Sheet — live-tracking (manual)**

- **REQ-016 — Manual stat editing on the sheet.** *As a player at the table, I want to click on HP / AP / TP / SP / EP / Heat and edit the current value directly so that I can keep the sheet in sync during play.* No action-button automation. No damage flow. Priority: **Must**.

**Sharing**

- **REQ-017 — Publish a build as an anonymous snapshot.** *As a player, I want to publish a build and receive a short URL so that I can share it via Discord, text, or forum.* GIVEN a build is finished, WHEN I publish, THEN I receive a short URL identifying an immutable snapshot. No account required. Priority: **Must**.

- **REQ-018 — Open a published snapshot.** *As any recipient (no account, no install), I want to open a snapshot URL and view the build in read-only form.* Priority: **Must**.

- **REQ-019 — Print-quality character sheet (A4 + US Letter).** *As a player who plays at a physical table, I want to print my build's character sheet at professional fidelity on either A4 or US Letter so that I can run a game without a screen.* Print stylesheet is a first-class deliverable. Priority: **Must**.

**Organization**

- **REQ-020 — Workspace-per-campaign grouping.** *As a player tracking multiple table contexts, I want to group my builds under a named workspace (e.g., "Monday night campaign") without that workspace being a multiplayer construct.* Priority: **Must**.

**Reference**

- **REQ-021 — Contextual in-line SU reference.** *As a player making a build choice, I want to see the relevant SU entity (chassis, ability, equipment item) inline as I choose it, with tooltips for nested references.* No full SRD-browsing UI inside ITUN — deep-link to `suref-web` for that. Priority: **Must**.

#### Should-Have (high-value, not blocking MVP)

- **REQ-022 — Crawler tech-level upgrade flow.** *As a player progressing a crawler, I want to upgrade tech level by spending scrap, with soft warnings if I appear to violate the upgrade rules.* Priority: **Should**.

- **REQ-023 — Comrade / drone display.** *As a player whose mech has comrades or drones (via entity refs), I want them displayed on the sheet with their actions and EP tracking.* Priority: **Should**.

- **REQ-024 — Export build as JSON.** *As a player, I want to download my build as a JSON file so that I own my data and can back it up.* Priority: **Should**.

- **REQ-025 — Import build from JSON.** *As a player, I want to load a JSON file into my workspace.* Priority: **Should**.

- **REQ-026 — Pattern publishing.** *As a player who designs interesting mech patterns, I want to publish a pattern as an anonymous snapshot so that others can clone it as a starting point.* Priority: **Should**.

#### Could-Have (nice-to-have for MVP, easily deferred)

- **REQ-027 — Generic dice roller helper.** *As a player at the table, I want a basic d20 roller for actions and skill checks.* Priority: **Could**.

- **REQ-028 — Snapshot QR code.** *As a player at a physical table, I want a QR code rendering of a snapshot URL so that someone can scan a sheet on my phone and pull it up on theirs.* Priority: **Could**.

### 5.2 Non-Functional Requirements

Organized by quality attribute (per ISO/IEC/IEEE 29148 §4).

**Performance**

| REQ-ID | Requirement | Measurement | Target | Priority |
| :----- | :--- | :--- | :--- | :--- |
| REQ-NF-01 | Initial page load (Time-to-Interactive) | Lighthouse on broadband desktop | ≤ 3.0 s | Must |
| REQ-NF-02 | Local save latency | Time from user action to IndexedDB write | ≤ 100 ms | Must |
| REQ-NF-03 | Mobile interactive scroll | Frame budget on iPhone-class device | Maintains 60 FPS on sheet view | Should |

**Security**

| REQ-ID | Requirement | Measurement | Target | Priority |
| :----- | :--- | :--- | :--- | :--- |
| REQ-NF-04 | Snapshot publish rate-limit | Backend per-IP rate limiting | Reasonable cap to deter spam (e.g., 30/hour/IP — exact value set in architecture phase) | Must |
| REQ-NF-05 | Snapshot immutability | Functional test: attempt PATCH on published URL | Returns 405; snapshot content cannot mutate post-publish | Must |
| REQ-NF-06 | No PII collected | Audit of data model + telemetry | Anonymous publishing collects no identifying user data | Must |

**Reliability & Availability**

| REQ-ID | Requirement | Measurement | Target | Priority |
| :----- | :--- | :--- | :--- | :--- |
| REQ-NF-07 | Offline operation post-load | Manual test: load, go offline, build | All non-publish features functional offline | Must |
| REQ-NF-08 | Snapshot publish idempotency | Same build published twice produces resolvable but distinct URLs (or returns same URL — decided in architecture) | Either behavior is acceptable; the surprise mode (silent overwrite) is not | Must |
| REQ-NF-09 | Snapshot retention | Backend lifecycle policy | Snapshots persist ≥ 1 year from publish; longer-term retention decided in architecture | Should |

**Usability**

| REQ-ID | Requirement | Measurement | Target | Priority |
| :----- | :--- | :--- | :--- | :--- |
| REQ-NF-10 | Sheet display accessibility | `a11y-scan` CI run | Zero WCAG 2.1 AAA violations on sheet view | Must |
| REQ-NF-11 | Non-sheet accessibility | `a11y-scan` CI run | Zero WCAG 2.1 AA violations on all other views | Must |
| REQ-NF-12 | Mobile touch targets | Manual + axe audit | ≥ 44 × 44 px for primary actions on sheet view | Must |
| REQ-NF-13 | Print fidelity — A4 | Visual review of print preview | Professional print rendering | Must |
| REQ-NF-14 | Print fidelity — US Letter | Visual review of print preview | Professional print rendering | Must |
| REQ-NF-15 | Mobile-responsive viewport | Visual test at 320 px and up | No horizontal scroll, no clipped controls | Must |
| REQ-NF-16 | Browser support | Manual matrix test | Evergreen Chrome, Firefox, Safari ≥ 16, Edge | Must |
| REQ-NF-17 | First-build time-to-completion | Maintainer-run timing study | ≤ 10 minutes for a fresh visitor to complete and save a pilot | Should |

**Maintainability**

| REQ-ID | Requirement | Measurement | Target | Priority |
| :----- | :--- | :--- | :--- | :--- |
| REQ-NF-18 | Shared UI reuse | Code review | All cross-cutting UI from `suref-react`; no parallel reimplementations in ITUN | Must |
| REQ-NF-19 | Single source of game data | Code review | All game data accessed via `salvageunion-reference`; no inline copies | Must |
| REQ-NF-20 | Project conventions adhered | `bun run check:all` + manual code review | Relative imports, `type` over `interface`, named exports, no React Context, ShadCN + Tailwind v4, Zustand + TanStack Query | Must |
| REQ-NF-21 | Test coverage on rule-enforcement | `bun --filter in-the-union-now test` | All rule-enforcement utilities (capacity, scrap, soft-warning rules) have unit tests; sheet rendering has smoke tests | Should |
| REQ-NF-22 | Lefthook pre-commit + pre-push hooks pass | CI | Pre-commit (lint, format, typecheck) and pre-push (test, validate) pass on every commit | Must |

### 5.3 Key Integrations

| System | Purpose | Interface | Constraint |
| :--- | :--- | :--- | :--- |
| `salvageunion-reference` (workspace package) | Canonical SU game data + Zod schemas + TS ORM | TypeScript imports | Must remain the sole game-data source. Build step required (`bun run build:package`) before app build. |
| `suref-react` (workspace package) | Shared UI component library (theme, typography, entity displays, primitives) | TypeScript imports (no build step) | Must remain the sole shared-UI source. No fork. Components that prove generally useful should be promoted up from ITUN into `suref-react`. |
| `suref-web` (sibling app, deployed separately) | Full SRD browsing | Deep links (URL hand-off) | ITUN does not duplicate `suref-web`'s browsing UI; ITUN links out for full entity browsing. |
| Snapshot publishing backend (TBD) | Anonymous publish + immutable retrieval by short URL | HTTPS POST to publish, GET by short URL to retrieve | Architecture phase decides backend (Supabase Edge Functions, Cloudflare Workers + KV, Turso, Netlify Functions + Blobs, etc.). PRD records the requirement; not the implementation. |
| Local browser storage | Primary persistence | IndexedDB (or `localStorage` for trivial state) | Local-first principle: every feature except snapshot publish must work without backend reachability. |

### 5.4 Out of Scope (Won't-Have, this iteration)

Each item below was *explicitly* deferred during discovery Q&A. Items remain candidates for the architectural upgrade path.

- **REQ-W-01 — Real-time multiplayer / live sync / RLS.** *Rationale:* MVP is single-player. Architecture must not foreclose multiplayer, but no multi-user features ship in MVP.
- **REQ-W-02 — User accounts and authentication.** *Rationale:* Anonymous snapshot publishing meets the share requirement without an account. A magic-link or full-auth layer is upgrade-path territory.
- **REQ-W-03 — GM / Mediator tools.** *Rationale:* MVP is player-only. NPC stats, encounter staging, faction tracking, rumor systems are all out. The legacy ITUN's partial GM features are not migrated.
- **REQ-W-04 — Active combat tracking.** *Rationale:* No action buttons that decrement AP/EP/HP/Heat. No automated damage flow. No heat-link from actions. The sheet shows current values; the player updates them. Tracked as "P0 gap" in `plan-docs/long-term-goals.md` but explicitly deferred.
- **REQ-W-05 — Guided downtime / progression wizards.** *Rationale:* Edit-with-soft-warnings (REQ-012) covers progression; full wizards are upgrade-path.
- **REQ-W-06 — Campaign-shared workspaces.** *Rationale:* Workspaces (REQ-020) are private to the owner in MVP. Multiplayer-shared workspaces require the auth + sync layers that are out of scope.
- **REQ-W-07 — Discord bot changes.** *Rationale:* `apps/discord-bot/` is a separate concern; PRD does not scope it.
- **REQ-W-08 — Full SRD reference duplication inside ITUN.** *Rationale:* `suref-web` is the canonical SRD reader; ITUN provides contextual reference only (REQ-021).
- **REQ-W-09 — Image uploads.** *Rationale:* Image hosting requires storage infrastructure (S3-class or Supabase Storage). URL inputs are acceptable for MVP cosmetic fields.
- **REQ-W-10 — Vehicle / faction / bio-titan / NPC encounter tracking.** *Rationale:* GM-facing; explicitly out per REQ-W-03.
- **REQ-W-11 — Free-tier hosting cap.** *Rationale:* User declined this as a hard constraint. Cost-conscious choices preferred, but not a binding requirement.
- **REQ-W-12 — Migration of legacy ITUN data.** *Rationale:* Legacy ITUN has zero real users. Supabase project is decommissioned without data migration.

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

| REQ-ID | Description | Priority |
| :----- | :--- | :--- |
| REQ-001 | Build a standalone pilot | Must |
| REQ-002 | Build a standalone mech | Must |
| REQ-003 | Build a standalone crawler | Must |
| REQ-004 | Wire entities together via soft links | Must |
| REQ-005 | Auto stand-ins for missing entities | Must |
| REQ-006 | Local-first persistent storage | Must |
| REQ-007 | Offline-tolerant operation | Must |
| REQ-008 | Delete a saved build | Must |
| REQ-009 | Capacity and budget enforcement | Must |
| REQ-010 | Roll tables in pilot creation | Must |
| REQ-011 | Equipment condition tracking | Must |
| REQ-012 | Edit-with-soft-warnings progression | Must |
| REQ-013 | Mech pattern system | Must |
| REQ-014 | Cargo capacity calculation | Must |
| REQ-015 | Scrap inventory by tech-level tier | Must |
| REQ-016 | Manual stat editing on the sheet | Must |
| REQ-017 | Publish a build as an anonymous snapshot | Must |
| REQ-018 | Open a published snapshot | Must |
| REQ-019 | Print-quality character sheet (A4 + US Letter) | Must |
| REQ-020 | Workspace-per-campaign grouping | Must |
| REQ-021 | Contextual in-line SU reference | Must |
| REQ-022 | Crawler tech-level upgrade flow | Should |
| REQ-023 | Comrade / drone display | Should |
| REQ-024 | Export build as JSON | Should |
| REQ-025 | Import build from JSON | Should |
| REQ-026 | Pattern publishing | Should |
| REQ-027 | Generic dice roller helper | Could |
| REQ-028 | Snapshot QR code | Could |
| REQ-NF-01 | Initial page load TTI ≤ 3 s | Must |
| REQ-NF-02 | Local save latency ≤ 100 ms | Must |
| REQ-NF-03 | Mobile 60 FPS sheet scroll | Should |
| REQ-NF-04 | Snapshot publish rate-limit | Must |
| REQ-NF-05 | Snapshot immutability | Must |
| REQ-NF-06 | No PII collected | Must |
| REQ-NF-07 | Offline operation post-load | Must |
| REQ-NF-08 | Snapshot publish idempotency | Must |
| REQ-NF-09 | Snapshot retention ≥ 1 year | Should |
| REQ-NF-10 | WCAG 2.1 AAA for sheet display | Must |
| REQ-NF-11 | WCAG 2.1 AA elsewhere | Must |
| REQ-NF-12 | Mobile touch targets ≥ 44 px | Must |
| REQ-NF-13 | A4 print fidelity | Must |
| REQ-NF-14 | US Letter print fidelity | Must |
| REQ-NF-15 | Mobile-responsive viewport from 320 px | Must |
| REQ-NF-16 | Evergreen browser support (Safari ≥ 16) | Must |
| REQ-NF-17 | Time-to-first-completed-pilot ≤ 10 min | Should |
| REQ-NF-18 | Shared UI exclusively via `suref-react` | Must |
| REQ-NF-19 | Game data exclusively via `salvageunion-reference` | Must |
| REQ-NF-20 | Adherence to project conventions | Must |
| REQ-NF-21 | Test coverage on rule-enforcement | Should |
| REQ-NF-22 | Lefthook hooks pass on every commit | Must |
| REQ-W-01 | No real-time multiplayer | Won't (this iteration) |
| REQ-W-02 | No user accounts / auth | Won't (this iteration) |
| REQ-W-03 | No GM / Mediator tools | Won't (this iteration) |
| REQ-W-04 | No active combat automation | Won't (this iteration) |
| REQ-W-05 | No guided downtime / progression wizards | Won't (this iteration) |
| REQ-W-06 | No campaign-shared workspaces | Won't (this iteration) |
| REQ-W-07 | Discord bot out of scope | Won't (this iteration) |
| REQ-W-08 | No full SRD duplication | Won't (this iteration) |
| REQ-W-09 | No image uploads | Won't (this iteration) |
| REQ-W-10 | No vehicle / faction / NPC tracking | Won't (this iteration) |
| REQ-W-11 | No free-tier hosting cap | Won't (this iteration) |
| REQ-W-12 | No legacy data migration | Won't (this iteration) |
