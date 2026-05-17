# AUDIT — Ideate Pipeline Q&A Record

> Debug artifact. Records source inventory and all clarifying Q&A from the ideate pipeline run.

**Run context:**
- Branch: `yitun-revamp` (off `main`)
- Project type: **brownfield** — existing "You're in the Union Now" (ITUN) app being re-evaluated; user has declared current implementation disposable but reusable shared packages (`suref-react`, `salvageunion-reference`) remain in scope.
- Execution mode: **interactive** (explicit user request for Q&A)
- Date: 2026-05-17

---

## Discovery
_Completed: 2026-05-17_

### Source Inventory

| File | Classification | Key Content |
|------|---------------|-------------|
| `apps/in-the-union-now/` (entire app) | Existing implementation (brownfield) | React 19 + Vite + TanStack Router/Query + Zustand + ShadCN + Tailwind v4 + Supabase. 26 implemented mechanics covering pilot/mech/crawler creation, pattern system, capacity enforcement, condition tracking, live stats, cargo, scrap, realtime sync, change log, comrades, member roster, RLS. |
| `apps/in-the-union-now/README.md` | Project readme | Stack overview, dev commands |
| `apps/in-the-union-now/CLAUDE.md` | Project conventions | Supabase project `dshtuchbleipwqacyokz`, tables, enums, conventions |
| `apps/in-the-union-now/plan-docs/phase-{1..6}` + `phase-5II-multiplayer-polish/` | Internal planning docs | Phased implementation history: foundation → pattern builder → pilot/mech → crawler/campaign → invites/roles → multiplayer/live-play polish |
| `plan-docs/long-term-goals.md` | Gap analysis | 22 catalogued gaps tiered P0–P4; priority matrix. Top: action execution, downtime flow, heat, damage application, ability training |
| `plan-docs/audit-follow-up.md` | Tech-debt audit | 7 race conditions identified; split `usePilotSheet` (405 lines); eager-load critique |
| `docs/architecture/rules-engine-boundary.md` | ADR | ITUN enforces *economic constraints*, NOT *procedural adjudication*. Honor system for combat (ADR-001) |
| `docs/architecture/combat-loop.md` | Architecture | Combat-loop design (heat, damage, push, salvage) |
| `docs/architecture/data-flow.md` | Architecture | Reference data + player data hydration patterns |
| `docs/architecture/display-system.md` | Architecture | Three-layer rendering: DisplayCard → ReferenceEntityDisplay → consumer |
| `docs/architecture/package-contracts.md` | Architecture | Package APIs + dependency graph + cross-package change checklist |
| `docs/audit/AUDIT-BACKLOG.md` | Cleanup backlog | 69-finding prioritized backlog; epics + stories; GitHub project linked |
| `packages/suref-react/` | **Reusable asset** | Shared React component library — theme, typography, entity display system, modal, roll table. No build step. No Supabase dep. Explicitly preserved. |
| `packages/salvageunion-reference/` | **Reusable asset** | TypeScript ORM + Zod schemas + JSON dataset for all SU game data (~26 schemas). Explicitly preserved. |

### Classification Notes

- **Source type:** All materials are first-party project artifacts authored by the user/team. There are no third-party stakeholder transcripts. All extracted content treated as authoritative user intent. Older planning docs (e.g., phase-5II multiplayer plans) reflect superseded direction per user memory and the explicit disposability declaration.
- **Brownfield signals (all present):** existing codebase ✓, existing roadmap ✓, ADRs ✓.
- **Disposability declaration:** Current ITUN app + its Supabase project (`dshtuchbleipwqacyokz`) are explicitly disposable. `suref-react` and `salvageunion-reference` are explicitly preserved.

### Q&A Log

_Strategic-scope Q&A — 16 questions across 4 batches._

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | Primary user for the smaller-shipped-sooner MVP? | **Individual player (self-managed sheet)** | MVP is solo-player-first. GMs and party use cases are upgrade-path. |
| 2 | Single most valuable thing the MVP must do well? | **Build and save a character at *each level*** — mech with stand-in pilot, pilot alone, standalone crawler, or fully wired pilot+mech+crawler. | Character-builder is the core. Pilot, mech, and crawler are independently first-class. |
| 3 | Time-to-ship target? | **No hard deadline — quality over speed** | Avoid calendar-driven scope cuts. Set quality bar instead. |
| 4 | Long-term ambition the MVP should leave an upgrade path toward? | **Full ITUN multiplayer manager** (the current YITUN vision) | MVP is the first slice of the existing mountain; design choices must not foreclose multiplayer. |
| 5 | Composition model — what does "build at each level" mean? | **Composable with auto-stand-ins** — pilot/mech/crawler are three independent top-level entities; building one alone auto-supplies a "generic" record for siblings so the sheet renders cleanly. | Data model is *not* parent-owns-child (current ITUN). Each entity is independently shareable. |
| 6 | Which existing ITUN building features to keep in MVP? (multi) | **All four kept**: Mech pattern system, capacity/budget enforcement, roll tables (pilot creation), condition tracking | Capacity enforcement remains a core differentiator. Patterns survive. Condition tracking remains a build/sheet-time concern. |
| 7 | Explicitly out-of-scope for MVP? (multi) | Out: **multiplayer/realtime/live-sync**, **GM/Mediator tools**. NOT out (kept implicitly): active combat tracking, campaign/downtime progression. User note: *"We should be able to upgrade, but with limited restrictions."* | MVP is solo and player-only. Some form of upgrade/progression is in scope (clarified in Q9). Live combat clarified in Q10. |
| 8 | App name / codename? | **Keep 'In The Union Now' / 'ITUN'** — replace existing app under same name | Existing app becomes legacy (Q12). New app inherits the name. |
| 9 | Progression scope (re: "upgrade with limited restrictions")? | **Edit-with-soft-warnings** — free editing of saved builds, app warns when changes violate rules, player can override | No guided wizards required. No hard rule-enforcement. Trust the player; surface the rules. |
| 10 | In-session / live-play scope? | **Sheet only — view + manual stat edits** | Sheet shows live stats and condition toggles; no action-button automation, no damage flow, no heat-link. Live combat is upgrade-path. |
| 11 | Sync backend preference (if added later)? | **Defer to architecture phase** | PRD records the requirement; architecture picks Supabase vs. local-first sync vs. lightweight blob storage. |
| 12 | Handling existing `apps/in-the-union-now/` and Supabase data? | **Archive existing app to `apps/itun-legacy/`, delete Supabase** | User-confirmed: legacy ITUN has **zero real users**. No migration path needed. Legacy code stays accessible for cherry-picking patterns. Supabase project (`dshtuchbleipwqacyokz`) decommissioned. |
| 13 | Share-link mechanism? | **Backend snapshot** — publish creates an immutable record at a short URL | Implies MVP needs *some* server-side surface (publish + fetch by short URL) even before full sync. Local-first storage stays primary; publish is a separate one-way action. |
| 14 | How users browse SU game data inside ITUN? | **Contextual reference only** — inline entity displays during builds + tooltips | ITUN does NOT duplicate `suref-web` browsing. Deep links to `suref-web` for full SRD navigation. |
| 15 | Multi-build management UX? | **Workspace per campaign** — pilots/mechs/crawlers loosely grouped under a named workspace | Introduces a "workspace" layer above raw entities. Workspace is a soft grouping (not a full multiplayer campaign). |
| 16 | Is `apps/discord-bot/` in PRD scope? | **Out of scope — separate concern** | Discord bot stays as-is. Future integration decided separately. |
| 17 | Identity model for snapshot publishing? | **Anonymous publishing — no account required** | Snapshots get a short URL, no owner. Local-first IndexedDB holds the editable copy. Trade-off: no "my published snapshots" list, no deletion-by-author. |
| 18 | Accessibility target? | **WCAG 2.1 AAA for sheet display** (AA elsewhere implied) | Sheet view is the hot path — read at the table on a phone, often under poor lighting. Push the bar higher. CI a11y-scan job already exists. |
| 19 | Remaining hard constraints? (multi) | **A4 + US Letter print quality required**; **evergreen browsers only — drop Safari < 16** | Not selected: free-tier hosting cap, must-deploy-on-Netlify. Implies modern CSS / View Transitions / etc. are fair game. |

---

## Competitors
_Completed: 2026-05-17. Synthesis-only mode (no third-party transcripts to extract from)._

**Method note:** No stakeholder interview transcripts exist for this run. All source materials are first-party project artifacts authored by the user. The traditional competitors extraction workflow (verbatim quoting from customer voice) does not apply. Instead, competitive landscape was synthesized from:

1. The Synthesized Discovery (§ above) — the user's own framing of the SU tool landscape from strategic Q&A.
2. `plan-docs/long-term-goals.md` — explicit comparison of current ITUN vs. intended scope.
3. `apps/in-the-union-now/README.md` + `CLAUDE.md` — current ITUN's positioning.
4. Inherited project knowledge of the Salvage Union community tooling space (Google Docs, Roll20, Foundry, PDF sheets, `suref-web`).

**Speaker attribution:** Single-speaker (the user) for all extracted content. No Claude-turn / agent-turn lines were promoted to PRD voice. Where the PRD says "the user wants X", the source is either an explicit Q&A answer in the Q&A log above or a written assertion in `plan-docs/`.

**PRD sections written:**
- 1.0 Document Overview — metadata scaffold
- 2.0 Executive Summary (initial — refined by opportunity below)
- 3.0 Background & Strategic Fit
- 3.5 Competitive Landscape — five-tool comparison table; market gaps; differentiation thesis; key takeaways

**Section Ownership Validation:** Wrote only to 1.0, 2.0 (initial), 3.0, 3.5. No out-of-bounds writes.

---

## Knowledge
_Completed: 2026-05-17. Synthesis-only mode._

**Method note:** "Knowledge" in the canonical workflow means unwritten operational expertise extracted from stakeholder transcripts. For this brownfield rebuild, the equivalent is **operational pain points the maintainer has personally encountered and documented in plan-docs / audit-followup / the codebase itself**. Sources synthesized:

1. `plan-docs/long-term-goals.md` — 22 catalogued P0–P4 gaps; priority matrix; race conditions.
2. `plan-docs/audit-follow-up.md` — completed sessions + remaining tech debt (god hooks, eager loading, race conditions).
3. `docs/audit/AUDIT-BACKLOG.md` — 69-finding prioritized cleanup backlog.
4. `docs/architecture/rules-engine-boundary.md` — the codified ADR-grade decision: ITUN enforces economic constraints, not procedural adjudication.
5. The Synthesized Discovery's user-perspective success criteria.

**Speaker attribution:** Same as Competitors. Single-speaker, all first-party authoritative content.

**PRD sections written:**
- 3.1 Problem Statement (synthesized user-perspective frustrations)
- 3.4 Pain Points with Existing Systems (9 catalogued pain points with citations)

**Section Ownership Validation:** Wrote only to 3.1, 3.4. No out-of-bounds writes.

---

## Opportunity
_Completed: 2026-05-17. Synthesis-only mode._

**Method note:** Strategic opportunity assessment grounded in:

1. The cross-product of identified market gaps (§3.5) and user-stated success criteria (Discovery synthesis).
2. The maintainer's explicit framing in Q&A #2–#4: smaller, more useful, sooner, with an upgrade path to the original ambition.
3. The `salvageunion-reference` data-layer moat — identified as the project's strongest compounding asset.

**Speaker attribution:** Same as above. Single-speaker, first-party.

**PRD sections written:**
- 3.2 Goal & Opportunity (focused single-player builder; multiplayer-ready foundation; "why now" rationale)
- 2.0 Executive Summary (refinement — vision/scope statement; explicit MVP vs. upgrade-path partition; success-metrics table)

**Section Ownership Validation:** Wrote only to 3.2 and refinements to 2.0. No out-of-bounds writes.

---

### Synthesized Discovery

# Discovery: In The Union Now (ITUN) — Revamp

> Synthetic source document produced through structured discovery Q&A.
> The current ITUN web app is the *intake source*; the user has declared it disposable and wants a re-evaluated, scope-disciplined replacement.

## Project Context

**Client / org:** alxjrvs (solo developer, Salvage Union community tooling).
**Project name:** In The Union Now (ITUN) — name preserved across the rebuild.
**Working title for the rebuild effort:** "ITUN Revamp" (branch: `yitun-revamp`).
**Type:** **Brownfield rebuild** — existing app at `apps/in-the-union-now/` is being archived to `apps/itun-legacy/` and replaced by a greenfield app under the same name. Reusable shared packages (`suref-react`, `salvageunion-reference`) are preserved.
**What prompted it:** The current ITUN has grown in scope beyond what its single maintainer can ship at quality. The user wants to ship a smaller, more useful tool *sooner*, while preserving a credible upgrade path back toward the original full-multiplayer ambition. Strategic insight: **a focused single-player builder is more useful than a half-built multiplayer manager**.

## Problem Space

**Problem definition:** Salvage Union players today lack a quality digital character-building tool that respects the game's composability — they may want to build *just a mech* for a one-shot, *just a pilot* for joining someone else's campaign, *just a crawler* for the GM's settlement, or fully-wired pilot+mech+crawler combinations. Existing tools (and current ITUN itself) over-index on "campaigns of fully wired-up parties," which creates friction for these legitimate single-entity workflows. The composability gap is also a **share-friction gap**: a friend asking "what does your mech look like?" should be answerable with a single link to *just* the mech.

**Who experiences it:** Individual SU players — especially those who build mechs/pilots/crawlers as a creative exercise outside of an active campaign, or who want to share a build standalone (Discord, forum, friend group).

**Current state:** ITUN today requires the cloud, requires auth, requires a campaign context, and aims at full real-time multiplayer manager. Quality-per-feature is suffering as scope outpaces capacity. 22 P0–P4 gaps catalogued in `plan-docs/long-term-goals.md`. 7 race conditions blocking reliable multiplayer (per audit follow-up).

**Severity:** Significant for the maintainer (capacity-bound, can't ship the full vision). Moderate for users (existing tools are functional but friction-laden; this is creative tooling, not critical infrastructure).

## Target Users & Stakeholders

**Primary user (MVP):** Individual Salvage Union player building characters for their own use, sharing with friends or a GM, or just for fun.

**Secondary (upgrade path, NOT MVP):** GMs running campaigns; parties of players in shared multiplayer sessions. Architecture must not foreclose these.

**Explicit non-users for MVP:** GMs running encounters; party-shared real-time sessions; campaign managers.

**Success criteria from user perspective:**
- "I can sit down and build a mech in 10 minutes without making an account."
- "I can share my pilot with a Discord friend via one short URL."
- "I can print a clean sheet for table use on A4 or US Letter."
- "I can build any combination — mech-only, pilot-only, crawler-only, or fully wired — and each looks right."
- "If I want to track conditions during play, the sheet supports that. If I just want a snapshot, that's also fine."

## Competitive Landscape

**Implicit competitors:**
- **The current ITUN itself** (the legacy version) — full-featured but unfinished.
- **Salvage Union community spreadsheets / Google Docs** — common workaround. Print-friendly, no special features.
- **Generic VTT character sheets** (Roll20, Foundry SU module) — usable but inside a VTT context, not standalone.
- **PDF character sheets** (official + fan-made) — paper-first; no link sharing or rule-enforcement.
- **`suref-web` itself** (the project's own SRD reference site) — covers *reference* but not *building*. ITUN explicitly complements it (Q14).

**Differentiation opportunity:** The composability model (build at each level), no-account friction, link-shareable snapshots, and print-quality sheets together form an underserved position. No existing SU tool nails all four. Plus: integration with the same canonical `salvageunion-reference` package that powers `suref-web` gives the data-quality high ground.

## Technical Constraints

- **Browser support:** Evergreen only — drop Safari < 16. Modern CSS / View Transitions / native dialog elements are fair game.
- **Mobile:** Important but desktop-primary. Responsive layout required; mobile sheet view is a hot path (table use, glare conditions).
- **Print:** A4 + US Letter both must look professional. Print stylesheet is a first-class deliverable.
- **Accessibility:** WCAG 2.1 AAA for sheet display, AA for everything else. CI a11y-scan job already exists.
- **Hosting:** Netlify preferred (current deployment target) but not strictly required. Free-tier-only is *not* a hard cap.
- **Shared assets:** Must consume `suref-react` (no build step, source-exported) and `salvageunion-reference` (TS + Zod + JSON dataset).
- **Backend:** Local-first primary (IndexedDB), with backend involvement for snapshot publishing only at MVP. Sync architecture deferred. Existing Supabase project decommissioned.

## Business Goals & Success Metrics

**Solo maintainer, no revenue, no deadline.** Success defined by:
- **Shippability** — the MVP gets released to real Salvage Union players, not left in eternal alpha.
- **Quality per feature** — a smaller surface, polished. No "26 mechanics, half flaky" repeat.
- **Sustainability** — the maintainer can keep improving it without re-rewriting.
- **Community value** — picked up and used by ≥ a handful of SU GMs / players outside the maintainer.

**Timeline:** No hard deadline. Quality bar gates release. Implicitly: weeks-to-months, not days.

**Budget:** Free or near-free infra. No paid services unless meaningfully cheaper than self-hosting their equivalent.

## Key Requirements (Initial)

**Must-have (MVP):**
- Build/save pilots, mechs, crawlers as independent first-class entities with auto stand-ins when one is built alone
- Wire entities together (mech-to-pilot, pilot-to-crawler) with soft linking
- Workspace-per-campaign grouping above the entity layer
- Mech pattern system (save/share named mech configurations)
- Capacity/budget enforcement (slots, scrap, cargo)
- Roll tables in the pilot creation wizard (callsign, background, motto, keepsake, appearance)
- Condition tracking on equipment (intact/damaged/destroyed)
- Live stat view + manual edit on the sheet (no action automation)
- Edit-with-soft-warnings progression model (free edits, rule-violation warnings)
- Backend snapshot publishing — anonymous, short URL, immutable
- Contextual SU reference (inline entity displays + tooltips) during builds; deep links to `suref-web` for full SRD
- Local-first storage (IndexedDB or equivalent)
- A4 + US Letter print-quality sheet export
- WCAG 2.1 AAA for sheet display; AA elsewhere
- Mobile-responsive
- Greenfield `apps/in-the-union-now/` directory; legacy archived to `apps/itun-legacy/`

**Should-have (post-MVP, upgrade-path):**
- Cloud sync (multi-device for the same anonymous user)
- Account model (magic-link / email-only) layered on top of anonymous snapshots
- Light-automation combat (action buttons, heat link, damage flow)
- Guided downtime / progression wizards
- Campaign-shared workspaces (multiplayer)
- Realtime sync inside a workspace
- GM/Mediator tools (NPCs, encounters, factions, rumors)

**Won't-have (this iteration):**
- Discord bot integration changes (separate concern)
- Full reference site duplication inside ITUN
- Image uploads to Supabase Storage
- Vehicle / faction / bio-titan encounter tracking
- Free-tier hosting hard cap (not a constraint)

## Open Questions

- **App name continuity:** the rebuild reuses the "In The Union Now" name. Should public URLs / branding break or stay continuous during the transition? (Architecture-phase concern.)
- **Snapshot lifecycle:** anonymous publishing means no author owns a snapshot. Are snapshots immortal? Expire after N days unread? GC strategy is a backend concern.
- **Print sheet canonical form:** is there an existing "preferred" sheet layout (e.g., from the rulebook or community)? Or do we design fresh?
- **Workspace migration semantics:** when a user builds outside any workspace and later wants to drop the build into a workspace, what's the UX?
- **suref-react component coverage:** which currently-in-ITUN components are good enough to migrate as-is to suref-react vs. need to be rewritten? (Likely an architecture-phase audit.)
- **Sync backend choice:** Supabase vs. local-first sync framework vs. lightweight blob storage — defer to architecture phase.
- **Mech pattern publishing:** patterns are reusable mech configs. Should published patterns be browsable (community pattern library)? Or are they private to the publisher's workspace?
