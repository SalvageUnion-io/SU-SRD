# web — salvageunion.io and its app

One app ([ADR-050](../../docs/adr/050-one-app.md)): the SRD's pre-rendered pages
(the in-house SSG in `ssg/`; its contract is [`ssg/DESIGN.md`](ssg/DESIGN.md),
**read it first**) and the app at `/build`. One Worker
(`src/worker/index.ts`) runs for a miss and first for `/build/*`. Areas in
`src/`: `reference/`, `build/` (Training Bay), `play/` (The Cantina).

## Pages

- **Chapters** (`src/lib/chapters.ts`) drive the home index, nav drawer, each
  page's band colour and trail.
- Entity, pattern and roll-table pages wear `EntityPageFrame`: `ChapterBand`,
  then the card at `presentation="page"`, with `foot: { printings }`.
- `src/runtime/assets.entry.ts` is the only importer of `src/assets/`; pages
  address emitted files through `RouteContext.builtAssets`.

## Verification

No output snapshot: CI builds once and runs `bun --filter web check:examples`
and the PR-tier e2e specs (`ci.yml`) on that `dist`; lower a
`perf-budget.e2e.ts` budget when a page gets faster.

## Convex

`convex/` is the app's backend; tests in `test/` and `e2e/`; static pages
never import them (Biome). The block below binds `convex/` only; `bunx`, not
`npx`. Vendored Convex skills and how they meet this repo: [AGENTS.md](AGENTS.md).

**Refusals:** `NotAuthorized` (`model/permissions.ts`) when the caller may not
act, `ConvexError` when the state refuses (gone, destroyed); a plain `Error` is
a defect, redacted to "Server Error".

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
