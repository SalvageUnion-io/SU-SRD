# web — salvageunion.io and its app

One app ([ADR-050](../../docs/adr/050-one-app.md)): the SRD's pre-rendered pages
(the in-house SSG in `ssg/`; its contract is [`ssg/DESIGN.md`](ssg/DESIGN.md),
**read it first**) and the app at `/build`
(guide: [`src/routes/CLAUDE.md`](src/routes/CLAUDE.md)). One Worker
(`src/worker/index.ts`) runs for a miss and first for `/build/*`. Areas in
`src/`: `reference/`, `build/` (Training Bay), `play/` (The Cantina).

## Routes are registered, not discovered

A page is a `src/reference/pages/**/*.page.tsx` module exporting a `PageModule`
(`pattern`, optional `getStaticPaths`, `page`); it builds only once
`register(…)`ed in [`ssg/routes.ts`](ssg/routes.ts), the one list of what the
site emits. A finished document with no data behind it is a `public/` file, not
a route. Non-HTML outputs are `src/reference/endpoints/*.ts` wired through
`ssg/endpoints.ts`: **endpoints are not routes.**

## Pages

- **Chapters** (`src/lib/chapters.ts`) drive the home index, nav drawer, each
  page's band colour and trail.
- Entity, pattern and roll-table pages wear `EntityPageFrame`: `ChapterBand`,
  then the card at `presentation="page"`, with `foot: entityPageFoot(...)`.
- Page layouts are `src/styles/pages.css`.
- A `.css` import reachable from SSR builds green and silently never ships.
- `src/runtime/assets.entry.ts` is the only importer of `src/assets/`; pages
  address emitted files through `RouteContext.builtAssets`.

## Verification

No output snapshot: CI builds once, then runs `bun --filter web check:examples`,
the Playwright smoke, bundle-budget, JSON API, axe and (signed in) Play specs on
that `dist`, and `perf-budget.e2e.ts` (lower a budget when a page gets faster).

## Convex

`convex/` is the app's backend; tests in `test/` and `e2e/`; static pages
never import them (Biome). The block below binds `convex/` only; `bunx`, not
`npx`. Vendored Convex skills and how they meet this repo: [AGENTS.md](AGENTS.md).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
