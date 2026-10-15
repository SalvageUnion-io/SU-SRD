# web — salvageunion.io and the Cantina

One app ([ADR-050](../../docs/ARCHITECTURE.md#decisions)): the SRD's pre-rendered pages
and the Cantina, the client app at `/build`.

In-house SSG in `ssg/`, not Astro ([ADR-031](../../docs/ARCHITECTURE.md#decisions)); the contract is
[`ssg/DESIGN.md`](ssg/DESIGN.md) — **read it first.**

## Stack

- **Framework:** the SSG in `ssg/`, React 19, Vite 8 for the client bundle.
- **UI:** `src/components` components, tokens and stylesheet (ADR-046); React
  islands for interactivity
- **Game data:** `salvageunion-reference` workspace package
- **Deployment:** Cloudflare Workers Static Assets (`wrangler.jsonc`). Every
  page is pre-rendered; the one Worker script (`src/worker/index.ts`) runs only
  for a miss (404, `no-store`), and first for `/build/*` (`src/worker/cantina.ts`).

## Architecture

### Routes are registered, not discovered

A route is a `src/pages/**/*.page.tsx` module exporting a `PageModule`:

```ts
export const aboutPage: PageModule = {
  pattern: '/about',
  // getStaticPaths?: () => StaticPath<Params, Props>[]   // omit for a fixed route
  page: (ctx) => ({ meta: { title: '…' }, children: <…/> }),
}
```

Files are kebab-case, `[param]`s as in `pattern` (which sets the URL). It only
builds if it is imported and `register(…)`ed in
[`ssg/routes.ts`](ssg/routes.ts). That file is the one place to read to know what
the site emits. A finished document with no data behind it is not a route at
all — `/greembeem` ships as `public/greembeem/index.html`, which Vite copies
into `dist` like any public file. Non-HTML outputs are `src/endpoints/*.ts`
wired through `ssg/endpoints.ts` — **endpoints are not routes.**

## Pages as the Workshop Manual sets them

- **Chapters** (`src/lib/chapters.ts`): the book's five chapters over the
  catalog categories. The home index, the nav drawer, each page's band colour
  and trail read it.
- Entity, pattern and roll-table pages wear `EntityPageFrame`: `ChapterBand`,
  then the card at `presentation="page"` (a d20 table: `RollTablePage`). The
  module returns `foot: entityPageFoot(...)`; the site `Footer` cites it in the
  chapter's band, above the licence row.
- Page layouts are `src/styles/pages.css`, imported by `global.css`.

## Not in DESIGN.md

- A `.css` import reachable from SSR builds green, because `ssg/build.ts`'s
  `ssg-css-stub` resolves it to an object, so the stylesheet silently never ships.
- `src/runtime/assets.entry.ts` is the only importer of `src/assets/`; pages
  address the emitted file through `RouteContext.builtAssets`.

## Verification

There is no output snapshot. CI's `build-web` job builds the app once, then runs
`bun --filter web check:examples` (`ssg/checkPageExamples.ts`), then the Playwright
smoke, bundle-budget, JSON API and axe-core specs against that `dist`.
CI's `perf` runs `perf-budget.e2e.ts` (LCP, TBT, CLS, phone throttling);
lower a budget when a page gets faster.
`ssg/__tests__/routes.test.ts` asserts every registered route emits a page.

## Conventions

- Search: build-time `/search-index.json`, matched in the browser by
  `src/lib/searchCompactIndex.ts`; Cmd+K / Ctrl+K focuses it.
- Entity pages carry a Discord Component Embed (`src/lib/componentEmbed.ts`).
- A `feat|fix|perf(web):` PR title reaches `/changelog`; the older `srd`, `cantina` and `itun` scopes still read.

## The Cantina

Guide: [`src/routes/CLAUDE.md`](src/routes/CLAUDE.md); Convex in `convex/`, tests in
`test/` and `e2e/`; static pages never import them (Biome). The block below
binds `convex/` only; `bunx`, not `npx`; vendored skills: [AGENTS.md](AGENTS.md).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
