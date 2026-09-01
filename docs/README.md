# SURef Docs

Navigation hub for documentation in the SU-SRD monorepo. Start here if you're
exploring the codebase or planning work.

## By Intent

**I'm building a new feature** → start with [/CLAUDE.md](../CLAUDE.md) for
conventions, then the relevant architecture doc below.

**I'm adding/changing a UI component** → [design-system/ruleset.md](design-system/ruleset.md) (**the governing primitive laws** — one kind × one context = one primitive) + [architecture/display-system.md](architecture/display-system.md) + [architecture/package-contracts.md](architecture/package-contracts.md)

**I'm changing how data flows / persists** → [architecture/data-flow.md](architecture/data-flow.md) + [adrs/ADR-030-accounts-games-server-of-record.md](adrs/ADR-030-accounts-games-server-of-record.md) (**governing** — which of the two persistence domains you're in) + [adrs/ADR-002-indexeddb-idb-zod.md](adrs/ADR-002-indexeddb-idb-zod.md) + [adrs/ADR-003-zustand-hydration.md](adrs/ADR-003-zustand-hydration.md)

**I'm touching rules/combat logic or deciding where a rule is enforced** → [architecture/rules-engine-boundary.md](architecture/rules-engine-boundary.md) (**Rules & the ITUN Surfaces** — the mode/rule-class matrix) + [adrs/ADR-021-itun-surface-taxonomy.md](adrs/ADR-021-itun-surface-taxonomy.md) (**governing** ADR for enforcement placement) + [architecture/combat-loop.md](architecture/combat-loop.md) + [adrs/ADR-007-automation-boundary.md](adrs/ADR-007-automation-boundary.md)

**I'm building the play surface (the Dashboard)** → [architecture/dashboard.md](architecture/dashboard.md) + [adrs/ADR-015-dashboard-distinct-play-surface.md](adrs/ADR-015-dashboard-distinct-play-surface.md) (through ADR-020)

**I'm working on sharing a sheet — snapshots, public sheets, or unifying the two** → [adrs/ADR-004-snapshot-netlify-functions.md](adrs/ADR-004-snapshot-netlify-functions.md) (the frozen `/s/:id` snapshot — unauthenticated, id-as-capability) + [adrs/ADR-032-public-read-only-sheets.md](adrs/ADR-032-public-read-only-sheets.md) (the live `/p/:kind/:appId` sheet — owner opt-in, revoked everywhere at once) + [architecture/unified-sheet-surfaces.md](architecture/unified-sheet-surfaces.md) (**the plan to combine them** — phases, gates, and the four decisions a future ADR must settle before any one-way phase begins). The two render through one renderer already; what differs is the capability model, so do not treat the merge as a routing change.

**I'm working on accounts, Games, or the Discord bot as a game client** → [adrs/ADR-030-accounts-games-server-of-record.md](adrs/ADR-030-accounts-games-server-of-record.md) (**governing** ADR for identity + ownership) + [architecture/accounts-and-games.md](architecture/accounts-and-games.md) (delivery phases + ops reference) + [architecture/discord-bot-game-client.md](architecture/discord-bot-game-client.md)

**I need to know how a Salvage Union rule actually works** → run `bun run rules:extract` (local only — the PDFs in `rules/` are copyright-bearing and gitignored, so this is unavailable in CI) and grep `rules/extracted/*.txt`. It carries `<!-- page N -->` markers, so you can cite exact pages.

**I'm changing ITUN's local data layer (IndexedDB schemas/migrations)** → `apps/itun/src/lib/db/migrations/` + [architecture/data-flow.md](architecture/data-flow.md)

**I'm shipping SEO/a11y work** → [architecture/seo-accessibility.md](architecture/seo-accessibility.md)

**I need a site id, service id, org slug, deployment name, or dashboard URL — or an MCP server isn't connecting** → [architecture/agent-tooling.md](architecture/agent-tooling.md) (**the service registry** — read it instead of listing every project on an account)

**I'm adding, bumping or pinning a dependency** → [architecture/dependency-management.md](architecture/dependency-management.md) — the catalog (a dep used by 2+ manifests is declared once), `overrides` (two dedupe pins, neither a security floor), the `bun audit` gate, and `bunfig.toml`'s 3-day install cooldown, which makes a **caret range resolve silently downward** instead of erroring.

**I'm working on the move to Cloudflare** → [adrs/ADR-033-cloudflare-hosting.md](adrs/ADR-033-cloudflare-hosting.md) (**the decisions** — read before revisiting any of them, especially R2-over-KV) + [architecture/cloudflare-cutover.md](architecture/cloudflare-cutover.md) (**the executable plan** — phase order, per-phase gates, progress table). Hard cutover, no rollback: **a failed gate halts the phase and is never worked around.** Do not execute from issue #830, which the ADR supersedes.

**I'm changing where player data lives, or anything offline/PWA** → [adrs/ADR-034-account-required-persistence.md](adrs/ADR-034-account-required-persistence.md) (**the decisions** — persistence requires an account, Convex is the only source of truth, IndexedDB is a cache) + [adrs/ADR-035-no-isolated-local-only-data.md](adrs/ADR-035-no-isolated-local-only-data.md) (**read both** — ADR-035 closes the migration window ADR-034 left open, and withdraws its terminal-decline consequence) + [architecture/persistence-and-pwa.md](architecture/persistence-and-pwa.md) (**the executable plan** — phase order, gates, progress, and the inventory of what is not DB-backed yet). Accepted and **delivered**: `persistence-and-pwa.md` marks P0–P8, P4b and the flip all done, and `apps/itun/.env.production` sets `VITE_REQUIRE_ACCOUNT=true`. The one-way doors are behind us — anonymous writes go to the in-memory backend and do not survive a reload, and a browser holding a pre-account roster is **migrated** into the account rather than left reading it. Never add a store that exists only on a device.

**I'm touching how the SRD site is built, routed, or rendered** → [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md) (**the contract** — srd is built by an in-house SSG, **not Astro**) + [`apps/srd/CLAUDE.md`](../apps/srd/CLAUDE.md). Verify with `bun --filter srd gate` — `ssg/snapshot.ts` diffs the built output against a committed snapshot and is the acceptance gate, not your reading of the diff. If the change is intentional, `bun --filter srd snapshot:update` and commit the snapshot alongside it.

## Directory Map

### [`design-system/`](design-system/) — The canonical primitive language

| Doc                                                                              | Scope                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ruleset.md](design-system/ruleset.md)                                           | **Canon** — the governing laws: context laws, the rendering matrix, foundations, the irreducible atom set, the merge map, value-cell + StampSeam laws                                                               |
| [canonical-primitive-language.md](design-system/canonical-primitive-language.md) | The buildable migration plan — primitive catalog, token codification, phased merge order                                                                                                                            |
| [style-unification-pass.md](design-system/style-unification-pass.md)             | **Completed — historical record.** The pass as it ran: the layer ladder, per-primitive rules, the Ladle conversion procedure, the migration work-list. Not a work-list; §2's governing laws are the part still live |

### [`architecture/`](architecture/) — Cross-cutting architecture

| Doc                                                                   | Scope                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [display-system.md](architecture/display-system.md)                   | The two card shells (ReferenceEntityCard / Card), size × extent, controls                              |
| [data-flow.md](architecture/data-flow.md)                             | Reference data + player data hydration; the two persistence domains (IndexedDB / Convex), Zustand      |
| [package-contracts.md](architecture/package-contracts.md)             | Package APIs, dependency rules, cross-package change checklist                                         |
| [dependency-management.md](architecture/dependency-management.md)     | Pinning, the catalog, `overrides`, the audit gate and the install cooldown — and why each exists        |
| [rules-engine-boundary.md](architecture/rules-engine-boundary.md)     | **Rules & the ITUN Surfaces** — enforcement mode × rule-class matrix                                   |
| [dashboard.md](architecture/dashboard.md)                             | The Dashboard (Guided-Play surface) design — layout, instruments, canvas                               |
| [combat-loop.md](architecture/combat-loop.md)                         | Action activation, heat checks, conditions — the client-side flow                                      |
| [seo-accessibility.md](architecture/seo-accessibility.md)             | SEO strategy (srd) + WCAG 2.1 AA patterns                                                              |
| [accounts-and-games.md](architecture/accounts-and-games.md)           | ADR-030 delivery phases + the Convex/Cloudflare/Discord operational reference                          |
| [agent-tooling.md](architecture/agent-tooling.md)                     | **Service registry** — MCP servers + auth models, and every Cloudflare/Sentry/Convex identifier        |
| [cloudflare-cutover.md](architecture/cloudflare-cutover.md)           | **Executable plan** for ADR-033 — phase order, per-phase gates, progress table, cutover runbook        |
| [discord-bot-game-client.md](architecture/discord-bot-game-client.md) | **Plan** — the bot as an authenticated Game client: credential model, command surface, embed rendering |
| [persistence-and-pwa.md](architecture/persistence-and-pwa.md)         | **Executable plan** for ADR-034 and ADR-035 — phases, gates, progress, and what is not DB-backed yet   |
| [unified-sheet-surfaces.md](architecture/unified-sheet-surfaces.md)   | **Plan** for unifying the two account-free share surfaces (`/s/:id` frozen, `/p/:kind/:appId` live) — phases, gates, and the open decisions a future ADR must settle |

### Rules text — extract and grep, no digest

There is **no** curated rules digest, and `docs/rules/` is not a thing. Run
`bun run rules:extract` to produce `rules/extracted/*.txt` from the PDFs and grep
that. Both the PDFs and the extract are gitignored (copyright-bearing verbatim
material) and absent in CI, so this is a local-only affordance. Specific entities
— chassis, systems, abilities — live in `salvageunion-reference`, not in prose.

A digest *was* planned. `tools/rules-digest/` emitted authoring briefs rather than
documents, so every file still had to be hand-written and none ever was; the
directory held one README while `CLAUDE.md` and this page both told readers to
consult it. The generator is retired — if the digest is wanted, write the
documents as part of the same change.

### [`adrs/`](adrs/) — Architecture Decision Records

MADR-style records of architecturally significant decisions. **35 ADRs.** Each
one's own `## Status` block is authoritative — this summary tracks it, so if the
two ever disagree, believe the ADR.

- **ADR-002–014** are **Accepted** and live in the code today, **except ADR-012**
  (`srd` as an Astro static site), which is **superseded by ADR-031**: `srd` was
  migrated off Astro onto the in-house SSG at `apps/srd/ssg`. Only the machine
  changed — static output, no backend, and React islands all survive. The live
  contract is [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md).
- **ADR-031** records that migration and its costs (this repo now owns ~1,500
  lines of build tooling). Its original acceptance gate, `ssg/parity.ts`, was
  retired when its Astro baseline expired — the ADR's own "shelf life" clause
  records why — and replaced by `ssg/snapshot.ts`, a self-hosted snapshot gate
  that runs in CI.
- **ADR-001** (local-first, no backend, no auth) is **superseded by ADR-030**.
  It is retained because its reasoning still governs the parts ADR-030 left
  alone — anonymous Solo play, and snapshot sharing.
- **ADR-015–020** are **Accepted** — the Dashboard play surface, **built** at
  `components/dashboard/`, routed at `/dashboard/$id`.
- **ADR-021** is the **governing** surface/mode taxonomy and **ADR-022** its
  Change Log companion — both **built** (hard-enforced create wizards, the
  Dashboard, and the `entityStore.update` provenance log + cap overrides).
- **ADR-023** is **superseded by ADR-027**, which is itself **superseded by
  ADR-028** (partners render in place; it keeps ADR-027's model in full and
  removes only its surface). ADR-028 is the live one of the three.
- **ADR-024–025** (derived release changelogs + the reference surface gate) are
  **Accepted and shipped** — release-please config, manifest and workflow all
  ship.
- **ADR-026** (entity card design rules) is **Accepted** and **built**.
- **ADR-029** is **Proposed** — not yet decided; don't build against it.
- **ADR-030** is the **governing** ADR for identity, ownership, and sharing:
  Convex as server of record. It **supersedes ADR-001** and **amends ADR-022**.
  Delivery state lives in
  [architecture/accounts-and-games.md](architecture/accounts-and-games.md), not
  in the ADR.

Read the matching ADR before proposing alternatives.

| ADR                                                                  | Topic                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ADR-001](adrs/ADR-001-local-first-no-backend.md)                    | Local-first, no backend, no auth — **superseded by ADR-030**; reasoning retained for Solo + snapshots                                                                                 |
| [ADR-002](adrs/ADR-002-indexeddb-idb-zod.md)                         | IndexedDB via `idb`, Zod as schema source, salvage-read resilience                                                                                                                    |
| [ADR-003](adrs/ADR-003-zustand-hydration.md)                         | Zustand state — lazy hydration, write-through, cross-tab invalidation                                                                                                                 |
| [ADR-004](adrs/ADR-004-snapshot-netlify-functions.md)                | Snapshot sharing — unauthenticated, ID-as-capability. **Amended by ADR-033**: same contract, now a Worker + R2                                                                        |
| [ADR-005](adrs/ADR-005-reference-data-orm.md)                        | Game-data ORM — Zod → generated JSON Schema, lazy data loading                                                                                                                        |
| [ADR-006](adrs/ADR-006-pure-rules-logic.md)                          | Rules/combat logic as pure functions                                                                                                                                                  |
| [ADR-007](adrs/ADR-007-automation-boundary.md)                       | **Automation boundary** — consult before building rules-driven features                                                                                                               |
| [ADR-008](adrs/ADR-008-sequential-mutations.md)                      | Sequential client-side mutations for action execution                                                                                                                                 |
| [ADR-009](adrs/ADR-009-condition-model-destroyed-color.md)           | Item condition model + destroyed semantic color                                                                                                                                       |
| [ADR-010](adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)        | Choices — ephemeral in the SRD, persisted in ITUN                                                                                                                                     |
| [ADR-011](adrs/ADR-011-component-lib-source-no-build.md)             | `component-lib` ships as TypeScript source (no build step)                                                                                                                            |
| [ADR-012](adrs/ADR-012-srd-astro-static.md)                          | `srd` as an Astro static site with React islands — **superseded**; srd now builds through the in-house SSG at `apps/srd/ssg` (contract: [`ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md)) |
| [ADR-013](adrs/ADR-013-csp-zod-jitless.md)                           | CSP-compliant Zod (jitless) constraint                                                                                                                                                |
| [ADR-014](adrs/ADR-014-json-api-public-interface-npm-retired.md)     | Dataset public interface is the JSON API; npm publishing retired                                                                                                                      |
| [ADR-015](adrs/ADR-015-dashboard-distinct-play-surface.md)           | Dashboard is a distinct actual-play surface, separate from live sheets (built)                                                                                                        |
| [ADR-016](adrs/ADR-016-dashboard-rotary-dial-instrument-split.md)    | Dashboard rotary Dial selector + instrument/reference split (built)                                                                                                                   |
| [ADR-017](adrs/ADR-017-dashboard-reuse-faithful-srd-display.md)      | Reuse the faithful light SRD display; instruments are bespoke (built)                                                                                                                 |
| [ADR-018](adrs/ADR-018-dashboard-instrument-viewfinder-aesthetic.md) | Instrument/viewfinder aesthetic — flat & inset (built)                                                                                                                                |
| [ADR-019](adrs/ADR-019-dashboard-play-state-ephemeral.md)            | Dashboard play-state & prefs ephemeral/local-first, under the ADR-007 boundary (built)                                                                                                |
| [ADR-020](adrs/ADR-020-dashboard-fixed-canvas-scale-to-fit.md)       | Fixed 1280×800 scale-to-fit canvas with a phone-reflow floor (built)                                                                                                                  |
| [ADR-021](adrs/ADR-021-itun-surface-taxonomy.md)                     | **Governing** — surface/mode taxonomy; rule enforcement is per-mode (Guided Creation / Free Edit / Guided Play)                                                                       |
| [ADR-022](adrs/ADR-022-provenance-log-and-overrides.md)              | Per-entity **Change Log** (provenance, behind a menu) + non-destructive stat overrides (built)                                                                                        |
| [ADR-023](adrs/ADR-023-drone-equipment-installed-loadout.md)         | Granted drone/companion equipment hosts an installed loadout — **superseded by ADR-027 → ADR-028**                                                                                    |
| [ADR-024](adrs/ADR-024-derived-release-changelogs.md)                | Derived, per-app release changelogs (release-please) + on-site history; superseded the web hand-changelog                                                                             |
| [ADR-025](adrs/ADR-025-reference-versioned-releases-surface-gate.md) | Versioned internal releases + public-surface (TS + schema) gate for the ref; partially supersedes ADR-014                                                                             |
| [ADR-026](adrs/ADR-026-entity-card-design-rules.md)                  | **Entity card design rules** — one renderer, choice/stat-atom/modified-stats/tech-level rules (built)                                                                                 |
| [ADR-027](adrs/ADR-027-partners-owned-by-host.md)                    | Partners are owned by their host entity — **superseded by ADR-028** (model kept, surface removed)                                                                                     |
| [ADR-028](adrs/ADR-028-partners-render-in-place.md)                  | Partners render in place as reference entities; supersedes ADR-027                                                                                                                    |
| [ADR-029](adrs/ADR-029-contribution-model-and-stat-provenance.md)    | **Proposed** — one contribution model for caps/traits/damage + stat provenance; amends ADR-022's overrides                                                                            |
| [ADR-030](adrs/ADR-030-accounts-games-server-of-record.md)           | **Governing** — accounts, Games, ownership, and Convex as server of record; supersedes ADR-001, amends ADR-022                                                                        |
| [ADR-031](adrs/ADR-031-srd-vite-ssg.md)                              | `srd` builds on an in-house Vite SSG (`apps/srd/ssg`); supersedes ADR-012 — same decision, different machine                                                                          |
| [ADR-032](adrs/ADR-032-public-read-only-sheets.md)                   | Public, read-only sheets. Amends ADR-030 §5 (visibility) with one explicit exception, and narrows what ADR-004's snapshots are _for_                                                   |
| [ADR-033](adrs/ADR-033-cloudflare-hosting.md)                        | Hosting moves to Cloudflare; Netlify + Render retired, hard cutover, snapshots on R2 not KV; amends ADR-004, Convex unchanged                                                          |
| [ADR-034](adrs/ADR-034-account-required-persistence.md)              | Persistence requires an account; Convex is the only source of truth and IndexedDB is a cache; both apps are ordinary installable PWAs. **Supersedes ADR-030 §1's Solo guarantee**; amends ADR-002 and ADR-022; **partially superseded by ADR-035** |
| [ADR-035](adrs/ADR-035-no-isolated-local-only-data.md)               | The migration window closes: no legacy exemption on the anonymous backend, the claim runs automatically against `listMine` instead of being offered, and a claimed body is shelved so its container agrees with its row. **Partially supersedes ADR-034**'s terminal-decline consequence |

> ADR-021 is the governing decision for rules enforcement and takes precedence
> over prior ADRs where they conflict on _how hard a rule is enforced on which
> surface_. ADR-021/022 and the Dashboard-design ADRs (015–020) are all realized in
> the code; the remaining gaps (unwired `salvage` / `crafting` / `scrapMech`
> primitives, no Change Log replay surface) are listed in the implementation-status
> note in [rules-engine-boundary.md](architecture/rules-engine-boundary.md).
>
> The two governing ADRs do not overlap: **ADR-021** governs _how hard a rule is
> enforced on which surface_, **ADR-030** governs _who owns a record and where it
> lives_. ADR-030 adds an ownership axis to ADR-021 without altering any of its
> enforcement modes.

### Per-package CLAUDE.md

Each app and shared package has its own `CLAUDE.md` with stack-specific
conventions:

- [`apps/srd/CLAUDE.md`](../apps/srd/CLAUDE.md) — Static reference site (in-house SSG at `apps/srd/ssg` + React islands; **not Astro**)
- [`apps/itun/CLAUDE.md`](../apps/itun/CLAUDE.md) — Character builder + game manager (React; Solo on IndexedDB, Connected on Convex)
- [`apps/discord-bot/CLAUDE.md`](../apps/discord-bot/CLAUDE.md) — Discord.js bot
- [`packages/salvageunion-reference/CLAUDE.md`](../packages/salvageunion-reference/CLAUDE.md) — Game data ORM + schemas
- [`packages/component-lib/CLAUDE.md`](../packages/component-lib/CLAUDE.md) — Shared component library

`apps/su-assets/` has no `CLAUDE.md` — it is a single Cloudflare Worker
(`assets.salvageunion.io`) that serves licensed entity artwork out of the
`su-lp-assets` R2 bucket, with the bytes deliberately kept out of git.
`packages/salvageunion-reference` points at it at runtime (`ASSET_BASE_URL` in
`lib/utilities.ts`), so entity-card artwork in both `srd` and `itun` depends on it.
See [`apps/su-assets/netlify.toml`](../apps/su-assets/netlify.toml).

Plus the agent-readable convention digests in [`.claude/rules/`](../.claude/rules/).
