# tools/ — the repo's gates and one-off scripts

Every file here is a CLI entry point run directly by Bun (`bun tools/<name>.ts`);
they reach other workspaces (`gates` in `packages/gates`, `salvageunion-reference`)
only by package name, each declared `workspace:*`, never by relative path.
`tools` and `gates` are workspaces, so `bun run test` and `bun run typecheck` reach them;
`tools`' `typecheck` also checks the root `test/` preloads. Most are
**gates**, and every gate is registered in ONE place: the `CHECKS` list in
[`check.ts`](check.ts). `bun run check`, `bun run check:fast`, lefthook's
pre-push and CI's `static-checks` job all run that registry with a different
profile, so a gate cannot be in one path and missing from another. Each
script's header docstring carries the full reasoning.

```bash
bun run check                 # every gate, in parallel, ending in a pass/fail table
bun run check:fast            # the inner loop: no suite, no network, no regeneration
bun run check styling data    # just these; `bun run check --list` prints every id, what it guards and its fix
```

**Adding a gate:** first prefer what already fails the build: the typecheck, a
Biome rule, a package `exports` map, the isolated linker. A new gate script
cites, in its header, the incident it prevents. Register it in `CHECKS` (id,
command, `guards`, `fix`, profiles, CI areas); do not add a step to `ci.yml` or
a command to `lefthook.yml`, since both read the registry.

**Before editing a checker:** its tests live in `tools/__tests__/` (run with
`bun --filter tools test`), the library's in `packages/gates/__tests__/`. A gate that scans a tree must prove it scanned one —
use `packages/gates/lib/scanFloor.ts` (collapsed corpus) and
`packages/gates/lib/workspaceCoverage.ts` (a workspace missing from the list), and print
the corpus size, not just the finding count.

## CI-only, nightly and deploy scripts

| Script | Run by | Purpose | Baseline |
| --- | --- | --- | --- |
| `run-coverage.ts` | `test:coverage`: CI's `coverage` job only (pre-push runs no tests) | Every workspace's suite (`tools/` included) under `bun test --coverage`, concurrently, each workspace's output printed whole under its name. Fails a workspace whose line coverage of its own files is under its floor. | `FLOORS` in the script. Add tests; lower a floor only on purpose, saying so in the PR. Raise one to lock in a gain. |
| `gates/lib/a11yScan.ts` | `a11y.e2e.ts` (srd, ITUN) per PR; ITUN's `a11y-signed-in.e2e.ts` nightly | WCAG 2.2 AA axe scan of each spec's pages, desktop and Pixel 7; any violation fails | — |
| `gates/lib/webVitals.ts` | srd's `perf-budget.e2e.ts`, CI's `perf-srd` job, per PR | LCP, TBT and CLS computed the way Lighthouse does from a page's own observers, the median of three throttled loads; any page over its budget fails | `PAGES` in the spec. Lower a budget to lock in a gain; raise one only on purpose, saying so in the PR. |
| `deploy-surfaces.ts` | `.github/workflows/deploy-cloudflare.yml` | Diffs HEAD against the last successful deploy tag and decides which Cloudflare surfaces ship. Fails safe: when unsure it deploys everything. | — |
| `release.ts` | `.github/workflows/release.yml`, a push to `main` that changes the root `package.json` | When the root `package.json` version has no `v<version>` tag yet, publishes that release on the merge commit, its notes the merged PR's **What changed** section word for word, `Closes #N` lines dropped. An unbumped merge finds the tag and does nothing. | — |
| `environments.ts` | `e2e-nightly.yml` (`environments`); `--apply` by hand | The GitHub Environments declared once (branches, secret names, required reviewers) and compared against the live settings: no branch policy, a missing or repository-level secret, an undeclared Environment. `--apply` sets Environments and branch policies, never secrets. Its static half is `workflows`' `secrets-env`. | — |
| `gallery.ts`, `gallery-pages.ts` | `gallery.yml` (by hand: a PR's branch, or main for the tour), then `gallery-pages.yml` | `gallery` shoots `gates/lib/galleryPages.ts` (desktop, phone, OG, ITUN signed in). `gallery-pages` builds Pages from open PRs' `gallery-<n>`, main's `preview-tour` at `/tour/`. | — |
| `smoke-production.sh` | `deploy-cloudflare.yml` (`smoke` job) and `e2e-nightly.yml` (`production-smoke`) | Curls every production surface: status codes, www and http→https redirects, CSP/HSTS reaching the browser, the rotated-chunk 404 (and that it is not `immutable`), artwork robots.txt, bot token health. | — |

## Local-only and by hand

| Script | Run as | Purpose |
| --- | --- | --- |
| `extract-rules.ts` | `rules:extract` | Rules PDFs in `rules/` to `rules/extracted/*.txt` with page markers, plus a content-stream-order layer in `rules/extracted/raw/` for the fidelity check. The PDFs are gitignored here (source of record: the private `su-rules` repo, extract committed); no-ops without them. |
| `check-rules-fidelity.ts` | `check:rules-fidelity` | Every prose string against the books: verbatim, an allowlisted deviation (`lib/proseDeviations.ts` in the package), authored, or unverified drift. `--update` rewrites the lock the `rules-fidelity` gate reads; other flags: its docstring. Needs the extract: `findExtractDir` in `extract-rules.ts` says where it looks. |
| `rules-find.ts` | `rules:find <term>` | `Book p.N: …snippet…` per hit in the extract, wraps joined; the 2.0a books unless `--all`. Flags: its docstring. |
| `export-lp-assets.ts` | `assets:export` | Backs up the `su-lp-assets` R2 bucket locally and proves the copy byte-exact — the only backup path for the licensed artwork. Needs R2 credentials. |
| `upload-lp-assets.ts` | `assets:upload` | The artwork ingest path into `su-lp-assets`. Needs R2 credentials. |
| `art-crop.ts` | `assets:crop` | Measures each artwork's ink box from its `-440` derivative and writes component-lib's `heroArtCrop.data.ts`, which the entity page's hero crops to. Re-run after adding or replacing art; unmeasured art renders whole. |
| `shot.ts` | `shot` | A full-page PNG of an srd `/route` or a signed-out ITUN `itun:/route` (no backend) at a `WIDTHS` width, scrolled so lazy art loads; paper only (no dark theme). Reuses only its own checkout's server, else starts one; prints each `.shots/` path. |

`packages/gates` holds the shared library (`lib/`: rule engine, scan floors,
workspace graph, lcov merge, prose fidelity, R2, the Playwright base, the
one Chromium launcher `chromium.ts` with its `SHOT_CHROME_PATH` override), the
styling rule sets (`rules/`) and the GritQL plugins (`biome/`); each file's
docstring carries its why. Baselines live in `baselines/`.
