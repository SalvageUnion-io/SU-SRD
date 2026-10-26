# web — salvageunion.io and its app

One app ([ADR-050](../../docs/architecture/one-app.md)): the SRD's pre-rendered pages
(built by Astro in `astro/`; its contract is [`astro/DESIGN.md`](astro/DESIGN.md),
**read it first**) and the app at `/build`. One Worker
(`src/worker/index.ts`) runs for a miss and first for `/build/*`. Areas in
`src/`: `reference/`, `build/` (Training Bay), `play/` (The Cantina).

## Pages

- **Chapters** (`src/lib/chapters.ts`) drive the home index, nav drawer, each
  page's band colour and trail.
- Entity, pattern and roll-table pages wear `EntityPageFrame`: `ChapterBand`,
  then the card at `presentation="page"`, with `foot: { printings }`.
- `astro/lib/assets.ts` is the only importer of `src/assets/`; pages
  address emitted files through `RouteContext.builtAssets`.

## Verification

No output snapshot: CI builds once and runs `bun --filter web check:examples`
and the PR-tier e2e specs (`ci.yml`) on that `dist`; lower a
`perf-budget.e2e.ts` budget when a page gets faster.
