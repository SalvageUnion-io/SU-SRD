# tools/ — the repo's gates and one-off scripts

Every file here is run directly by Bun (`bun tools/<name>.ts`). Most are
**gates**, and every gate is registered in ONE place: the `CHECKS` list in
[`check.ts`](check.ts). `bun run check`, `bun run check:fast`, lefthook's
pre-push and CI's `static-checks` job all run that registry with a different
profile, so a gate cannot be in one path and missing from another. Each
script's header docstring carries the full reasoning; this index is for the
moment one fails and you need to know what it guards and how to fix it.

```bash
bun run check                 # every gate, in parallel, ending in a pass/fail table
bun run check:fast            # the inner loop: no suite, no srd build, no network
bun run check styling data    # just these (ids below); `bun run check --list` prints them all
```

**Adding a gate:** add an entry to `CHECKS` in `check.ts` (id, command,
profiles, and which CI areas make it relevant). Do not add a step to `ci.yml`
or a command to `lefthook.yml` — both read the registry.

**Before editing a checker:** its tests live in `tools/__tests__/` (run with
`bun run test:tools`). A gate that scans a tree must prove it scanned one —
use `tools/lib/scanFloor.ts` (collapsed corpus) and
`tools/lib/workspaceCoverage.ts` (a workspace missing from the list), and print
the corpus size, not just the finding count.

## The checks in `bun run check`

| Id | Script | Guards | When it fails | Baseline |
| --- | --- | --- | --- | --- |
| `generated` | `check-generated.ts` | Regenerates the reference package's schemas, docs, registry and API report plus ITUN's `routeTree.gen.ts`, then fails on any tracked change OR untracked file. Runs first and alone, because it writes files. | Commit the regenerated files it just wrote; never hand-edit them. | — |
| `test` | `bun run test` | The full suite, every workspace plus `tools/`. Not in the `ci` profile — CI's `coverage` job runs it. | Fix the test. | `coverage-baseline.json` (CI only) |
| `srd-output` | `bun --filter srd gate` | The built srd site against `apps/srd/ssg/output-snapshot.json`. Not in `ci` — `build-srd` runs it. | Use the `/srd-gate` skill: read the diff, then re-bless. | `output-snapshot.json` |
| `typecheck` | `bun run typecheck` | Every workspace, plus `tools/` and `test/` via `tsconfig.tools.json`. | Fix the type error. | — |
| `knip` | `bun run knip` | No unused files, exports or dependencies. | Use the `/knip-triage` skill. | — |
| `biome` | `biome ci .` | Lint, format and import order. | `bun run format`, then fix what remains. | — |
| `data` | `packages/salvageunion-reference/tools/validate.ts` | Eleven data checks over one load: ids, slugs, references, actions, action-backrefs, orphans, content-dupes, traits, parity, double-encoding, schemas. `--only=` runs a subset. | Fix the data; each diagnostic names the file and record. | — |
| `doc-drift` | `check-doc-drift.ts` | Live docs, skills, rules, agent memory and workflow prompts stay true: exports map, workspace list, superseded ADRs, component-lib symbols, framework majors, `bun run` scripts and check ids, counts, MCP servers, ADR routing, and every cited repo path existing. | Fix the doc. If a citation is deliberately historical, mark it right beside the path ("`x.ts` (since deleted)", "`x.ts` was deleted"). | — |
| `architecture` | `check-architecture.ts` | No `SalvageUnionReference` accessor call at module scope (it throws "Schema not loaded" before `preload()`), no inlined pool/gauge default, the component-lib function-size cap. | Move the call inside a function; use `resolvePool`; extract a seam. | — |
| `observability` | `check-observability.ts` | Sentry can actually report: DSN-gated SDK, each app's `public/_headers` CSP allows `SENTRY_INGEST_HOST`, each Worker wraps `withObservability` and grants `nodejs_als`. `bun run check:observability:live` probes production (nightly). | Change the CSP / Sentry wiring in every source for that app together. | — |
| `convex-codegen` | `check-convex-codegen.ts` | `apps/itun/convex/_generated/api.d.ts` registers exactly the module files on disk. | Regenerate with `bunx convex dev` (needs a deployment); never hand-edit `_generated/`. | — |
| `convex-callers` | `check-convex-callers.ts` | Every public Convex query/mutation/action has a caller in shipped client code (tests do not count). | Delete the function, or make it `internal*` if only the server calls it. | — |
| `catalog` | `check-catalog.ts` | `workspaces.catalog`: no package pinned by literal in 2+ manifests, no stray literal for a catalogued package, no entry with fewer than 2 consumers. | Catalogue it, use `catalog:`, or un-catalogue an orphan. See `docs/architecture/dependency-management.md`. | — |
| `worker-env` | `check-worker-env.ts` | Each Worker's hand-written `Env` type lists exactly the bindings its `wrangler.jsonc` declares. | Rename both sides together. | — |
| `workflows` | `check-workflows.ts` | One `Bun.YAML` parse of `.github/`, six checks: `aggregator` (`CI Success` needs every ci.yml job), `path-filters` (every app's `workspace:*` dependency is in its filter group), `pinning` (third-party actions SHA-pinned; undeclared `bunx` tools version-pinned), `bun-version` (`.bun-version` = root `bun-types` = root `packageManager` = the running Bun; no inline pins), `convex-guard` (the deploy still runs `convex deploy`, refuses a missing `CONVEX_DEPLOY_KEY`, and the pushing job needs the guard's job), `deploy-order` (every deploy job needs every build job, smoke needs every deploy, the record needs smoke). `--only=` runs a subset. | The message names the file and the fix. | — |
| `styling` | `check-styling.ts` | Three rule sets on one engine (`lib/ruleEngine.ts`): `tokens` (`rules/designTokens.ts` — no raw colours, gradients, pure white, `su-*` shadow tokens, arbitrary tracking / border / radius / font-size), `styling` (`rules/stylingOwnership.ts` — no app `@theme`, no dead app CSS, the `.pc-*` contract, the package stylesheet import, the Tailwind-file and `.pc-*` ratchets), `srd-css` (`rules/srdCss.ts` — srd imports css only from its client entry; component-lib imports none). | Follow the rule's printed `fix`. `zero` rules have no baseline. A ratchet fails when it rises AND when it falls without the baseline being lowered: `bun tools/check-styling.ts --update-baseline`. `--report` lists every finding. | `styling-baseline.json` |
| `audit` | `bun audit --audit-level=high` | No high-severity advisory. Network; not in `fast`. | See `docs/architecture/dependency-management.md`. | — |
| `actionlint` | `lint-workflows.sh` | actionlint + zizmor over `.github/`, each fetched at a pinned version and sha256-verified. Network on first run; not in `fast`. | Fix the finding; zizmor's config is `.github/zizmor.yml`. To bump a tool, replace every hash for it. | — |

## CI-only, nightly and deploy scripts

| Script | Run by | Purpose | Baseline |
| --- | --- | --- | --- |
| `run-coverage.ts` | `test:coverage` (CI) | Runs each workspace's coverage and retries when Bun silently writes no `lcov.info`. | — |
| `coverage-report.ts` | CI coverage job | Aggregates lcov and fails if a workspace drops more than the tolerance below its floor. Raise the floor to lock in a gain. | `coverage-baseline.json` (repo root) |
| `a11y-scan.ts` | `build-srd` in `ci.yml` (every srd PR) and `e2e-nightly.yml` | WCAG 2.1 AA scan (Playwright + axe-core) of the pages keyed in the baseline. Fails on a violation not accepted per page, and on a stale entry. | `a11y-baseline.json` |
| `check-convex-parity.ts` | `check:convex-parity:live` (nightly) | Every Convex function this repo defines exists on the deployment. Its static half is `workflows`' `convex-guard`. | — |
| `deploy-surfaces.ts` | `.github/workflows/deploy-cloudflare.yml` | Diffs HEAD against the last successful deploy tag and decides which Cloudflare surfaces ship. Fails safe: when unsure it deploys everything. | — |
| `smoke-production.sh` | `deploy-cloudflare.yml` (`smoke` job) and `e2e-nightly.yml` (`production-smoke`) | Curls every production surface: status codes, www redirects, CSP/HSTS reaching the browser, the rotated-chunk 404, artwork robots.txt, bot token health. Runs every check, then exits 1 if any failed. | — |

## Local-only and by hand

| Script | Run as | Purpose |
| --- | --- | --- |
| `extract-rules.ts` | `rules:extract` | Rules PDFs in `rules/` to `rules/extracted/*.txt` with page markers. The PDFs are gitignored; no-ops without them. |
| `check-printed-names.ts` | `check:printed-names` | Entity names and pages against the Core Book index. Advisory; needs the extract. Run after a data import. |
| `prune-stale-worktrees.sh` | `reap` | Dry-run list of abandoned `.claude/worktrees/` checkouts; `--force` removes them via `git worktree remove`. |
| `export-lp-assets.ts` | `assets:export` | Backs up the `su-lp-assets` R2 bucket locally and proves the copy byte-exact — the only backup path for the licensed artwork. Needs R2 credentials. |
| `upload-lp-assets.ts` | `assets:upload` | The artwork ingest path into `su-lp-assets`. Needs R2 credentials. |

ITUN's `woff-to-ttf.ts` (unwraps `@fontsource` WOFF into TTF for the og:image
renderer) lives with its only consumer, in `apps/itun/scripts/`.

`lib/` holds the shared pieces: `ruleEngine.ts` (the styling engine: walk,
exemptions, zero/ratchet verdicts), `scanFloor.ts`, `workspaceCoverage.ts`,
`tailwindClasses.ts` (the Tailwind-file ratchet's detector), `parse-lcov.ts`
and `r2.ts` (a SigV4 R2 client, because `wrangler r2 object` cannot list).
`rules/` holds the three styling rule sets.
