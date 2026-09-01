# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Hub

**Start here for navigation:** [`docs/README.md`](docs/README.md) maps user intent → relevant doc (architecture, ADRs, per-package CLAUDE.md).

- [`docs/adrs/`](docs/adrs/) — architecture decision records, **34 of them** (ADR-001 through ADR-034). Consult the matching ADR before revisiting a prior decision, and **read its `## Status` header first** — several are superseded and the supersession is only recorded there (ADR-001 → ADR-030; ADR-012 → ADR-031; ADR-023 → ADR-027 → ADR-028; ADR-030 §1 → ADR-034). The three that govern:
  - [ADR-030](docs/adrs/ADR-030-accounts-games-server-of-record.md) — accounts, Games, and Convex as the server of record for identity/ownership/sharing. **Supersedes ADR-001** (local-first, no backend, no auth) and amends ADR-022. Decision accepted; delivery is phased — see [`docs/architecture/accounts-and-games.md`](docs/architecture/accounts-and-games.md) for what has actually landed.
  - [ADR-021](docs/adrs/ADR-021-itun-surface-taxonomy.md) — the surface/mode taxonomy for **where a rule is enforced**. ADR-030 adds an ownership axis to it without changing its enforcement modes.
  - [ADR-007](docs/adrs/ADR-007-automation-boundary.md) — the automation boundary. Read before building rules-driven features.

  ADR-015–020 cover the Dashboard play surface, built at `apps/itun/src/components/dashboard/`.

- **Hosting is on Cloudflare** ([ADR-033](docs/adrs/ADR-033-cloudflare-hosting.md)) — Netlify and Render are being retired in a **hard cutover with no rollback**. **Every production surface now serves from Cloudflare**: `apps/itun` (`intheunionnow.com`) and the Discord bot since 2026-08-19, `apps/srd` (`salvageunion.io`) and `apps/su-assets` (`assets.salvageunion.io`) since **2026-08-31** — P7 is done. **Render is fully retired — the account was deleted on 2026-09-01**, along with the bot's dormant Node gateway that was the last thing referencing it. Netlify still exists as an ACCOUNT but serves no traffic, and every trace of both has been removed from this repo — no `netlify.toml`, no `render.yaml`, no functions, no `@netlify/blobs`. Builds are **stopped** on both repo-linked Netlify sites, so they no longer post PR checks; **deleting those sites and that account is all that remains of P8**. A Netlify site still answering on its `.netlify.app` hostname is decommission debris, not a live origin. The per-service reality is in the progress table, not here. Before touching hosting, deploy config, the snapshot backend or the Discord bot's transport, read the ADR and then [`docs/architecture/cloudflare-cutover.md`](docs/architecture/cloudflare-cutover.md), which carries the phase order, the per-phase gates and a progress table. Two things bind immediately: **a failed gate halts the phase and is never worked around**, and **snapshots go to R2 rather than into Convex**, which keeps a future Convex→D1 move open. Do not execute from issue #830 — the ADR supersedes it.

- [`docs/architecture/`](docs/architecture/) — cross-cutting architecture (display system, data flow, package contracts, rules-engine boundary, combat loop, SEO/a11y).
- **Rules text** — there is no curated digest. To answer "what does the book actually say", run `bun run rules:extract` (local only; the copyright-bearing PDFs in `rules/` are gitignored and absent in CI) and grep `rules/extracted/*.txt`, which carries `<!-- page N -->` markers so you can cite exact pages.
  - A `docs/rules/` digest was planned and never existed. `tools/rules-digest/` generated *authoring briefs*, not documents — an agent still had to hand-write each file, and none was written, so the directory held nothing but a README while this file told every session to read it. Generator retired; don't rebuild it without writing the documents too.

## Critical Rules

- Do NOT add features, schema changes, or UI elements that were not explicitly requested. Stay strictly within the scope of what the user asked for. If you think something additional would be beneficial, mention it as a suggestion but do not implement it.
- When the user asks to 'plan' or 'prepare' something, the scope is document/plan creation only — do NOT begin implementation unless explicitly asked to implement.

## UI Development

- Always reuse existing shared components (e.g., `ReferenceEntityCard`, `Card`) rather than building custom one-off UI. Check for existing patterns in the shared packages first before creating new components.
- When making CSS/layout changes, get the first attempt right by carefully considering the rendering context (e.g., float doesn't work inside grid/flex containers). If a visual change requires iteration, ask the user to confirm via screenshot before making further adjustments. Prefer simple, well-understood CSS patterns over clever approaches.
- For UI components, prefer compact/listing card displays by default (header-only, clickable) rather than full inline expanded displays. Ask if unsure about the level of detail to render.

## Build & Validation

This is a TypeScript monorepo with shared packages (component-lib, etc.). After any cross-package changes, always run typecheck, tests, and lint before considering a task complete. When modifying shared components, check all consuming apps for regressions (especially Tailwind @source paths and import changes).

**`bun run check` is the full-check entry point** — the one command that runs everything (schema drift, lint, format, typecheck, tests, data validation, knip, audit, tokens, styling, CI aggregator gate, srd output gate), and the same spelling as the other repos in this fleet. `bun run check:fast` is the ~12s inner-loop subset. `check:all` remains as a thin alias for `check` for one release cycle and will then be removed; don't add new callers of it.

### Root Dev Dependencies (Intentional)

- **`playwright`** — Used by `tools/a11y-scan.ts` for WCAG accessibility audits. Not dead code. It is a _root_ dependency because that scanner lives in `tools/`, outside any workspace; the apps depend on `@playwright/test` separately for their e2e suites. This replaced `puppeteer-core`, which shipped no browser and had to borrow Playwright's Chromium — one browser stack now, not two.
- **`sharp`** — no longer a ROOT dependency. It moved to `apps/srd`, whose `scripts/og-screenshots.ts` is now its only consumer; `tools/convert-lp-assets-to-webp.ts` and `tools/generate-lp-asset-derivatives.ts` were the other two and both were deleted when Cloudflare Images took over derivative rendering. With one consumer left it is also **out of the catalog** — `check:catalog` fails an entry with fewer than two references, and it caught exactly this.

### Dependencies, the catalog, `overrides` and the audit gate

**All of it now lives in
[`docs/architecture/dependency-management.md`](docs/architecture/dependency-management.md).**
Read it before touching `package.json`, `bunfig.toml`, `workspaces.catalog` or
`overrides` — every rule there exists because something went wrong once, and the
reasoning is the part that matters.

The three that bite most often, so you know whether you need to open it:
`bun audit --audit-level=high` gates merges and there are **no** suppressed
advisories; a dependency used by two or more manifests is declared once in
`workspaces.catalog` and a version literal for a catalogued package is a bug;
and `bunfig.toml` refuses versions published less than three days ago, which
makes a **caret range resolve silently downward** rather than erroring.


## Repository Overview

Bun monorepo ("SURef") for Salvage Union (tabletop RPG) tools, located in the `SU-SRD/` subdirectory. Contains a static reference site, a character builder app, a Discord bot, and shared packages.

## External Integrations & MCP Servers

**The registry lives in [`docs/architecture/agent-tooling.md`](docs/architecture/agent-tooling.md)** — every site id, service id, org slug, deployment name and dashboard URL, plus how each MCP server authenticates and how to re-derive any of it. Read that instead of listing every project on an account. This section is the summary.

The project-scoped [`.mcp.json`](.mcp.json) is committed (Claude Code prompts each contributor to approve it per-project) and declares **five** servers — Cloudflare (bindings and observability), Sentry, Convex, Context7:

- **Cloudflare** — hosts **everything**: `apps/srd` (`salvageunion.io`), `apps/itun` (`intheunionnow.com`), `apps/su-assets` (`assets.salvageunion.io`) and the Discord bot, all on Workers, with two R2 buckets (`su-itun-snapshots`, `su-lp-assets`) and Images for artwork derivatives. Config is `apps/*/wrangler.jsonc`; deploys run from `.github/workflows/deploy-cloudflare.yml`. MCP servers: `cloudflare-bindings` (`https://bindings.mcp.cloudflare.com/mcp`) and `cloudflare-observability` (`https://observability.mcp.cloudflare.com/mcp`), both remote HTTP, both OAuth on first connect — which is what keeps `.mcp.json` secret-free.
- **Netlify** — **hosts nothing.** Every `netlify.toml`, both `netlify/` function trees and `@netlify/blobs` are deleted. The account still exists and its three sites still answer on their `.netlify.app` hostnames, serving a stale build; that is decommission debris, not an origin. **Nothing in this repo reaches it any more.** `tools/sync-snapshots-to-r2.ts` was the last consumer and is deleted: P6's delta was reconciled by measurement instead of by running it (43 of 45 snapshots resolve on production; the other two are archived to disk). The MCP server is gone too. Builds are stopped on both repo-linked sites; deleting them is the remaining step.
- **Sentry** — error tracking across every surface: `@sentry/browser` in `srd` and `itun`, `@sentry/cloudflare` in all three Workers via `observability/cloudflare`, and `@sentry/vite-plugin` for `itun` release artifacts. `@sentry/node` is **gone** — its only consumer was the bot's dormant Node gateway, deleted once Render was retired. MCP server: remote HTTP at `https://mcp.sentry.dev/mcp`.
- **Render** — **gone.** The account was deleted on 2026-09-01. The bot moved to HTTP interactions on a Cloudflare Worker (ADR-033 P5, live 2026-08-19), `render.yaml` went with P8, and the dormant Node gateway that still read `RENDER_GIT_COMMIT` was deleted last. The MCP server had already been removed — it reached one dormant service, and a declared server that is never called is indistinguishable from a broken one.
- **GitHub** — repo host + Actions CI + PR workflow. MCP server: remote HTTP at `https://api.githubcopilot.com/mcp/`. **This one does not work unconfigured** — the endpoint does not support dynamic client registration, so it needs a machine-local PAT header; see the registry doc. Until then, use the `gh` CLI.
- **Convex** — the **server of record** for accounts and Games ([ADR-030](docs/adrs/ADR-030-accounts-games-server-of-record.md)); the backend lives in `apps/itun/convex/` (`auth.ts`, `games.ts`, `invites.ts`, `proposals.ts`, `mediator.ts`, `http.ts`, … — `tools/check-convex-codegen.ts` prints the true module count on every run, so it is not restated here) and the phased delivery plan is [`docs/architecture/accounts-and-games.md`](docs/architecture/accounts-and-games.md). MCP server: stdio via `bunx convex mcp start --project-dir apps/itun`, authenticating with the Convex CLI's own device credentials. It targets the **dev** deployment resolved from `CONVEX_DEPLOYMENT`, so run `bunx convex dev` once or every tool call fails; production access is gated behind flags that are deliberately **not** set.

- **Context7** — version-pinned library documentation, remote HTTP at `https://mcp.context7.com/mcp`. Keyless on the free tier, so it adds no credential. It is here because this repo pins hard and runs ahead of model training data (TypeScript 7 + the `typescript-classic` 6 alias, Vite 8, Tailwind 4.3, Convex 1.43, TanStack Router 1.170) — "what is the API in **this** version" is the recurring failure. Two tools, the smallest context cost of any server here. Treat what it returns as advisory: the docs are condensed, not authoritative.

`.mcp.json` is **secret-free by design.** It carries transport, command and URL only — no `Authorization` headers, no tokens, and deliberately **no `${VAR}` placeholders** (#291 removed those on purpose; do not reintroduce them). Authenticate each remote server locally — OAuth on first connect, or machine-local Claude Code config that is never committed.

**`claude mcp list` is the only way to know a server works.** Zero tool calls is indistinguishable from broken, and two of these authenticate outside the file.

**Sentry's failure mode is silent, and CI guards it.** Both browser apps env-gate the SDK on a DSN, so with no DSN Vite tree-shakes Sentry out and the build looks identical to a working one; and even with a DSN, a `connect-src` that omits Sentry's ingest origin blocks every event in the browser while still looking healthy. `tools/check-observability.ts` checks both halves together (wired into `validate:all` via `bun run validate:observability`) and asserts its `SENTRY_INGEST_HOST` constant against each app's `public/_headers` — **two sources now, not four**: the `netlify.toml` half went with the files, and where an app's `wrangler.jsonc` declares `assets`, `_headers` is **mandatory** rather than merely one candidate.

It also gates the three **Workers**, which it did not until 2026-08-31: each must wrap its export with `withObservability` and grant `nodejs_als`. That gap is worth remembering rather than just closing — the checker stayed green across the entire cutover while all three production Workers reported to nothing but `console.error`, because it had no notion of a Worker. **A guard that does not know about a surface cannot fail for it.**

**If you change the CSP or the Sentry region, change every source for that app in lockstep.**

## SU-SRD Monorepo

### Quick Reference

```bash
# First-time setup
cd SU-SRD && bun install && bun run build:package   # generates JSON schemas (package ships TS source — no compile step)

# Development
bun run dev              # Build package + start reference site dev server
                         # (srd's own `bun ssg/dev.ts` — Vite in middleware mode,
                         # rendering through the SAME ssg/render.tsx path as prod)
bun run dev:watch        # Alias of dev — package TS is consumed directly, nothing to watch
bun run dev:itun         # Build package + start ITUN app dev server

# Testing
bun run test             # Canonical FULL suite: each workspace with its own
                         # bunfig. This is what CI runs — prefer it.
                         # Pre-push does NOT run this; it runs the --changed
                         # subset (see "Pre-commit Hooks" below), so run this by
                         # hand when you want the whole sweep locally.
bun test                 # Also works, but it is NOT the gate and it is NOT
                         # green. The root bunfig.toml preloads the UNION of the
                         # workspace preloads, so a bare root run is viable; it
                         # used to fail by the hundreds (639) purely from missing
                         # preloads. Measured 2026-09-01: 5446 pass / 9 fail
                         # across 416 files. Every one of the 9 passes in its own
                         # workspace, and they are TWO different causes — an
                         # earlier version of this note asserted one:
                         #
                         #   1 x component-lib CardImage.ssr.test.tsx — a genuine
                         #     PRELOAD-SET difference (the root bunfig adds
                         #     fake-indexeddb + the bot env shim). Fails the same
                         #     way under --isolate.
                         #   8 x the two identically-named `observability` suites
                         #     in apps/srd and apps/itun, which both
                         #     mock.module('@sentry/browser'). That IS cross-file
                         #     leakage — mock.module is process-global — and this
                         #     note used to rule it out explicitly. They pass
                         #     alone AND together; only a 416-file shared process
                         #     interleaves one file's afterAll restore with the
                         #     other's capture.
                         #
                         # Prefer `bun run test`, which forks per workspace and
                         # is the gate. If it is red, something is actually
                         # broken — do not reach for this note to explain it away.

# DO NOT reach for --parallel or --isolate to speed the suite up. Both are large
# regressions here and this is measured, not assumed (this machine):
#   bun test              67.7s   5455 tests / 416 files
#   bun test --parallel   65.1s   + 2 spurious 5s-timeout failures
#   bun test --isolate   234.1s   6.8x slower
# The preloads (happy-dom, testing-library, a full ORM schema load,
# fake-indexeddb) are expensive and both flags re-pay them per isolated file.
# --changed is the flag that actually makes the suite cheaper; see pre-push.
bun --filter salvageunion-reference test   # Test package only
bun --filter component-lib test              # Test shared components only
bun --filter srd test                # Test reference site only
bun --filter itun test         # Test ITUN app only

# Code quality
bun run check:fast       # ~12s inner loop: lint + validate:all + knip (parallel),
                         # then typecheck. THE "did I break anything" command —
                         # reach for this while iterating, not check.
bun run lint             # Lint all packages (Biome)
bun run format           # Format all packages (Biome — the ONLY formatter; .md/.yml are formatted by nothing)
bun run typecheck        # TypeScript check all packages
bun run check            # THE full-check entry point — the one command that runs
                         # everything (adds format, test, audit, tokens, styling,
                         # ci-aggregator, schema-drift). ~35s — run before
                         # pushing, not per-edit.
                         # `check:all` is a deprecated alias kept for one release
                         # cycle; new callers use `check`.

# Regenerate JSON schemas from Zod (the package ships TypeScript source — no compile step)
bun run build:package

# Agent worktree hygiene
bun run reap             # Dry-run: list abandoned .claude/worktrees/ checkouts
                         # that are safe to remove. Add --force to remove them.
                         # Removes the CHECKOUT only, never a branch ref, so
                         # commits on a branch survive. Run it when repo-wide
                         # grep/find start returning duplicates — a backlog of
                         # 15 worktrees inflated searches ~14x and held 13 GB.

# Data validation
bun run validate:all     # Check IDs, cross-references, action references
bun run validate:ids     # Unique ID check only

# Local-only diagnostics — deliberately NOT in check or CI. These read the
# copyright-bearing PDFs in rules/, which are gitignored and absent in CI, so
# there they would be a check that passes by doing nothing. Each no-ops with a
# notice and exit 0 when the extract is missing. Advisory: read the findings,
# do not apply them blind. See README.md "Local-only diagnostics".
bun run rules:extract        # PDF → rules/extracted/ text layer, then grep it
bun run check:printed-names  # Diff every entity name + page against the Core
                             # Book index; run after a data import or a bulk
                             # name/page edit, not on a schedule

# Discord bot commands
bun run deploy-commands          # Deploy slash commands to test guild
bun run deploy-commands:global   # Deploy globally (production)

# Building
bun run build            # Full build (package + reference site + ITUN)
                         # The bot has no build: wrangler bundles its Worker.
bun run build:web        # Build srd only (= `bun ssg/build.ts` in apps/srd)
bun run build:itun       # Build ITUN app

# srd build + output gate (run from apps/srd, not the root)
bun ssg/build.ts         # The static build: vite client build -> render every
                         # route -> endpoints, sitemap, PWA
bun --filter srd gate             # build, then diff the output against the committed
                         # snapshot. `bun --filter srd snapshot:update` re-blesses it —
                         # commit that diff, it IS the change. See "srd App".
```

### Architecture

**Workspace structure:**

- `apps/srd/` - Static SRD reference site (in-house SSG at `apps/srd/ssg`, React 19 islands, Tailwind v4, Vite). No auth, no backend, no user data. **Not Astro** — Astro was removed; see the "srd App" section below.
- `apps/itun/` - Character builder & game manager (React 19, TanStack Router/Query, ShadCN + Tailwind v4, Vite). Has roster, wizards, dashboard, live sheets, snapshot sharing. **Two storage modes** ([ADR-030](docs/adrs/ADR-030-accounts-games-server-of-record.md), which supersedes ADR-001): **Solo** — not signed in, IndexedDB is the source of truth, nothing is gated. This describes a build with the account gate OFF (no `VITE_CONVEX_URL`: CI, a fresh checkout, `bun run dev`). It is **no longer a forever guarantee** — [ADR-034](docs/adrs/ADR-034-account-required-persistence.md) withdrew it and has shipped, so a production-mode build gives an anonymous visitor the in-memory backend instead; **Connected / Disconnected** — signed in, Convex (`apps/itun/convex/`) is the source of truth and IndexedDB becomes a cache, with offline meaning read-only rather than a write queue. Resolve the mode through `src/lib/connection/`, never by reading `navigator.onLine` or an auth flag directly. Read [`apps/itun/CLAUDE.md`](apps/itun/CLAUDE.md) before touching data.
- `apps/discord-bot/` - Discord.js bot for rolling on Salvage Union tables
- `apps/su-assets/` - Cloudflare Worker (`assets.salvageunion.io`) serving licensed entity artwork from the `su-lp-assets` R2 bucket, with the `-440`/`-880` derivatives rendered on demand through Cloudflare Images. Image bytes live in R2, never in git. `packages/salvageunion-reference` points at it at runtime (`ASSET_BASE_URL` in `lib/assets.ts`, re-exported from `lib/utilities.ts`), so entity-card artwork in both `srd` and `itun` depends on it.
- `packages/component-lib/` - Shared React component library (ShadCN + Tailwind, entity display system, base typography, UI primitives). No build step, exports TypeScript source.
- `packages/observability/` - Sentry wiring: `/cloudflare` for the three Workers (`withObservability`, `reportError`, the cron check-in) and `/browser` for the capture-hint helper the two browser shims share (imports no Sentry code). The `/node` subpath is **deleted**: the Discord bot's Node gateway was its only consumer.
- `packages/salvageunion-reference/` - TypeScript ORM + schema-validated JSON dataset for game data

**Dependency graph:**

```
salvageunion-reference (game data ORM)
  └── component-lib (shared UI components)
        ├── srd (static reference site)
        └── itun (character builder + game manager)
discord-bot (standalone, depends on salvageunion-reference)
```

**Key dependency:** `salvageunion-reference` ships TypeScript source directly (like `component-lib`) — apps resolve `lib/index.ts` with no build step. `bun run build:package` now only regenerates `schemas/*.schema.json` from the Zod sources; run it after schema or data changes and commit the result (CI fails on drift). The Discord bot bundles the package source into its own `dist/` via `bun build`.

### Architecture Reference

Detailed cross-cutting architecture docs live in `docs/architecture/`:

- **[display-system.md](docs/architecture/display-system.md)** — The **two card shells**: `ReferenceEntityCard` (THE renderer for every SRD entity, in both apps) and `Card` (the generic four-band container everything non-entity composes). There is no single stack and no middle layer.
- **[data-flow.md](docs/architecture/data-flow.md)** — Reference data + player data resolution, TanStack Query patterns, IndexedDB hydration
- **[seo-accessibility.md](docs/architecture/seo-accessibility.md)** — SEO strategy (srd) and WCAG 2.1 AA compliance patterns
- **[package-contracts.md](docs/architecture/package-contracts.md)** — Package APIs, dependency rules, cross-package change checklist

### Code Conventions

Relative imports only, `type` over `interface`, no `any`, `import type`, named
exports outside route components — **all five are Biome rules**, so `bun run
lint` is the authority, not this list. See [`biome.jsonc`](biome.jsonc) and
[`.claude/rules/typescript-style.md`](.claude/rules/typescript-style.md).

Not enforced, so stated here: **Bun** for package management (never npm/yarn),
and Biome cannot parse Markdown or YAML — `.md`/`.yml` are formatted by
**nothing**, so keep them tidy by hand.

### `.claude/rules/` — read the one that matches the task

These are **not** all loaded automatically, and which of them a session receives
is not something to rely on. Nothing here imports them, deliberately: inlining
all nine would cost more context than the whole dependency section this file
just moved out. So the index is the contract — open the file when the task is
in its area, and do not assume you have already been given it.

| Rule                                                                     | Read it when                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [`typescript-style.md`](.claude/rules/typescript-style.md)               | Writing any TS. Mostly Biome-enforced; the file explains the intent.       |
| [`testing-patterns.md`](.claude/rules/testing-patterns.md)               | **Writing or fixing any test.** The `mock.module` / preload hazards here are process-global and have cost this repo whole afternoons. |
| [`react-components.md`](.claude/rules/react-components.md)               | Adding or reshaping a component.                                          |
| [`display-system.md`](.claude/rules/display-system.md)                   | Touching entity cards or the two card shells.                             |
| [`tanstack-router.md`](.claude/rules/tanstack-router.md)                 | Adding or changing an ITUN route.                                         |
| [`tanstack-query-hooks.md`](.claude/rules/tanstack-query-hooks.md)       | Adding a data hook.                                                       |
| [`package-development.md`](.claude/rules/package-development.md)         | Changing `salvageunion-reference` schemas or data.                        |
| [`monorepo-patterns.md`](.claude/rules/monorepo-patterns.md)             | Adding a workspace or a cross-workspace dependency.                       |
| [`stacked-prs.md`](.claude/rules/stacked-prs.md)                         | **Before any multi-layer PR stack.** Squash-merge plus `delete_branch_on_merge` makes `--force` able to resurrect merged branches; the recovery is `rebase --onto`. |

### salvageunion-reference Package

All TypeScript source in `lib/` is hand-written (Zod schemas in `lib/schemas/`, models in `lib/index.ts`, etc.). The only auto-generated files are `schemas/*.schema.json` (from Zod schemas), produced by `bun run build:package`. The package has no compile step — consumers import the TS source.

**Do not manually edit** `schemas/*.schema.json`. To change JSON Schema output, edit Zod schemas in `lib/schemas/` and rebuild.

Models extend `BaseModel<T>`, created via `ModelFactory`, accessed via `SalvageUnionReference.{SchemaName}` static properties (e.g., `SalvageUnionReference.Chassis.find(...)`).

### component-lib Package (Shared Components)

- **No build step** - exports TypeScript source directly via `src/index.ts` barrel. Vite in consuming apps handles `.ts/.tsx`.
- **Contents:** `src/index.ts` **is the public API and the only trustworthy roster** — read it, do not trust a hand-maintained list (this file has twice grown one full of names that no longer exist). Broad categories: theme/tokens, base typography (`Text`), UI primitives (`Toaster`/`toast`, `ModalShell`), chrome primitives (`src/components/chrome/`), stat trackers (`src/components/stat/`), the entity display system (`src/components/referenceEntity/`), shared components (`Card`, `EntityGrid`, `EntitySearcher`, `CatalogTile`, …), the Dashboard shell, sheet presentation, wizard steps, and `cn()`. [`docs/architecture/package-contracts.md`](docs/architecture/package-contracts.md) describes the categories in full and flags what is deliberately **not** exported.
- **No backend dependency** - agnostic to data source.
- **Testing:** Own `bunfig.toml` with happy-dom preload (no backend env vars).

### srd App (Static Reference Site)

**srd is not an Astro app.** It was migrated off Astro onto an in-house static-site
generator built on Vite ([ADR-031](docs/adrs/ADR-031-srd-vite-ssg.md), which
supersedes ADR-012). There are no `.astro` files, no `astro.config.mjs`, no
`astro check`, and no file-based routing. Read
[`apps/srd/ssg/DESIGN.md`](apps/srd/ssg/DESIGN.md) — it is the contract the
generator implements — and then [`apps/srd/CLAUDE.md`](apps/srd/CLAUDE.md).

- **Framework:** in-house SSG at `apps/srd/ssg` (`build.ts` orchestrates, `dev.ts`
  serves, `render.tsx` renders one route to an HTML string). React 19 for
  rendering, Vite 8 for the client bundle. Static output, no server runtime.
- **Routing:** **explicit**, not file-based. Route modules are
  `src/pages/**/*.page.tsx` exporting a `PageModule` (`pattern`, optional
  `getStaticPaths`, `page(ctx) => { meta, children }`) and each one must be
  registered in `ssg/routes.ts`. A page that is not listed there is simply not
  built. Non-HTML outputs (`*.json`, `llms.txt`, search index) are
  `src/endpoints/*.ts` wired through `ssg/endpoints.ts` — endpoints are not routes.
- **Islands:** `<Island name="X" client="idle" props={…} ssr={false} />` emits a
  `<div data-island …>` placeholder; `src/runtime/islands.client.ts` mounts it with
  **`createRoot`, never `hydrateRoot`**. Four client strategies: `load`, `idle`,
  `visible`, `only`. Because mounting is client-only, `ssr` is purely an SEO/no-JS
  choice per island and can never cause a hydration mismatch.
- **Output gate — `ssg/snapshot.ts`.** Run `bun --filter srd gate`. It diffs
  the built `dist` against `ssg/output-snapshot.json`, a committed ~680 KB digest:
  the emitted file set both directions (this is what holds the page count at
  1,039), per-page title/description/canonical/robots as plaintext, an `og:`/
  `twitter:` digest, the JSON-LD `@type` list, a digest of `<main>` text, and all
  899 JSON endpoints plus `llms.txt`. It **runs in CI** — which the Astro-era
  parity gate it replaced never did ([ADR-031](docs/adrs/ADR-031-srd-vite-ssg.md)).
  When a change alters output on purpose, `bun --filter srd snapshot:update` and **commit
  the snapshot diff — one line per page, it is the reviewable statement of what
  your change did to the site.** Its limit is real: it compares against what was
  last blessed, not against an oracle, so re-blessing without reading the diff
  defeats it.
- **Hard rule — no `.css` import may be reachable from an SSR module.** The SSR pass
  runs under Bun and never goes through Vite, so a stray `import './x.css'` anywhere
  in the SSR graph (`ssg/**`, `src/pages/**`, `src/layouts/BaseLayout.tsx`,
  `src/runtime/Island.tsx`) breaks the build. **All** css is imported from
  `src/runtime/styles.entry.ts`, which is a client-bundle entry only.
- **No auth, no backend, no user data.** Pure static reference site.
- **UI:** Tailwind v4 with theme from `component-lib`. React islands for interactive
  components (search, schema viewer, entity display).
- **The zero-JS path is not an island.** `apps/srd/src/components/EntityCardStatic.tsx`
  renders straight into the page tree and ships no JS. It is 82% of entity pages;
  leave it alone.
- **Search:** In-memory search via `salvageunion-reference` package `search()` function. Cmd+K/Ctrl+K shortcut to focus.
- **Testing:** Bun test runner with React Testing Library + happy-dom. No backend env vars needed.
- **Deployment:** Cloudflare Workers Static Assets — no Worker script at all, so every request is an asset lookup

### Data Conventions

- Entity links must use slugs, never UUIDs. Example: `/chassis/iron-mongrel` not `/chassis/550e8400-e29b...`
- When modifying JSON data files (especially crawler output), never use automated formatters like `json.dump` that reformat arrays. Use text-level insertion to preserve original formatting.

### UI Rendering Conventions

- When rendering lists of entities (roll tables, equipment, drones, etc.), default to compact header-only clickable listings unless explicitly asked for full inline displays. Never render nested entities as separate grids — always render them inside their parent's expanded/modal view.
- Reuse existing UI components (e.g., pseudoheader components with black backgrounds) before creating new CSS-based alternatives. Check the component library first.

### Development Workflow

In the entity display system, card size is TWO orthogonal axes — `size` (`large | medium | small`) and `extent` (`full | head | catalog`) — defined in `packages/component-lib/src/components/shared/displayMode.ts`. Nested cards derive their own rendering from these plus their nesting depth, rather than reading a shared context.

This paragraph previously described a `ReferenceEntityDisplayContext` in a `displayStateContext.ts`, carrying `compact` / `spacing` / `fontSize` / `damaged` / `disabled`. None of that exists: the context, the file, and the `compact` / `listing` booleans were all removed when `ReferenceEntityCard` replaced the legacy render core. It is recorded here because this file is loaded into every session, so a stale claim in it is followed rather than checked — an agent would have gone looking for a context that had not existed for months.

When adding a prop that must reach nested cards, pass it explicitly and run typecheck immediately after the edit.

### Debugging

For styling bugs, check Tailwind configuration (@source paths, plugin setup) early before diving into component/data logic. Many visual bugs trace back to Tailwind config rather than application code.

**Profile in markdown, not in `.cpuprofile`.** Bun can emit its CPU and heap
profiles as grep-friendly markdown, which is readable in a terminal and in a
transcript — a binary profile that needs a flamegraph UI is close to useless to
an agent, and most of the work in this repo is done by one:

Write the artifacts to `.profiles/`, which is gitignored — the profilers and
`--metafile-md` otherwise drop files in the cwd, and the next `git add -A`
sweeps them into a commit.

```bash
# where the time went (any bun-run script)
bun --cpu-prof --cpu-prof-md --cpu-prof-dir=.profiles tools/check-doc-drift.ts
# what was retained — from apps/srd, since ssg/build.ts resolves relative to it
bun --heap-prof --heap-prof-md --heap-prof-dir=../../.profiles ssg/build.ts
# module graph + a "Raw Data for Searching" section, for bundle-size questions
bun build --metafile-md=.profiles/graph.md --outdir=.profiles/build \
  --target node apps/discord-bot/src/index.ts
```

**`--outdir` is not optional there.** `bun build` with no `--outdir` writes the
bundle to *stdout*, so omitting it dumps the whole 2 MB Discord bot into your
terminal and the transcript — the exact thing this section exists to avoid.

`--cpu-prof-interval` tightens the 1000µs default sampling when a hot path is
too short to sample. (It is real but undocumented — it appears in `bun --help`
for the pinned Bun, not in the bundled markdown docs, so don't "correct" it away.) These
are diagnostics: nothing in `check` or CI runs them, and they should not be
wired in.

### Pre-commit Hooks (Lefthook)

Pre-commit runs: lint --fix, format (parallel). Typecheck does NOT run pre-commit.
Pre-push runs (parallel): typecheck, test, validate:all, knip, check:tokens,
check:styling, lint, check:schemas.

**Pre-push `test` is scoped, and CI's is not.** It runs `bun test --changed=<merge-base
with origin/main>`, which selects by **module graph**: one edit to
`displayMode.ts` pulls in 37 of component-lib's 84 test files (2.3s), while a
docs-only push selects nothing and skips the full ~32s sweep. CI still runs the
entire suite on every PR — that is the gate. For the full sweep locally, run
`bun run test`, which is unchanged.

**`--changed` does not cross workspace boundaries** — the one thing to know
before trusting it. Editing `packages/salvageunion-reference/lib/utilities.ts`
selects 27/49 of that package's own tests but **zero** of component-lib's, which
consumes it. The hook therefore diffs the shared surface first (`packages/`,
`test/`, `bunfig.toml`, the root manifests, any `apps/*/package.json`) and runs
the **full** suite when any of it moved; only app-source-only pushes take the
fast path. Don't "simplify" that away.

### Merging — no merge queue

`main`'s ruleset is `deletion`, `non_fast_forward`, `required_linear_history` and
`required_status_checks`. **There is no `merge_queue` rule.** Merge with:

```bash
gh pr merge <pr> --squash          # or --auto --squash to wait for green
```

Both work, and a merged PR reports `MERGED` with a real `mergedAt` immediately.

> This section previously described a merge queue at length and instructed the reader
> **not to believe a successful merge** — to treat an `OPEN` PR with a null `mergedAt`
> as normal and go read the queue via GraphQL instead. The queue was removed from the
> ruleset and the section outlived it, so the one instruction it gave with real force
> was to distrust a correct result. Verify the current rules rather than trusting this
> paragraph: `gh api repos/SalvageUnion-io/SU-SRD/rulesets --jq '.[].id'`, then
> `gh api repos/SalvageUnion-io/SU-SRD/rulesets/<id> --jq '.rules[].type'`.

Dependabot PRs need no special handling now that there is no queue: a
`GITHUB_TOKEN`-driven auto-merge workflow can merge them directly, which was
impossible while the queue existed.

### Project Skills (`.claude/skills/`)

Six skills, and each encodes a **decision procedure or a silent failure mode** — something you would get wrong by reading the command alone:

- `/stacked-pr` — recover a stacked PR after the layer beneath it merges. `gh pr update-branch` cannot do it (the duplicated commit collides with its own squashed self), the fix is `git rebase --onto` from a tip you must record *before* rebasing, and on this repo a bare `--force` can resurrect an already-merged branch.
- `/srd-gate` — change srd's output safely. Two commands; the failure mode is re-blessing the snapshot without reading the diff, which is invisible because a re-blessed snapshot is green by construction. Also carries what the gate deliberately does **not** cover, so a green gate is not trusted for the wrong thing.
- `/triage` — read every production and CI signal, then propose the day's work in priority order.
- `/component-refresh` — redesign an existing component through the three-level loop (real SSR "before" → NEW\* Ladle comparison → staged cutover).
- `/knip-triage` — resolve a knip dead-code failure. The command is one line; the failure mode is applying the wrong rule, so this encodes the decision procedure (delete by default; `@public` / `@knipignore` are the only exemptions and `@knipignore` requires showing the export is consumed).
- `/convex-deploy-verify` — configure and verify an ITUN Convex deployment without signing in. Every failure on that path is silent and misattributes, so it carries the three required env vars, the `.convex.site` vs `.convex.cloud` distinction, the curl probe **including its bogus-provider control**, and presence-by-length (`convex env get` exits 0 for a variable that does not exist).

**Six wrapper skills were deleted** — `/build-package`, `/generate`, `/validate`, `/verify`, `/a11y-scan`, `/deploy-bot`. Each was frontmatter around a single `bun run` this file already documents, none had ever been invoked in ~1,500 transcripts, and two had gone stale in a way that actively misled: `/verify` told you to run bare `bun test` and `/generate` described a compile step the package has not had since it started shipping source. A wrapper that adds no judgement is a second place for the command to rot. Run the script.

There is deliberately **no `/commit`**. It was four lines with no frontmatter, and its last step — "commit and push to the current branch" — is a direct push to `main` when HEAD is `main`, which the user-level rebase-guard blocks anyway. Use `/ship` (user-level) or the `commit-commands` plugin.
