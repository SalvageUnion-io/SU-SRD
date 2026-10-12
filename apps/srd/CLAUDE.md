# srd — salvageunion.io

The static SRD reference site for Salvage Union game data. Read-only — choices render
ephemerally/non-editably
([ADR-010](../../docs/ARCHITECTURE.md#decisions)).

> **srd is not an Astro app** — it runs on an in-house static-site generator in
> [`ssg/`](ssg/) ([ADR-031](../../docs/ARCHITECTURE.md#decisions), superseding
> ADR-012). No `.astro` files, no `astro.config.mjs`, no `client:*` directives,
> no file-based routing. The contract is [`ssg/DESIGN.md`](ssg/DESIGN.md) —
> **read it first.** This file is the canonical statement of this; others point here.

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

### The SSG (`ssg/` — build-time only, never imported by client code)

| file            | role                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `types.ts`      | `PageModule` / `EndpointModule` / `RouteContext` / `DocumentMeta`             |
| `routes.ts`     | the **explicit** route registry                                               |
| `endpoints.ts`  | non-HTML outputs (`*.json`, `llms.txt`, search index)                         |
| `render.tsx`    | render one route → HTML string                                                |
| `document.tsx`  | the `<html>` shell: head tags, JSON-LD, script/style injection                |
| `build.ts`      | orchestrator: vite client build → render every route → emit                   |
| `dev.ts`        | dev server; Vite in middleware mode, **same `render.tsx` path**               |
| `sitemap.ts`    | `sitemap-index.xml` + `sitemap-0.xml`                                         |
| `vite.config.ts` | the client build: PWA, Sentry source maps, the `react-vendor` chunk          |
| `pwa.ts`        | workbox options for `vite-plugin-pwa` in `ssg/vite.config.ts`                 |
| `linkAudit.ts`  | fails the build on an entity link by UUID instead of slug                     |
| `outputPath.ts` | URL → dist file mapping (`/404` → `404.html`, everything else `…/index.html`) |

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

### The island protocol

`<Island name client props ssr>` and the per-island table are
[`ssg/DESIGN.md`](ssg/DESIGN.md)'s. Two that get "helpfully" undone: every
`src/runtime/islandRegistry.ts` specifier is a **static string literal** (a
computed one collapses the registry into one eager chunk), and
**`MobileNavIsland` takes zero props on purpose** (a prop would inline its
catalog blob into every page).

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
- Page layouts are `src/styles/pages.css`, imported by `global.css` and
  `apps/catalog/src/catalog.css`.

## Hard rules

[`ssg/DESIGN.md`](ssg/DESIGN.md)'s hard rules hold. What they rest on: a `.css`
import reachable from SSR does **not** break the build (`ssg/build.ts`'s
`ssg-css-stub` resolves it to an object), so the stylesheet silently never
ships. `src/runtime/assets.entry.ts` is likewise the only importer of
`src/assets/`; pages address the emitted file through `RouteContext.builtAssets`.

## Verification

There is no output snapshot. CI's `build-srd` job builds once, then runs
`bun run check:examples` (`ssg/checkPageExamples.ts`), then the Playwright
smoke, bundle-budget, JSON API and axe-core (`a11y.e2e.ts`) specs against that
`dist`.
`ssg/__tests__/routes.test.ts` asserts every registered route emits a page.

## Conventions

- Search: the build-time `/search-index.json`, matched in the browser by
  `src/lib/searchCompactIndex.ts` with the reference package's ranking
  functions; no ORM ships to the browser. Cmd+K / Ctrl+K focuses it.
- Dev: `bun run dev` renders through production's `render.tsx` **on purpose**
  (DESIGN.md rule 5) — never "optimize" it into a client-rendered SPA.

## Social preview images (og:image)

Each entity page's `og:image` is `OgCard`, screenshotted by `bun --filter srd
og:generate` (opt-in; it never fails the build). The rules load with its files:
[`.claude/rules/srd-og-images.md`](../../.claude/rules/srd-og-images.md).
Entity and pattern pages also carry a Discord Component Embed
(`src/lib/componentEmbed.ts`): the bot's card, drawn for a pasted link.

## Changelog (generated)

The `/changelog` page (`src/pages/changelog.page.tsx`) is rendered **at build time** from `main`'s
history ([ADR-041](../../docs/ARCHITECTURE.md#decisions)): `readChangelog('srd', 'Site')` from
`component-lib/changelog/git` keeps the `feat`, `fix` and `perf` squash titles scoped `srd`, one
entry per day, and the page renders them with `Changelog`. There is no file to edit: a PR reaches
this page by its title, `feat(srd): …`. Another scope, or none, never shows here.
