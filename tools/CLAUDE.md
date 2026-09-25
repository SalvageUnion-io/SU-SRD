# tools/ — the repo's gates and one-off scripts

Every file here is run directly by Bun (`bun tools/<name>.ts`), usually through
a root `package.json` script. Most are **gates**: `bun run check` runs them via
`validate:all` and the other `check:*` scripts, and CI runs the same set. Each
script's header docstring carries the full reasoning; this index is for the
moment one fails and you need to know what it guards and how to fix it.

**Before editing a checker:** its tests live in `tools/__tests__/` (run with
`bun run test:tools`). A gate that scans a tree must prove it scanned one —
use `tools/lib/scanFloor.ts` (collapsed corpus) and
`tools/lib/workspaceCoverage.ts` (a workspace missing from the list), and print
the corpus size, not just the finding count.

## Gates in `bun run check`

| Script | Run as | Guards | When it fails | Baseline |
| --- | --- | --- | --- | --- |
| `check-architecture.ts` | `validate:architecture` | No `SalvageUnionReference` accessor call at module scope (it throws "Schema not loaded" before `preload()`). | Move the call inside a function or component. | — |
| `check-bun-version.ts` | `validate:all` | `.bun-version` agrees with the root `bun-types`, and every workflow sets Bun up through `.github/actions/setup-bun` rather than an inline version. | Bump the stragglers to `.bun-version`; never the reverse without meaning to. | — |
| `check-doc-drift.ts` | `validate:doc-drift` | Live docs, skills, rules, agent memory and workflow prompts stay true: exports map, workspace list, superseded ADRs, component-lib symbols, framework majors, `bun run` scripts, counts, MCP servers, ADR routing, and every cited repo path existing. | Fix the doc. If a citation is deliberately historical, mark it right beside the path ("`x.ts` (since deleted)", "`x.ts` was deleted"). | — |
| `check-observability.ts` | `validate:observability` | Sentry can actually report: DSN-gated SDK, each app's `public/_headers` CSP allows `SENTRY_INGEST_HOST`, each Worker wraps `withObservability` and grants `nodejs_als`. `--live` probes production. | Change the CSP / Sentry wiring in every source for that app together. | — |
| `check-convex-codegen.ts` | `validate:convex-codegen` | `apps/itun/convex/_generated/api.d.ts` registers exactly the module files on disk. | Regenerate with `bunx convex dev` (needs a deployment); never hand-edit `_generated/`. | — |
| `check-convex-callers.ts` | `validate:convex-callers` | Every public Convex query/mutation/action has a caller in shipped client code (tests do not count). | Delete the function, or make it `internal*` if only the server calls it. | — |
| `check-convex-parity.ts` | `validate:convex-parity` | Static: `.github/workflows/deploy-cloudflare.yml` still runs `convex deploy` and still fails a production deploy with no `CONVEX_DEPLOY_KEY`. `--live` (nightly): every function the repo defines exists on the deployment. | Static: restore the guard step. Live: deploy the backend. | — |
| `check-catalog.ts` | `check:catalog` | `workspaces.catalog`: no package pinned by literal in 2+ manifests, no stray literal for a catalogued package, no entry with fewer than 2 consumers. | Catalogue it, use `catalog:`, or un-catalogue an orphan. See `docs/architecture/dependency-management.md`. | — |
| `check-action-pinning.ts` | `check:action-pinning` | Every third-party GitHub Action is pinned to a full SHA (`actions/*`, `github/*` exempt). | Pin to the SHA with the tag in a trailing comment. | — |
| `check-path-filters.ts` | `check:path-filters` | Every `workspace:*` dependency of an app appears in that app's CI path filter, so a change to it cannot skip the app's build. | Add the path to the filter group in `.github/workflows/ci.yml`. | — |
| `check-srd-css-ownership.ts` | `check:srd-css` | srd's hard rule 1: every stylesheet is imported from `apps/srd/src/runtime/styles.entry.ts`, none from the SSR graph. | Move the import into `styles.entry.ts`. | — |
| `check-worker-env.ts` | `check:worker-env` | Each Worker's hand-written `Env` type lists exactly the bindings its `wrangler.jsonc` declares. | Rename both sides together. | — |
| `check-design-tokens.ts` | `check:tokens` | Design-token laws from `docs/design-system/ruleset.md`: no raw colours, gradients, pure white, `su-*` shadow tokens or arbitrary tracking / border / radius / font-size values. Ratchets down only. | Use a `theme.css` token. After fixing old violations, lower the baseline: `bun run check:tokens --update-baseline`. | `design-tokens-baseline.json` |
| `check-styling-ownership.ts` | `check:styling` | component-lib owns all tokens and shared styling: no app `@theme`, no dead app CSS, no new Tailwind-utility files, and the `.pc-*` class contract. Ratchets down only. | Follow the rule's printed `fix`. Lower (never raise) the baseline with `bun run check:styling --update-baseline`. | `styling-ownership-baseline.json` |
| `check-ci-aggregator.ts` | `check:ci-aggregator` | The one required status check (`quality-checks` in `ci.yml`) `needs:` every other CI job. | Add the new job to its `needs:` list. | — |
| `lint-workflows.sh` | `lint:workflows` | actionlint + zizmor over `.github/`, each fetched at a pinned version and sha256-verified. | Fix the finding; zizmor's config is `.github/zizmor.yml`. To bump a tool, replace every hash for it. | — |

## CI-only and deploy scripts

| Script | Run by | Purpose | Baseline |
| --- | --- | --- | --- |
| `run-coverage.ts` | `test:coverage` (CI) | Runs each workspace's coverage and retries when Bun silently writes no `lcov.info`. | — |
| `coverage-report.ts` | CI coverage job | Aggregates lcov and fails if a workspace drops more than the tolerance below its floor. Raise the floor to lock in a gain. | `coverage-baseline.json` (repo root) |
| `deploy-surfaces.ts` | `.github/workflows/deploy-cloudflare.yml` | Diffs HEAD against the last successful deploy tag and decides which Cloudflare surfaces ship. Fails safe: when unsure it deploys everything. | — |
| `smoke-production.sh` | `deploy-cloudflare.yml` (post-deploy) and `e2e-nightly.yml` (`production-smoke`) | Curls every production surface: status codes, www redirects, CSP/HSTS reaching the browser, the rotated-chunk 404, artwork robots.txt, bot token health. Runs every check, then exits 1 if any failed. | — |
| `a11y-scan.ts` | `.github/workflows/e2e-nightly.yml` | WCAG 2.1 AA scan (Playwright + axe-core). Fails on a violation not accepted per page. | `a11y-baseline.json` |

## Local-only and one-off

| Script | Run as | Purpose |
| --- | --- | --- |
| `extract-rules.ts` | `rules:extract` | Rules PDFs in `rules/` to `rules/extracted/*.txt` with page markers. The PDFs are gitignored; no-ops without them. |
| `check-printed-names.ts` | `check:printed-names` | Entity names and pages against the Core Book index. Advisory; needs the extract. Run after a data import. |
| `prune-stale-worktrees.sh` | `reap` | Dry-run list of abandoned `.claude/worktrees/` checkouts; `--force` removes them via `git worktree remove`. |
| `export-lp-assets.ts` | by hand | Backs up the `su-lp-assets` R2 bucket locally and proves the copy byte-exact. Needs R2 credentials. |
| `upload-lp-assets.ts` | by hand | The artwork ingest path into `su-lp-assets`. Needs R2 credentials. |
| `woff-to-ttf.ts` | by hand | Unwraps `@fontsource` WOFF into TTF for the og:image renderer, which cannot read WOFF. |

`lib/` holds the shared pieces: `scanFloor.ts`, `workspaceCoverage.ts`,
`tailwindClasses.ts` (the styling ratchet's utility detector), `parse-lcov.ts`
and `r2.ts` (a SigV4 R2 client, because `wrangler r2 object` cannot list).
