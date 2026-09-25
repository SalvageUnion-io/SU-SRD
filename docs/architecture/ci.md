# CI and deploy pipeline

What `.github/workflows/ci.yml` and `deploy-cloudflare.yml` do, and **why** —
most of the non-obvious choices below exist because of a specific incident.
This reasoning used to live inline in `ci.yml` (554 of its 929 lines were
comments); it moved here in the 2026-09-25 audit (CI-16) so the workflow reads
as a workflow. The workflow still says *what* each step guards and points here
for the rest.

Dependency/audit policy (`overrides`, floors, the watch list) is **not** here:
it lives in [dependency-management.md](dependency-management.md).

## Triggers

- **`pull_request` has no `branches:` filter.** That filter matches the PR's
  *base* branch, so `branches: ['main']` gave zero checks to every stacked PR
  above the bottom layer (observed on stack #742: #738 got a run, #739 and #740
  none). `CI Success` is a required status, so those PRs were not merely
  unchecked — they were unmergeable, with `gh pr checks` reporting "no checks
  reported". CodeQL drops the filter for the same reason.
- **`merge_group:` is kept dormant.** There is no merge queue on `main` (the
  ruleset is `deletion`, `non_fast_forward`, `required_linear_history`,
  `required_status_checks`). If one is ever enabled, its `gh-readonly-queue/**`
  branches fire neither `push` nor `pull_request`, so the trigger must be live on
  `main` *before* the ruleset changes or the queue waits forever for a status
  that cannot arrive. Same for `codeql.yml`.

## Concurrency

PR runs cancel their superseded predecessor. **Runs on `main` never cancel**:
each commit gets its own concurrency group (`github.sha`) and runs to the end.

That matters because deploys hang off CI. `deploy-cloudflare.yml` fires on the
CI workflow's `workflow_run` *success*, and a cancelled run is not a success —
so two quick merges used to cancel the first commit's CI, fire no deploy for it,
and (with the deploy diffing only `HEAD^..HEAD`) leave any surface touched only
by that commit un-deployed while everything stayed green (audit CI-01). See
"Deploy set" below for the other half of the fix.

## Timeouts

Every job declares `timeout-minutes`. GitHub's default is 360, so a hung job does
not fail — it holds the gate open for the rest of the day while nothing is red.
15 minutes is ~7× the slowest normal job; the build jobs carry 25 because they
also drive a browser. Raise a specific job's number when its real work grows; do
not remove the key.

## Path filters (`changes` job)

The dependency graph is baked into the groups: `shared` (reference package,
observability, root config, test preloads, workflows) affects every app;
component-lib affects srd and itun. Each app group is `shared` + its own paths.
`CI Success` treats a skipped job as a pass, which is what makes the filters the
only thing between a diff and an unbuilt merge — so:

- **`tools/check-workflows.ts` (its `path-filters` half) asserts every app's
  `workspace:*` dependency is covered by that app's group.** `packages/observability` was once missing
  from `shared`, so a change to it ran checks but skipped all three builds (and
  with them the srd snapshot gate, the routeTree staleness check and both
  Playwright tiers).
- **Root prose is in `shared`.** `ABOUT_JRVS.md`, `LLM_STATEMENT.md` and
  `SPECIAL_THANKS.md` are read by srd's about page (rendered into
  `about/index.html`), imported `?raw` by ITUN, and asserted on by a
  component-lib test. #731 added one name to `SPECIAL_THANKS.md`, CI skipped
  `build-srd`, `main` went green with a stale snapshot, and the next three PRs to
  trigger that job were red on a difference none of them made.
- **`code` vs `docs`** (audit CI-11). `code` is source, tools and the Claude hook
  scripts (the hook tests in `tools/__tests__/` exercise `.claude/hooks/**`).
  `docs` is `docs/**`, root `CLAUDE.md` / `README.md` / `CONTRIBUTING.md`,
  `.claude/**` and `.mcp.json`. A docs-only PR runs the repo-invariant checks — doc
  drift, architecture, data and the rest the `code`/`docs` areas select —
  which read exactly those files, and before they were in any
  filter a CLAUDE.md-only PR could not run the CLAUDE.md guard (#942) — but not
  the test suite, the typecheck or the audit, which nothing in those files can
  affect. That was ~140 runner-seconds per docs PR.

## `static-checks`

Six jobs merged into one (they spent 134 s in `Setup Bun` between them to do
23 s of work). No job-level `if:`: it is an input to `CI Success` and must always
report.

It has ONE step: `bun tools/check.ts --profile=ci --areas=<code,docs>`. The
list of checks is the registry in `tools/check.ts` — the same one `bun run
check` and pre-push read — so a gate cannot exist in one path and not another
(pre-push used to skip the CI-aggregator guard, and `validate:all` was an
`&&` chain in which the first failure hid every later result). Every check runs
even after one fails, and the step log ends in a pass/fail table. Each check
declares which areas make it relevant:

- **Always**: Biome (`biome ci .` — lint, format *and* the organizeImports
  assist), `workflows` (aggregate gate, path filters, SHA pinning, Bun version,
  Convex deploy guard), `styling` (design tokens, styling ownership, srd
  stylesheet entry) and `actionlint`.
- **`actionlint`** (`tools/lint-workflows.sh`) runs actionlint and zizmor,
  each pinned to an exact version and verified against a recorded sha256 before
  it runs. zizmor's config is `.github/zizmor.yml`; its pinning policy is the
  same first-party line `tools/check-workflows.ts` draws. Every checkout
  sets `persist-credentials: false` except `catalog-update.yml`, whose action
  pushes with it.
- **`code`**: `generated` (regenerate, then fail on any tracked OR untracked
  drift — reference package artifacts and `routeTree.gen.ts`), typecheck, knip,
  and the dependency audit.
- **`code` or `docs`**: the repo invariants — `data`, `doc-drift`,
  `architecture`, `observability`, `convex-codegen`, `convex-callers`,
  `catalog`, `worker-env`.

The test suite and the srd build are in the registry too (`bun run check` runs
them) but not in the `ci` profile: they are the `coverage` and `build-srd`
jobs.

## The test gate — `coverage`

There is one test run per PR (audit CI-03): `bun run test:coverage` (every
workspace, instrumented, via `tools/run-coverage.ts`), then `bun run test:tools`
(not a workspace, so run-coverage does not reach it), then the per-workspace
coverage ratchet against `coverage-baseline.json`.

It used to run twice — an uninstrumented `test` job and this one — on the theory
that a coverage-reporter hiccup should not fail the primary gate. That flake
(#818: exit 0 with no lcov written) is now retried inside `run-coverage.ts`,
which still fails immediately on a real test failure and never retries one, so
the second run was pure cost.

Locally, `bun run test` is still the canonical full suite; it runs the same
test files without instrumentation.

## Build jobs

All five `needs: [changes]` only (audit CI-02). They consume no artifact from
`static-checks` or the tests, and `CI Success` already fails the PR if any of
those fail — waiting on them just serialised ~50 s onto every PR's wall clock.

- **`build-srd`** builds once, then runs `check:examples` and the output
  snapshot as separate steps (what `bun --filter srd gate` chains, split so
  failure attribution survives and the Playwright tier serves the same `dist`).
  The PR-blocking browser tier (smoke + bundle budget) is folded in rather than
  a separate job, because a separate job cost a second full build. Add a spec
  to the run line, not a job. Then the axe-core accessibility scan runs against
  the same `dist`, over the pages in `tools/a11y-baseline.json`; it blocks on a
  violation the baseline does not accept and on a stale entry. (It used to run
  only nightly, so a regression merged green.) Full browser suites run nightly
  (`e2e-nightly.yml`).
- **`build-itun`** builds, bundles the Worker with `bun --filter itun
  worker:bundle` (the build emits assets only; `wrangler.jsonc`'s `main` was
  otherwise never bundled before deploy), and runs the same browser tier.
  `routeTree.gen.ts` staleness is the `generated` check in `static-checks`,
  which regenerates it without a build.
- **`build-discord-bot`** and **`build-su-assets`** bundle the Worker that
  actually deploys. The bot has no build script.
- **`build-ladle`** builds component-lib's Ladle stories when component-lib (or
  anything `shared`) changes. Nothing built them on a PR before, so a story
  that no longer compiled merged green.

wrangler is a catalogued devDependency of all four Worker apps (audit CI-09), so
every bundle and deploy runs the version `bun.lock` resolved — audited, behind
the 3-day release-age gate and updated by the catalog workflow. It used to be
`bunx wrangler@4.108.0`, written out nine times outside the lockfile, because
the wrangler of that era dragged `sharp` and `undici` versions with HIGH
advisories into the tree; 4.132.0 no longer does. Keep `compatibility_date` in
the four `wrangler.jsonc` files at or below the workerd the catalogued wrangler
bundles.

## `pr-title`

The repo squash-merges, so the PR title is the commit subject release-please
reads. A non-conventional title merges cleanly and silently produces no
changelog entry and no version bump. There is deliberately no commitlint: on a
squash repo the individual commit subjects never reach `main`.

## The aggregate gate — `CI Success`

The job key is `quality-checks`; its `name:` is `CI Success`, the one required
check (the same name across the fleet's repos). It fails on any `failure` or
`cancelled` result and passes on `skipped`.

**Every job must be in its `needs:`** — a job missing from that list still runs
and goes red but cannot block a merge. `tools/check-workflows.ts` (its `aggregator`
half) diffs the two lists on every PR.

`needs:` cannot reach other workflows, so CodeQL is required as its own status
context (`Analyze (javascript-typescript)`). That is why `codeql.yml` has no
path filter: a filtered-out workflow never reports, and a required context that
never reports leaves the PR pending forever. If either half changes, change them
in this order: the trigger live on `main` first, then the ruleset. Do not
instead poll CodeQL from this job — it races the other workflow, and a poll that
times out reports green.

## Deploy set (`deploy-cloudflare.yml`)

The deploy workflow's own comments carry its guard rationale (provenance check,
credential guards, Sentry, the srd snapshot it deliberately does not re-run).
The part that interacts with CI:

- **Shape: `plan` -> `build-srd` / `build-itun` -> `deploy-*` -> `smoke` ->
  `record`** (audit CI-12). `plan` resolves the commit, the deploy set, every
  credential guard and a dry-run bundle of every Worker. The two builds run in
  parallel and each uploads the exact `dist` it produced; the four `deploy-*`
  jobs run in parallel, ship those artifacts unrebuilt, and none starts until
  **every** build is green, so a failed itun build no longer leaves srd on the
  new commit. It used to be one serial 30-minute job. `bun run check workflows`
  (`deploy-order`) asserts the three orderings.
- **The artifacts are built in the deploy, not taken from CI's run.** Neither
  CI build is a production artifact: srd's is built with no Sentry DSN because
  the output snapshot is blessed against that build, and itun's is a Solo
  client with no `VITE_CONVEX_URL`. And CI path-filters per commit while the
  deploy ships per last recorded deploy, so a surface can need deploying on a
  commit where CI skipped its build. Build once, in the deploy, and ship that.
- **A failed `deploy-*` job does not stop the others** — they run in parallel
  once every build is green. It fails the run, so `smoke` and `record` are
  skipped and the next run re-deploys every surface since the last record.
- **itun's backend is pushed in `build-itun`**, because the canonical Convex URL
  the client is compiled against only comes from a real `convex deploy --cmd`.
  So the backend can lead the served client for a while — the safe direction,
  and one the backend must already tolerate for every tab still running the
  previous client.

- **The base is the last successful deploy, not `HEAD^`.** After every green
  run the `record` job moves the lightweight tag `deployed/cloudflare` to the
  commit that shipped; the next run tree-diffs against it. Dropped queue
  entries, CI runs that never went green and rollback dispatches all diff
  correctly, because the question is "how does what we are shipping differ
  from what is live", not "what did the last commit touch".
- **No record, a shared path, or `force_all`** deploys everything. The shared
  set includes the three root prose files for the #731 reason above — the old
  shell version omitted them, so an edit to `SPECIAL_THANKS.md` never shipped
  srd's about page. The decision lives in `tools/deploy-surfaces.ts` and is
  unit-tested in `tools/__tests__/deploy-surfaces.test.ts`.
- **Never backwards on a `workflow_run`.** CI on `main` runs every commit to
  completion, so an older commit's CI can finish after a newer one has already
  deployed. Diffing newer->older would ship the older tree for every surface the
  newer commit touched and then move the record back. When HEAD is an ancestor
  of the record, the run is `stale`: nothing deploys and `record` is skipped.
  Only a dispatch (`--allow-backwards`, the rollback path) may deploy an older
  commit and move the record to it.
- `record` is its own job so `contents: write` is held by a REST call, never by
  the job that checks out and runs the tree. If it fails, the next deploy just
  diffs from an older record and over-deploys — the safe direction.
- A dispatched `sha` reaches the script through `env:`, never `${{ }}` inside
  `run:`, and it is stamped into both apps' commit ref instead of the tip of
  `main`.
- **The post-deploy smoke list is `tools/smoke-production.sh`**, not inline
  YAML, so `e2e-nightly.yml`'s `production-smoke` job runs the same checks
  daily. A deploy proves production answered when it shipped; the nightly run
  catches drift between deploys (DNS, Redirect Rules, a rotated bot token).
  There is no separate manual probe workflow: `probe-production.yml` was
  deleted with ADR-033 P8.
