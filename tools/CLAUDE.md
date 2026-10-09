# tools/ — the repo's gates and one-off scripts

Every file here is run directly by Bun (`bun tools/<name>.ts`). `tools/` is a
Bun workspace, so `bun run test` and `bun run typecheck` reach it like any
other; its `typecheck` also checks the root `test/` preloads. Most are
**gates**, and every gate is registered in ONE place: the `CHECKS` list in
[`check.ts`](check.ts). `bun run check`, `bun run check:fast`, lefthook's
pre-push and CI's `static-checks` job all run that registry with a different
profile, so a gate cannot be in one path and missing from another. Each
script's header docstring carries the full reasoning.

```bash
bun run check                 # every gate, in parallel, ending in a pass/fail table
bun run check:fast            # the inner loop: no suite, no network
bun run check styling data    # just these; `bun run check --list` prints every id, what it guards and its fix
```

A failing check prints its fix hint under its failure banner, then its own
output.

**Adding a gate:** first prefer what already fails the build: the typecheck, a
Biome rule, a package `exports` map, the isolated linker. A new gate script
cites, in its header, the incident it prevents. Register it in `CHECKS` (id,
command, `guards`, `fix`, profiles, CI areas); do not add a step to `ci.yml` or
a command to `lefthook.yml`, since both read the registry.

**Before editing a checker:** its tests live in `tools/__tests__/` (run with
`bun --filter tools test`). A gate that scans a tree must prove it scanned one —
use `tools/lib/scanFloor.ts` (collapsed corpus) and
`tools/lib/workspaceCoverage.ts` (a workspace missing from the list), and print
the corpus size, not just the finding count.

## The checks in `bun run check`

| Id | Script | Baseline |
| --- | --- | --- |
| `generated` | `check-generated.ts` (runs first and alone: it rewrites files) | — |
| `test` | `bun run test` | — |
| `typecheck` | `bun run typecheck` | — |
| `knip` | `bun run knip` | — |
| `biome` | `biome ci .`, plus the GritQL plugins in `biome/` | — |
| `data` | `packages/salvageunion-reference/tools/validate.ts` (`--only=` runs a subset) | — |
| `doc-drift` | `check-doc-drift.ts` | `OVER_BUDGET` in the script |
| `observability` | `check-observability.ts` | — |
| `convex-codegen` | `check-convex-codegen.ts` | — |
| `convex-callers` | `check-convex-callers.ts` | — |
| `workflows` | `check-workflows.ts` (`--only=` runs a subset) | — |
| `styling` | `check-styling.ts` (`--report` lists every finding) | `styling-baseline.json` |
| `audit` | `bun run audit` (CI: only when a manifest or `bun.lock` changed; also nightly) | one `--ignore`, in the root `audit` script |
| `actionlint` | `lint-workflows.sh` (pinned, sha256-verified actionlint + zizmor) | — |

## CI-only, nightly and deploy scripts

| Script | Run by | Purpose | Baseline |
| --- | --- | --- | --- |
| `run-coverage.ts` | `test:coverage`: CI's `coverage` job, and pre-push when shared code or manifests change | Every workspace's suite (`tools/` included) under `bun test --coverage`, concurrently, each workspace's output printed whole under its name. Fails a workspace whose line coverage of its own files is under its floor. | `FLOORS` in the script. Add tests; lower a floor only on purpose, saying so in the PR. Raise one to lock in a gain. |
| `a11y-scan.ts` | `build-srd` and `build-itun` in `ci.yml` (every srd / ITUN PR) | WCAG 2.2 AA scan (Playwright + axe-core) of the pages keyed in the baseline, at desktop and once per `--device` (CI: Pixel 7). Fails on a violation not accepted per page, and on a stale entry; `--update-baseline` deletes stale entries and nothing else. | `a11y-baseline.json` (srd), `a11y-baseline-itun.json` |
| `check-convex-parity.ts` | `check:convex-parity:live` (nightly) | Every Convex function this repo defines exists on the deployment. Its static half is `workflows`' `convex-guard`. | — |
| `deploy-surfaces.ts` | `.github/workflows/deploy-cloudflare.yml` | Diffs HEAD against the last successful deploy tag and decides which Cloudflare surfaces ship. Fails safe: when unsure it deploys everything. | — |
| `environments.ts` | `e2e-nightly.yml` (`environments`); `--apply` by hand | The GitHub Environments declared once (branches, secret names) and compared against the live settings: no branch policy, a missing or repository-level secret, an undeclared Environment. `--apply` sets Environments and branch policies, never secrets. Its static half is `workflows`' `secrets-env`. | — |
| `smoke-production.sh` | `deploy-cloudflare.yml` (`smoke` job) and `e2e-nightly.yml` (`production-smoke`) | Curls every production surface: status codes, www redirects, CSP/HSTS reaching the browser, the rotated-chunk 404, artwork robots.txt, bot token health. Runs every check, then exits 1 if any failed. | — |

## Local-only and by hand

| Script | Run as | Purpose |
| --- | --- | --- |
| `extract-rules.ts` | `rules:extract` | Rules PDFs in `rules/` to `rules/extracted/*.txt` with page markers. The PDFs are gitignored; no-ops without them. |
| `check-printed-names.ts` | `check:printed-names` | Entity names and pages against the Core Book index. Advisory; needs the extract. Run after a data import. |
| `export-lp-assets.ts` | `assets:export` | Backs up the `su-lp-assets` R2 bucket locally and proves the copy byte-exact — the only backup path for the licensed artwork. Needs R2 credentials. |
| `upload-lp-assets.ts` | `assets:upload` | The artwork ingest path into `su-lp-assets`. Needs R2 credentials. |

`lib/` holds the shared pieces: `ruleEngine.ts` (the styling engine: walk,
exemptions, zero/ratchet verdicts), `scanFloor.ts`, `workspaceCoverage.ts`,
`tailwindClasses.ts` (the Tailwind-file ratchet's detector) and `r2.ts` (a
SigV4 R2 client, because `wrangler r2 object` cannot list).
`rules/` holds the three styling rule sets.
