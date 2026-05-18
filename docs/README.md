# SURef Docs

Navigation hub for documentation in the SU-SRD monorepo. Start here if you're exploring the codebase or planning work.

## By Intent

**I'm building a new feature** → start with [/CLAUDE.md](../CLAUDE.md) for conventions, then the relevant architecture doc below.

**I'm adding/changing a UI component** → [architecture/display-system.md](architecture/display-system.md) + [architecture/package-contracts.md](architecture/package-contracts.md)

**I'm changing how data flows** → [architecture/data-flow.md](architecture/data-flow.md)

**I'm touching rules/combat logic** → [architecture/rules-engine-boundary.md](architecture/rules-engine-boundary.md) + [architecture/combat-loop.md](architecture/combat-loop.md) + [adrs/ADR-008-automation-boundary.md](adrs/ADR-008-automation-boundary.md)

**I'm writing a Supabase migration** → `apps/in-the-union-now/CLAUDE.md` + [architecture/data-flow.md](architecture/data-flow.md)

**I'm shipping SEO/a11y work** → [architecture/seo-accessibility.md](architecture/seo-accessibility.md)

**I'm cleaning up the codebase** → [audit/AUDIT-BACKLOG.md](audit/AUDIT-BACKLOG.md) (69 prioritized findings)

**I'm working on the ITUN revamp** → [itun-revamp/README.md](itun-revamp/README.md) (branch convention + workflow). All M1–M3 PRs target `yitun-revamp`, not `main`. See pinned epic [#228](https://github.com/SalvageUnion-io/SU-SRD/issues/228).

## Directory Map

### [`architecture/`](architecture/) — Cross-cutting architecture

| Doc | Scope |
|-----|-------|
| [display-system.md](architecture/display-system.md) | 3-layer render stack: DisplayCard → ReferenceEntityDisplay → consumers |
| [data-flow.md](architecture/data-flow.md) | Reference data + player data hydration, TanStack Query, Supabase |
| [package-contracts.md](architecture/package-contracts.md) | Package APIs, dependency rules, cross-package change checklist |
| [rules-engine-boundary.md](architecture/rules-engine-boundary.md) | What the engine decides vs what the GM/player decides |
| [combat-loop.md](architecture/combat-loop.md) | Combat flow, heat/push/salvage mechanics |
| [seo-accessibility.md](architecture/seo-accessibility.md) | SEO strategy (suref-web) + WCAG 2.1 AA patterns |

### [`adrs/`](adrs/) — Architecture Decision Records

MADR-style records of architecturally significant decisions. Read the matching ADR before proposing alternatives to a decision made here.

| ADR | Topic |
|-----|-------|
| [ADR-001](adrs/ADR-001-self-service-combat-model.md) | Self-service combat model |
| [ADR-002](adrs/ADR-002-variable-heat-handling.md) | Variable heat handling |
| [ADR-003](adrs/ADR-003-damage-target-selection.md) | Damage target selection |
| [ADR-004](adrs/ADR-004-change-log-reversibility.md) | Change log reversibility |
| [ADR-005](adrs/ADR-005-destroyed-item-semantic-color.md) | Destroyed item semantic color |
| [ADR-006](adrs/ADR-006-reactor-overload-partial-automation.md) | Reactor overload partial automation |
| [ADR-007](adrs/ADR-007-sequential-mutations-for-action-execution.md) | Sequential mutations for action execution |
| [ADR-008](adrs/ADR-008-automation-boundary.md) | **Automation boundary** — consult before building rules-driven features |
| [ADR-009](adrs/ADR-009-encounter-route-data-model.md) | Encounter route data model |

### [`audit/`](audit/) — Audit findings + backlog

- **[AUDIT-BACKLOG.md](audit/AUDIT-BACKLOG.md)** — prioritized 69-finding backlog as epics + stories. GitHub Project [#1](https://github.com/orgs/SalvageUnion-io/projects/1); issues #108–#166.
- **[AUDIT-SPEC.md](audit/AUDIT-SPEC.md)** — the audit methodology
- **[RECONCILIATION.md](audit/RECONCILIATION.md)** — audit findings reconciled against current state

Dated `2026-03-10-*` and `audit-*` files are historical snapshots; prefer AUDIT-BACKLOG for current priorities.

### [`plans/`](plans/) — Design docs for approved work

Forward-looking design docs. If a doc here describes implemented code, it should be archived (open task).

### Per-package CLAUDE.md

Each app and shared package has its own `CLAUDE.md` with stack-specific conventions:

- `apps/in-the-union-now/CLAUDE.md` — ITUN character builder (React + Supabase)
- `apps/suref-web/CLAUDE.md` — Static reference site (Astro + islands)
- `apps/discord-bot/CLAUDE.md` — Discord.js bot
- `packages/salvageunion-reference/CLAUDE.md` — Game data ORM + schemas
- `packages/suref-react/CLAUDE.md` — Shared component library
