# srd — salvageunion.io

The static SRD reference site for Salvage Union game data. Read-only — choices render
ephemerally/non-editably
([ADR-010](../../docs/ARCHITECTURE.md#decisions)).

In-house SSG in `ssg/`, not Astro ([ADR-031](../../docs/ARCHITECTURE.md#decisions)); the contract is
[`ssg/DESIGN.md`](ssg/DESIGN.md) — **read it first.**

## Stack

- **Framework:** in-house SSG at `ssg/`, React 19 for rendering, Vite 8 for the
  client bundle. No framework runtime ships to the browser beyond React.
- **Output:** Static HTML (no server runtime, no SSR at request time, no auth,
  no backend)
- **UI:** `component-lib` components, tokens and stylesheet (ADR-046); React
  islands for interactivity
- **Game data:** `salvageunion-reference` workspace package
- **Tooling:** Biome (`bun run lint`) and TypeScript 7 (`bun run typecheck`).
- **Deployment:** Cloudflare Workers Static Assets (`wrangler.jsonc`). Every
  page is pre-rendered; the Worker script (`src/worker/index.ts`) runs only for
  a miss, answering it 404 with `no-store` so a missing chunk is never cached.
  `/build*` on the same host is ITUN's Worker route, not srd's (ADR-048).

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
  then the body. The body is the card at `presentation="page"`, or for a d20
  table `RollTablePage` (Randsum rolls). The page's citation is the site
  `Footer`'s: the page module returns `foot: entityPageFoot(...)` in its
  `PageResult`, and the footer cites it in that chapter's band; under it, as on
  every other page, the licence row ends the page in the Union bar's ink.
- Page layouts are `src/styles/pages.css`, imported by `global.css`.

## Not in DESIGN.md

- A `.css` import reachable from SSR builds green, because `ssg/build.ts`'s
  `ssg-css-stub` resolves it to an object, so the stylesheet silently never ships.
- `src/runtime/assets.entry.ts` is the only importer of `src/assets/`; pages
  address the emitted file through `RouteContext.builtAssets`.

## Verification

There is no output snapshot. CI's `build-srd` job builds once, then runs
`bun --filter srd check:examples` (`ssg/checkPageExamples.ts`), then the Playwright
smoke, bundle-budget, JSON API and axe-core (`a11y.e2e.ts`) specs against that
`dist`.
CI's `perf-srd` job runs `perf-budget.e2e.ts` (LCP, TBT, CLS under mobile
throttling) on its own build; lower a budget when a page gets faster.
`ssg/__tests__/routes.test.ts` asserts every registered route emits a page.

## Conventions

- Search: the build-time `/search-index.json`, matched in the browser by
  `src/lib/searchCompactIndex.ts` with the reference package's ranking
  functions; no ORM ships to the browser. Cmd+K / Ctrl+K focuses it.

## Social previews

Entity and pattern pages carry a Discord Component Embed
(`src/lib/componentEmbed.ts`): the bot's card, drawn for a pasted link.

## Changelog

A `feat(srd):` or `feat(itun):` (or `fix`/`perf`) PR title reaches the generated `/changelog` page, the one changelog both tools share (as Site or App entries). The About page is shared the same way: ITUN links to both and keeps no copy.
