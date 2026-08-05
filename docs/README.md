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

**I'm working on the snapshot share feature** → [adrs/ADR-004-snapshot-netlify-functions.md](adrs/ADR-004-snapshot-netlify-functions.md)

**I'm working on accounts, Games, or the Discord bot as a game client** → [adrs/ADR-030-accounts-games-server-of-record.md](adrs/ADR-030-accounts-games-server-of-record.md) (**governing** ADR for identity + ownership) + [architecture/accounts-and-games.md](architecture/accounts-and-games.md) (delivery phases + ops reference) + [architecture/discord-bot-game-client.md](architecture/discord-bot-game-client.md)

**I need to know how a Salvage Union rule actually works** → run `bun run rules:regen` to produce the agent-readable rules digest in `docs/rules/` (gitignored — condensed from the PDFs in `rules/`, also gitignored). Read those instead of re-parsing the PDFs.

**I'm changing ITUN's local data layer (IndexedDB schemas/migrations)** → `apps/itun/src/lib/db/migrations/` + [architecture/data-flow.md](architecture/data-flow.md)

**I'm shipping SEO/a11y work** → [architecture/seo-accessibility.md](architecture/seo-accessibility.md)

**I'm touching how the SRD site is built, routed, or rendered** → [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md) (**the contract** — srd is built by an in-house SSG, **not Astro**) + [`apps/srd/CLAUDE.md`](../apps/srd/CLAUDE.md). Verify with `cd apps/srd && bun ssg/build.ts && bun ssg/parity.ts` — `parity.ts` is the acceptance gate, not your reading of the diff.

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
| [rules-engine-boundary.md](architecture/rules-engine-boundary.md)     | **Rules & the ITUN Surfaces** — enforcement mode × rule-class matrix                                   |
| [dashboard.md](architecture/dashboard.md)                             | The Dashboard (Guided-Play surface) design — layout, instruments, canvas                               |
| [combat-loop.md](architecture/combat-loop.md)                         | Action activation, heat checks, conditions — the client-side flow                                      |
| [seo-accessibility.md](architecture/seo-accessibility.md)             | SEO strategy (srd) + WCAG 2.1 AA patterns                                                              |
| [accounts-and-games.md](architecture/accounts-and-games.md)           | ADR-030 delivery phases + the Convex/Netlify/Discord operational reference                             |
| [discord-bot-game-client.md](architecture/discord-bot-game-client.md) | **Plan** — the bot as an authenticated Game client: credential model, command surface, embed rendering |

### `docs/rules/` — Agent-readable rules digest (generated, gitignored)

Condensed markdown digest of the Salvage Union core rules + expansions, for
agents that need to reference how the game works without re-parsing the source
PDFs. Mechanics prose only; specific entities (chassis, systems, abilities, etc.)
stay in `salvageunion-reference`.

**Not committed** — the digest is condensed from copyright-bearing PDFs, so both
the PDFs (`rules/`) and the digest (`docs/rules/`) are gitignored. Only the
generator is in git. Produce the digest locally with `bun run rules:regen`
(page-map + per-doc scope in [`tools/rules-digest/manifest.ts`](../tools/rules-digest/manifest.ts)).

### [`adrs/`](adrs/) — Architecture Decision Records

MADR-style records of architecturally significant decisions. **31 ADRs.** Each
one's own `## Status` block is authoritative — this summary tracks it, so if the
two ever disagree, believe the ADR.

- **ADR-002–014** are **Accepted** and live in the code today, **except ADR-012**
  (`srd` as an Astro static site), which is **superseded by ADR-031**: `srd` was
  migrated off Astro onto the in-house SSG at `apps/srd/ssg`. Only the machine
  changed — static output, no backend, and React islands all survive. The live
  contract is [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md).
- **ADR-031** records that migration and its costs (this repo now owns ~1,500
  lines of build tooling). `ssg/parity.ts` is its acceptance gate.
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
| [ADR-004](adrs/ADR-004-snapshot-netlify-functions.md)                | Snapshot sharing — unauthenticated Netlify Functions + Blobs                                                                                                                          |
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

`apps/su-assets/` has no `CLAUDE.md` — it is a single Netlify function
(`assets.salvageunion.io`) that serves licensed entity artwork out of the
`lp-assets` Netlify Blobs store, with the bytes deliberately kept out of git.
`packages/salvageunion-reference` points at it at runtime (`ASSET_BASE_URL` in
`lib/utilities.ts`), so entity-card artwork in both `srd` and `itun` depends on it.
See [`apps/su-assets/netlify.toml`](../apps/su-assets/netlify.toml).

Plus the agent-readable convention digests in [`.claude/rules/`](../.claude/rules/).
