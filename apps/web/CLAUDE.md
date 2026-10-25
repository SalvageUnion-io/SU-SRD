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

## Convex

`convex/` is the app's backend; tests in `test/` and `e2e/`; static pages
never import them (Biome). Convex's AI block lives in `convex/CLAUDE.md`, so
it loads only there (move it back if `convex ai-files install` re-adds it
here); `bunx`, not `npx`. Vendored Convex skills and how they meet this repo: [AGENTS.md](AGENTS.md).

**Refusals:** `NotAuthorized` (`model/permissions.ts`) when the caller may not
act, `ConvexError` when the state refuses (gone, destroyed); a plain `Error` is
a defect, redacted to "Server Error".
