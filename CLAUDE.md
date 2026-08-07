# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Hub

**Start here for navigation:** [`docs/README.md`](docs/README.md) maps user intent → relevant doc (architecture, ADRs, per-package CLAUDE.md).

- [`docs/adrs/`](docs/adrs/) — architecture decision records, **31 of them** (ADR-001 through ADR-031). Consult the matching ADR before revisiting a prior decision, and **read its `## Status` header first** — several are superseded and the supersession is only recorded there (ADR-001 → ADR-030; ADR-012 → ADR-031; ADR-023 → ADR-027 → ADR-028). The three that govern:
  - [ADR-030](docs/adrs/ADR-030-accounts-games-server-of-record.md) — accounts, Games, and Convex as the server of record for identity/ownership/sharing. **Supersedes ADR-001** (local-first, no backend, no auth) and amends ADR-022. Decision accepted; delivery is phased — see [`docs/architecture/accounts-and-games.md`](docs/architecture/accounts-and-games.md) for what has actually landed.
  - [ADR-021](docs/adrs/ADR-021-itun-surface-taxonomy.md) — the surface/mode taxonomy for **where a rule is enforced**. ADR-030 adds an ownership axis to it without changing its enforcement modes.
  - [ADR-007](docs/adrs/ADR-007-automation-boundary.md) — the automation boundary. Read before building rules-driven features.

  ADR-015–020 cover the Dashboard play surface, built at `apps/itun/src/components/dashboard/`.

- [`docs/architecture/`](docs/architecture/) — cross-cutting architecture (display system, data flow, package contracts, rules-engine boundary, combat loop, SEO/a11y).
- `docs/rules/` — agent-readable digest of the Salvage Union core rules + expansions (turn loop, heat, damage, salvage, creation, GM guidance, Meld/Chimerium subsystems). **Generated, gitignored, not committed** (condensed from the copyright-bearing PDFs in `rules/`, also gitignored) — produce it locally with `bun run rules:regen`, then read it instead of re-parsing the PDFs. Generator/manifest: `tools/rules-digest/`.

## Critical Rules

- Do NOT add features, schema changes, or UI elements that were not explicitly requested. Stay strictly within the scope of what the user asked for. If you think something additional would be beneficial, mention it as a suggestion but do not implement it.
- When the user asks to 'plan' or 'prepare' something, the scope is document/plan creation only — do NOT begin implementation unless explicitly asked to implement.

## UI Development

- Always reuse existing shared components (e.g., `ReferenceEntityCard`, `Card`) rather than building custom one-off UI. Check for existing patterns in the shared packages first before creating new components.
- When making CSS/layout changes, get the first attempt right by carefully considering the rendering context (e.g., float doesn't work inside grid/flex containers). If a visual change requires iteration, ask the user to confirm via screenshot before making further adjustments. Prefer simple, well-understood CSS patterns over clever approaches.
- For UI components, prefer compact/listing card displays by default (header-only, clickable) rather than full inline expanded displays. Ask if unsure about the level of detail to render.

## Build & Validation

This is a TypeScript monorepo with shared packages (component-lib, etc.). After any cross-package changes, always run typecheck, tests, and lint before considering a task complete. When modifying shared components, check all consuming apps for regressions (especially Tailwind @source paths and import changes).

### Root Dev Dependencies (Intentional)

- **`playwright`** — Used by `tools/a11y-scan.ts` for WCAG accessibility audits. Not dead code. It is a _root_ dependency because that scanner lives in `tools/`, outside any workspace; the apps depend on `@playwright/test` separately for their e2e suites. This replaced `puppeteer-core`, which shipped no browser and had to borrow Playwright's Chromium — one browser stack now, not two.
- **`sharp`** — Used by `tools/convert-lp-assets-to-webp.ts` to transcode the `lp-assets` Netlify Blobs artwork to WebP (`bun run assets:webp`). Not dead code.

### Dead-code gate (knip)

`bun run knip` runs with **`includeEntryExports: true`**, so it also reports unused
exports of _entry_ files — which is where a workspace-internal package's whole
public API lives. Without it knip stays green while an entire export surface rots
(this is how 72 dead exports accumulated in `salvageunion-reference`).

Two escape hatches, both configured via `tags` in `knip.json`:

- **`@public`** — the export is deliberately public or is a framework contract
  invoked rather than imported (e.g. a Netlify Functions handler). Tag the export.
- **`@knipignore`** — a genuine knip false positive. Only use this when you can
  show the export _is_ consumed (e.g. deleting it fails typecheck), and say so in
  the tag comment.

Whole workspaces whose entry file legitimately _is_ the public surface set
`includeEntryExports: false` per-workspace: `component-lib` (barrel is the library
API), `srd` (`*.page.tsx` route + endpoint modules, consumed by `ssg/routes.ts`
and `ssg/endpoints.ts`), `su-assets` (platform handlers).

When knip flags something, the default is to **delete it** — reach for a tag only
in the two cases above. Deleting dead code often cascades (its callees become dead
in turn), so re-run knip after each removal.

## Repository Overview

Bun monorepo ("SURef") for Salvage Union (tabletop RPG) tools, located in the `SU-SRD/` subdirectory. Contains a static reference site, a character builder app, a Discord bot, and shared packages.

## External Integrations & MCP Servers

**The registry lives in [`docs/architecture/agent-tooling.md`](docs/architecture/agent-tooling.md)** — every site id, service id, org slug, deployment name and dashboard URL, plus how each MCP server authenticates and how to re-derive any of it. Read that instead of listing every project on an account. This section is the summary.

The project-scoped [`.mcp.json`](.mcp.json) is committed (Claude Code prompts each contributor to approve it per-project) and declares **six** servers — Netlify, Sentry, Render, GitHub, Convex, Context7:

- **Netlify** — hosts three sites: `apps/srd` (static, no functions), `apps/itun` (static SPA + the snapshot backend Netlify Functions + Blobs; see `apps/*/netlify.toml` and [ADR-004](docs/adrs/ADR-004-snapshot-netlify-functions.md)), and `apps/su-assets` (`assets.salvageunion.io` — one function serving licensed entity artwork out of the `lp-assets` Netlify Blobs store; `salvageunion-reference` resolves artwork URLs against it at runtime). MCP server: official `@netlify/mcp`, run over stdio via `npx`; authenticates through the Netlify CLI/OAuth.
- **Sentry** — browser + server error tracking for all three code apps (`@sentry/browser` in `srd` and `itun`, `@sentry/node` in `itun` and `discord-bot`, `@sentry/vite-plugin` for `itun` release artifacts). MCP server: remote HTTP at `https://mcp.sentry.dev/mcp`.
- **Render** — hosts `apps/discord-bot` as a worker (see `render.yaml`). MCP server: hosted HTTP at `https://mcp.render.com/mcp`.
- **GitHub** — repo host + Actions CI + PR workflow. MCP server: remote HTTP at `https://api.githubcopilot.com/mcp/`. **This one does not work unconfigured** — the endpoint does not support dynamic client registration, so it needs a machine-local PAT header; see the registry doc. Until then, use the `gh` CLI.
- **Convex** — the **server of record** for accounts and Games ([ADR-030](docs/adrs/ADR-030-accounts-games-server-of-record.md)); the backend lives in `apps/itun/convex/` (17 modules — `auth.ts`, `games.ts`, `invites.ts`, `proposals.ts`, `mediator.ts`, `http.ts`, …) and the phased delivery plan is [`docs/architecture/accounts-and-games.md`](docs/architecture/accounts-and-games.md). MCP server: stdio via `bunx convex mcp start --project-dir apps/itun`, authenticating with the Convex CLI's own device credentials. It targets the **dev** deployment resolved from `CONVEX_DEPLOYMENT`, so run `bunx convex dev` once or every tool call fails; production access is gated behind flags that are deliberately **not** set.

- **Context7** — version-pinned library documentation, remote HTTP at `https://mcp.context7.com/mcp`. Keyless on the free tier, so it adds no credential. It is here because this repo pins hard and runs ahead of model training data (TypeScript 7 + the `typescript-classic` 6 alias, Vite 8, Tailwind 4.3, Convex 1.43, TanStack Router 1.170) — "what is the API in **this** version" is the recurring failure. Two tools, the smallest context cost of any server here. Treat what it returns as advisory: the docs are condensed, not authoritative.

`.mcp.json` is **secret-free by design.** It carries transport, command and URL only — no `Authorization` headers, no tokens, and deliberately **no `${VAR}` placeholders** (#291 removed those on purpose; do not reintroduce them). Authenticate each remote server locally — OAuth on first connect, or machine-local Claude Code config that is never committed.

**`claude mcp list` is the only way to know a server works.** Zero tool calls is indistinguishable from broken, and two of these authenticate outside the file.

**Sentry's failure mode is silent, and CI guards it.** Both browser apps env-gate the SDK on a DSN, so with no DSN Vite tree-shakes Sentry out and the build looks identical to a working one; and even with a DSN, a `connect-src` that omits Sentry's ingest origin blocks every event in the browser while still looking healthy. `tools/check-observability.ts` checks both halves together (wired into `validate:all` via `bun run validate:observability`) and asserts its `SENTRY_INGEST_HOST` constant against both apps' `netlify.toml` CSPs. **If you change the CSP or the Sentry region, change both in lockstep** — `apps/srd/netlify.toml` carries the reciprocal comment.

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
bun run dev:bot          # Start Discord bot locally
bun run dev:itun         # Build package + start ITUN app dev server

# Testing
bun run test             # Canonical: runs each workspace with its own bunfig.
                         # This is what CI and pre-push run — prefer it.
bun test                 # Also works now. The root bunfig.toml preloads the
                         # UNION of the workspace preloads, so a bare root run
                         # is green (4712 pass). It used to fail by the hundreds
                         # (639) purely from missing preloads; that is fixed.
bun --filter salvageunion-reference test   # Test package only
bun --filter component-lib test              # Test shared components only
bun --filter srd test                # Test reference site only
bun --filter itun test         # Test ITUN app only

# Code quality
bun run check:fast       # ~12s inner loop: lint + validate:all + knip (parallel),
                         # then typecheck. THE "did I break anything" command —
                         # reach for this while iterating, not check:all.
bun run lint             # Lint all packages (Biome)
bun run format           # Format all packages (Biome — the ONLY formatter; .md/.yml are formatted by nothing)
bun run typecheck        # TypeScript check all packages
bun run check:all        # Full CI check (adds format, test, audit, tokens, styling,
                         # schema-drift). ~35s — run before pushing, not per-edit.

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

# Local-only diagnostics — deliberately NOT in check:all or CI. These read the
# copyright-bearing PDFs in rules/, which are gitignored and absent in CI, so
# there they would be a check that passes by doing nothing. Each no-ops with a
# notice and exit 0 when the extract is missing. Advisory: read the findings,
# do not apply them blind. See README.md "Local-only diagnostics".
bun run rules:extract        # PDF → rules/extracted/ text layer (prerequisite)
bun run rules:regen          # Regenerate the docs/rules/ agent digest
bun run check:printed-names  # Diff every entity name + page against the Core
                             # Book index; run after a data import or a bulk
                             # name/page edit, not on a schedule

# Discord bot commands
bun run deploy-commands          # Deploy slash commands to test guild
bun run deploy-commands:global   # Deploy globally (production)

# Building
bun run build            # Full build (package + reference site + ITUN + bot)
bun run build:web        # Build srd only (= `bun ssg/build.ts` in apps/srd)
bun run build:itun       # Build ITUN app
bun run build:bot        # Build Discord bot

# srd static build (run from apps/srd, not the root)
bun ssg/build.ts         # The static build: vite client build -> render every
                         # route -> endpoints, sitemap, PWA
                         # There is NO whole-page-output gate — the Astro
                         # migration's parity script is retired. See "srd App".
```

### Architecture

**Workspace structure:**

- `apps/srd/` - Static SRD reference site (in-house SSG at `apps/srd/ssg`, React 19 islands, Tailwind v4, Vite). No auth, no backend, no user data. **Not Astro** — Astro was removed; see the "srd App" section below.
- `apps/itun/` - Character builder & game manager (React 19, TanStack Router/Query, ShadCN + Tailwind v4, Vite). Has roster, wizards, dashboard, live sheets, snapshot sharing. **Two storage modes** ([ADR-030](docs/adrs/ADR-030-accounts-games-server-of-record.md), which supersedes ADR-001): **Solo** — not signed in, IndexedDB is the source of truth, nothing is gated, and this must keep working forever (a build with no `VITE_CONVEX_URL` is permanently Solo); **Connected / Disconnected** — signed in, Convex (`apps/itun/convex/`) is the source of truth and IndexedDB becomes a cache, with offline meaning read-only rather than a write queue. Resolve the mode through `src/lib/connection/`, never by reading `navigator.onLine` or an auth flag directly. Read [`apps/itun/CLAUDE.md`](apps/itun/CLAUDE.md) before touching data.
- `apps/discord-bot/` - Discord.js bot for rolling on Salvage Union tables
- `apps/su-assets/` - Dedicated Netlify site (`assets.salvageunion.io`) serving licensed entity artwork from a Netlify Blobs store via one function. Image bytes live in Blobs, never in git. `packages/salvageunion-reference` points at it at runtime (`ASSET_BASE_URL` in `lib/utilities.ts`), so entity-card artwork in both `srd` and `itun` depends on it.
- `packages/component-lib/` - Shared React component library (ShadCN + Tailwind, entity display system, base typography, UI primitives). No build step, exports TypeScript source.
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

### Code Conventions (from `.claude/rules/`)

- **Always use relative imports** (never `@/` path aliases)
- **Use `type` over `interface`** for object types (unless extending)
- **Avoid `any`** - use `unknown` if type is truly unknown
- **Use `import type`** syntax for type-only imports
- **Named exports** everywhere except route components (which may use default exports for TanStack Router)
- **Bun** for all package management (not npm/yarn)
- **Biome** for formatting/linting — the **only** formatter. Prettier has been removed entirely (it is not a dependency, and `lefthook.yml` has no Markdown/YAML step). Biome still cannot parse Markdown or YAML, so `.md`/`.yml` are formatted by **nothing** — keep them tidy by hand. Pre-commit hooks via Lefthook

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
- **There is NO whole-page-output gate.** The Astro-migration parity script was
  retired once the migration was long finished and its baseline was gone
  ([ADR-031](docs/adrs/ADR-031-srd-vite-ssg.md) anticipated this and called the
  shelf life in the original decision). Nothing now compares the built `dist`
  against a known-good reference, so a change that silently alters every page's
  `<main>` text or drops a JSON-LD block is caught by no automated check. **A
  green build is not evidence the output is right** — verify rendering/routing/emit
  changes by reading the emitted HTML or serving `dist` and measuring the real
  page, not by reasoning about the diff.
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
- **Deployment:** Netlify (static site, no server functions)

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

### Pre-commit Hooks (Lefthook)

Pre-commit runs: lint --fix, format (parallel). Typecheck does NOT run pre-commit.
Pre-push runs (parallel): typecheck, test, validate:all, knip, check:tokens,
check:styling, lint, check:schemas.

### Merging — `main` is behind a merge queue

`main`'s ruleset (`deletion`, `non_fast_forward`, `required_linear_history`,
`required_status_checks`, **`merge_queue`**) means a PR is **enqueued, never merged
directly.** Enqueue with:

```bash
gh pr merge <pr> --auto --squash
```

**A plain `gh pr merge <pr> --squash` does not fail — and does not merge.** It prints
only `! The merge strategy for main is set by the merge queue`, **exits 0**, and adds
the PR to the queue. Every obvious success signal is absent afterwards: the PR is still
`OPEN`, `mergedAt` is `null`, `mergeCommit` is `none`, and `autoMergeRequest` is `off`.
That combination looks exactly like a silent no-op, so **do not conclude the merge
failed and retry** — read the queue itself:

```bash
gh api graphql -f query='{repository(owner:"SalvageUnion-io",name:"SU-SRD"){
  mergeQueue(branch:"main"){entries(first:20){nodes{position state
  pullRequest{number}}}}}}'
```

A queued PR stays `OPEN` until the queue merges it, so **PR state alone is never proof
of anything** here. The queue is also the reason a PR can go green and still sit
unmerged: it re-tests each entry against the projected merge, and ejects any that
conflicts rather than merging it.

Note that `gh pr merge --auto` is what Dependabot PRs need too. A merge queue is
mutually exclusive with a `GITHUB_TOKEN`-driven Dependabot auto-merge workflow, since
that token cannot enqueue — so Dependabot PRs here require an enqueue from a PAT-backed
session (or a human) and will otherwise sit open indefinitely.

### Project Skills (`.claude/skills/`)

When to reach for which skill (overlap explained):

- `/build-package` — regenerate `salvageunion-reference`'s generated artifacts (registry, `schemas/*.schema.json`, API report). **There is no TypeScript compile step** — the package ships TS source. Use after Zod schema or data-file edits.
- `/generate` — same as above **plus** `validate:all` (IDs, cross-refs, action refs). Use when you've changed JSON data and want integrity checks in one step.
- `/validate` / `/verify` — run the full CI suite via `check:all`. `/verify` is a literal alias of `/validate`, so they genuinely do the same thing; either name works.
- `/a11y-scan` — WCAG 2.1 AA scan via Playwright + axe-core (srd). **Not puppeteer** — `tools/a11y-scan.ts` moved to Playwright so the repo has one browser stack, not two (see "Root Dev Dependencies" above).
- `/triage` — read every production and CI signal, then propose the day's work in priority order.
- `/component-refresh` — redesign an existing component through the three-level loop (real SSR "before" → NEW\* Ladle comparison → staged cutover).
- `/knip-triage` — resolve a knip dead-code failure. The command is one line; the failure mode is applying the wrong rule, so this encodes the decision procedure (delete by default; `@public` / `@knipignore` are the only exemptions and `@knipignore` requires showing the export is consumed).
- `/convex-deploy-verify` — configure and verify an ITUN Convex deployment without signing in. Every failure on that path is silent and misattributes, so it carries the three required env vars, the `.convex.site` vs `.convex.cloud` distinction, the curl probe **including its bogus-provider control**, and presence-by-length (`convex env get` exits 0 for a variable that does not exist).
- `/deploy-bot` — deploy Discord slash commands.

There is deliberately **no `/commit`**. It was four lines with no frontmatter, and its last step — "commit and push to the current branch" — is a direct push to `main` when HEAD is `main`, which the user-level rebase-guard blocks anyway. Use `/ship` (user-level) or the `commit-commands` plugin.
