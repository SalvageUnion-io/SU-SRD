# SURef Docs

Navigation hub for documentation in the SU-SRD monorepo. Start here if you're
exploring the codebase or planning work.

## By Intent

**I'm building a new feature** → start with [/CLAUDE.md](../CLAUDE.md) for
conventions, then the relevant architecture doc below.

**I'm adding/changing a UI component** → [architecture/display-system.md](architecture/display-system.md) + [architecture/package-contracts.md](architecture/package-contracts.md)

**I'm changing how data flows / persists** → [architecture/data-flow.md](architecture/data-flow.md) + [adrs/ADR-002-indexeddb-idb-zod.md](adrs/ADR-002-indexeddb-idb-zod.md) + [adrs/ADR-003-zustand-hydration.md](adrs/ADR-003-zustand-hydration.md)

**I'm touching rules/combat logic or deciding where a rule is enforced** → [architecture/rules-engine-boundary.md](architecture/rules-engine-boundary.md) (**Rules & the ITUN Surfaces** — the mode/rule-class matrix) + [adrs/ADR-021-itun-surface-taxonomy.md](adrs/ADR-021-itun-surface-taxonomy.md) (**governing** ADR for enforcement placement) + [architecture/combat-loop.md](architecture/combat-loop.md) + [adrs/ADR-007-automation-boundary.md](adrs/ADR-007-automation-boundary.md)

**I'm building the play surface (the Dashboard)** → [architecture/dashboard.md](architecture/dashboard.md) + [adrs/ADR-015-dashboard-distinct-play-surface.md](adrs/ADR-015-dashboard-distinct-play-surface.md) (through ADR-020)

**I'm working on the snapshot share feature** → [adrs/ADR-004-snapshot-netlify-functions.md](adrs/ADR-004-snapshot-netlify-functions.md)

**I need to know how a Salvage Union rule actually works** → run `bun run rules:regen` to produce the agent-readable rules digest in `docs/rules/` (gitignored — condensed from the PDFs in `rules/`, also gitignored). Read those instead of re-parsing the PDFs.

**I'm changing ITUN's local data layer (IndexedDB schemas/migrations)** → `apps/in-the-union-now/src/lib/db/migrations/` + [architecture/data-flow.md](architecture/data-flow.md)

**I'm shipping SEO/a11y work** → [architecture/seo-accessibility.md](architecture/seo-accessibility.md)

## Directory Map

### [`architecture/`](architecture/) — Cross-cutting architecture

| Doc                                                               | Scope                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [display-system.md](architecture/display-system.md)               | 3-layer render stack: DisplayCard → ReferenceEntityDisplay → consumers     |
| [data-flow.md](architecture/data-flow.md)                         | Reference data + player data hydration, IndexedDB, Zustand, TanStack Query |
| [package-contracts.md](architecture/package-contracts.md)         | Package APIs, dependency rules, cross-package change checklist             |
| [rules-engine-boundary.md](architecture/rules-engine-boundary.md) | **Rules & the ITUN Surfaces** — enforcement mode × rule-class matrix       |
| [dashboard.md](architecture/dashboard.md)                         | The Dashboard (Guided-Play surface) design — layout, instruments, canvas   |
| [combat-loop.md](architecture/combat-loop.md)                     | Action activation, heat checks, conditions — current local-first flow      |
| [seo-accessibility.md](architecture/seo-accessibility.md)         | SEO strategy (suref-web) + WCAG 2.1 AA patterns                            |

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

MADR-style records of architecturally significant decisions. ADR-001–014 are
**live in the code today**. ADR-015–020 are **Accepted** — the Dashboard play
surface, **built** as the Play Cockpit (`components/play/`, routed at `/play/$id`).
ADR-021 is the **governing** surface/mode taxonomy and ADR-022 its Change Log
companion — a target the code is still moving toward. ADR-023–025 are
**Accepted**; ADR-024–025 (derived release changelogs + the ref surface gate)
are being implemented together. Each says so in its Status.
Read the matching ADR before proposing alternatives.

| ADR                                                                  | Topic                                                                                                           |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [ADR-001](adrs/ADR-001-local-first-no-backend.md)                    | Local-first, no backend, no auth                                                                                |
| [ADR-002](adrs/ADR-002-indexeddb-idb-zod.md)                         | IndexedDB via `idb`, Zod as schema source, salvage-read resilience                                              |
| [ADR-003](adrs/ADR-003-zustand-hydration.md)                         | Zustand state — lazy hydration, write-through, cross-tab invalidation                                           |
| [ADR-004](adrs/ADR-004-snapshot-netlify-functions.md)                | Snapshot sharing — unauthenticated Netlify Functions + Blobs                                                    |
| [ADR-005](adrs/ADR-005-reference-data-orm.md)                        | Game-data ORM — Zod → generated JSON Schema, lazy data loading                                                  |
| [ADR-006](adrs/ADR-006-pure-rules-logic.md)                          | Rules/combat logic as pure functions                                                                            |
| [ADR-007](adrs/ADR-007-automation-boundary.md)                       | **Automation boundary** — consult before building rules-driven features                                         |
| [ADR-008](adrs/ADR-008-sequential-mutations.md)                      | Sequential client-side mutations for action execution                                                           |
| [ADR-009](adrs/ADR-009-condition-model-destroyed-color.md)           | Item condition model + destroyed semantic color                                                                 |
| [ADR-010](adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)        | Choices — ephemeral in the SRD, persisted in ITUN                                                               |
| [ADR-011](adrs/ADR-011-suref-react-source-no-build.md)               | `suref-react` ships as TypeScript source (no build step)                                                        |
| [ADR-012](adrs/ADR-012-suref-web-astro-static.md)                    | `suref-web` as an Astro static site with React islands                                                          |
| [ADR-013](adrs/ADR-013-csp-zod-jitless.md)                           | CSP-compliant Zod (jitless) constraint                                                                          |
| [ADR-014](adrs/ADR-014-json-api-public-interface-npm-retired.md)     | Dataset public interface is the JSON API; npm publishing retired                                                |
| [ADR-015](adrs/ADR-015-dashboard-distinct-play-surface.md)           | Dashboard is a distinct actual-play surface, separate from live sheets (built)                                  |
| [ADR-016](adrs/ADR-016-dashboard-rotary-dial-instrument-split.md)    | Dashboard rotary Dial selector + instrument/reference split (built)                                             |
| [ADR-017](adrs/ADR-017-dashboard-reuse-faithful-srd-display.md)      | Reuse the faithful light SRD display; instruments are bespoke (built)                                           |
| [ADR-018](adrs/ADR-018-dashboard-instrument-viewfinder-aesthetic.md) | Instrument/viewfinder aesthetic — flat & inset (built)                                                          |
| [ADR-019](adrs/ADR-019-dashboard-play-state-ephemeral.md)            | Dashboard play-state & prefs ephemeral/local-first, under the ADR-007 boundary (built)                          |
| [ADR-020](adrs/ADR-020-dashboard-fixed-canvas-scale-to-fit.md)       | Fixed 1280×800 scale-to-fit canvas with a phone-reflow floor (built)                                            |
| [ADR-021](adrs/ADR-021-itun-surface-taxonomy.md)                     | **Governing** — surface/mode taxonomy; rule enforcement is per-mode (Guided Creation / Free Edit / Guided Play) |
| [ADR-022](adrs/ADR-022-provenance-log-and-overrides.md)              | Per-entity **Change Log** (provenance, behind a menu) + non-destructive stat overrides (target)                 |
| [ADR-023](adrs/ADR-023-drone-equipment-installed-loadout.md)         | Drone/companion equipment hosts an installed Systems/Modules loadout                                            |
| [ADR-024](adrs/ADR-024-derived-release-changelogs.md)                | Derived, per-app release changelogs (release-please) + on-site history; supersedes the web hand-changelog       |
| [ADR-025](adrs/ADR-025-reference-versioned-releases-surface-gate.md) | Versioned internal releases + public-surface (TS + schema) gate for the ref; partially supersedes ADR-014       |

> ADR-021 is the governing decision for rules enforcement and takes precedence
> over prior ADRs where they conflict on _how hard a rule is enforced on which
> surface_. ADR-021/022 describe a **target** the code only partly reflects today;
> the Dashboard-design ADRs (015–020) are proposed. See the implementation-status
> note in [rules-engine-boundary.md](architecture/rules-engine-boundary.md).

### Per-package CLAUDE.md

Each app and shared package has its own `CLAUDE.md` with stack-specific
conventions:

- [`apps/suref-web/CLAUDE.md`](../apps/suref-web/CLAUDE.md) — Static reference site (Astro + islands)
- [`apps/in-the-union-now/CLAUDE.md`](../apps/in-the-union-now/CLAUDE.md) — Character builder (React, local-first)
- [`apps/discord-bot/CLAUDE.md`](../apps/discord-bot/CLAUDE.md) — Discord.js bot
- [`packages/salvageunion-reference/CLAUDE.md`](../packages/salvageunion-reference/CLAUDE.md) — Game data ORM + schemas
- [`packages/suref-react/CLAUDE.md`](../packages/suref-react/CLAUDE.md) — Shared component library

Plus the agent-readable convention digests in [`.claude/rules/`](../.claude/rules/).
