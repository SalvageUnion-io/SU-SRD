# ADR-065: The reference on Astro 7

Decided for 4.5.0: Jrvs chose Astro for the reference in the clean-sheet plan
(2026-10-25, #1798), and the spike of #1793 found nothing against it. It took
effect with #1794.
Amends [ADR-031](../ARCHITECTURE.md) (the in-house SSG) and
[ADR-050](050-one-app.md) §2 (one Vite pass, now Astro's).

## The spike

Astro 7.4.2 with `@astrojs/react` 7.1.1, on Vite 8.3.5 (the repo's major),
built every page `ssg/routes.ts` registers and every endpoint
`ssg/endpoints.ts` does, from `apps/web/astro/` (`bun run build:astro`, into
`dist-astro/`). Each page is a five-line `.astro` file over its page module;
the modules, the layout and the islands are unchanged.

| Measure | `ssg/` today | Astro |
| --- | --- | --- |
| Files outside `assets/` | 2,903 | 2,883: the same reference URLs; the app shell, sitemaps and service worker are #1794's |
| Page markup | | all 1,054 HTML files identical outside the asset tags |
| Endpoints (`/api/v1`, `/schema`, `llms.txt`, `_redirects`, search index) | | 1,810 files, byte-identical |
| Page JS, untouched (`/`, `/chassis/`, `/chassis/mule/`, `/traits/missile/`, `/api/`) | 27,212 B | 26,634 B |
| Page JS, a roll table (its island mounts at idle) | 811,180 B | 751,911 B |
| Reference build | a 12.3 to 13.9 s render pass inside a whole-site build of 20.5 s warm, 34.3 s cold | 15.1 s for pages, endpoints and their bundle |
| Dev, one chassis page | | 0.6 s cold, 0.1 s warm |
| Reference e2e (smoke, a11y, bundle budget, JSON API, roll instrument, chip strips, trees, nesting, heights, search width, cut-out) on a static server | 40 pass | the same 40 pass; the rest need the Worker or the app on both |

The five page kinds the issue names (the Contents, `/chassis/`, a chassis
page with its patterns and Show Homebrew, a roll table, `/api/v1`) are in
that build, with every other page.

## Decisions

1. **Astro owns routing, the build, the dev server, the asset graph and the
   endpoints.** `apps/web/astro/pages/` is the one list of what the site emits,
   replacing `ssg/routes.ts` and `ssg/endpoints.ts`. Output is static
   (`trailingSlash: 'always'`, `build.format: 'directory'`), so the URL to
   file table in `ssg/DESIGN.md` holds as Astro's own rule. A file Astro skips
   (`_redirects`: a leading `_`) is a param route.
2. **Pages stay `.tsx`; an `.astro` file is a shell.** Frontmatter imports a
   page module, re-exports its `getStaticPaths` and renders it through one
   seam (`astro/lib/reference.tsx`): `renderToStaticMarkup` inside the island
   collection window, as `ssg/document.tsx` did. `tsc` 7 checks every line of
   logic; `.astro` files hold none (see 6).
3. **The island protocol stays ours.** `<Island>` placeholders, one props
   script per page and `src/runtime/islands.client.ts`, now a `<script>` Astro
   bundles. Astro's own islands were tried, with `client:interaction` as a
   custom directive over `watchInteraction` and `replayInteraction` (twelve
   lines; it works, `trigger` included), and not adopted:
   - they exist only where an `.astro` file renders the component, and ours
     sit inside React trees (the Union bar's search, account and nav);
   - an SSR'd Astro island hydrates; a game-data island cannot
     (`useGameData` has no server snapshot), so it would be `client:only` and
     lose its server markup, where ours `createRoot`s over it;
   - each island page inlines 7.1 KB of Astro's island runtime, and each
     island carries its own props attribute, where ours ship once.
   The directive stays a known path for an island that one day sits in an
   `.astro` file.
4. **No adapter.** The site stays static files behind the one Worker
   (`src/worker`, `run_worker_first` for `/build` and `/play`), so
   `@astrojs/cloudflare` is not needed. Revisit it with the rooms (ADR-064).
5. **What Astro retires.** The Bun render pass and its CSS stub (Vite renders,
   so `.css` imports are safe and `ssg/DESIGN.md` hard rule 1 goes), the
   manifest round trip (`assets.entry.ts`, `BuiltAssets` lookups by manifest
   key, `fontPreloads.ts`'s picking: a page imports an asset with `?url`), the
   child-process bundle, `ssg/dev.ts` and the output-path collision check
   (Astro refuses two routes on one file). `ssg/appGraph.ts` and the per-route
   preload lists stay until #1794 shows Astro's chunking keeps app code off
   pages.
6. **TypeScript 7.** `tsc` 7 type-checks `astro/**/*.{ts,tsx}`. `astro check`
   needs TypeScript's API, which 7.0 lacks, so it runs on
   `@typescript/typescript6` in its own workspace until TypeScript 7.1 and an
   Astro language server on it ship (#1795).
7. **Bun runs Astro.** Astro 7 refuses Node below 22.23.4; scripts run it as
   `bun --bun astro`, as everything else here runs under Bun.

## How #1794 did it

- **One build, both apps.** `apps/web/astro.config.ts` replaces
  `vite.config.ts` and the old build; `bun run build` writes `dist/`, about
  21 s for the whole site against 20.5 s warm. Every URL the old build wrote
  is there, and the sitemaps, `_redirects` and `llms.txt` are byte-identical.
- **No renderer integration.** `@vitejs/plugin-react-swc` transforms the TSX;
  `@astrojs/react` would fold the shared vendor chunk into its own client.
- **The base stylesheet** stays its own file at one URL for both apps
  (ADR-050), emitted by `virtual:base-stylesheet`; the page modules look up
  `src/assets/` files through `BuiltAssets`, now filled by `?url` imports
  (`astro/lib/assets.ts`).
- **The app shell** is an Astro page, `astro/pages/build/index.astro`, its
  chunks in the same `assets/`; in dev a middleware serves it for every app
  navigation, ahead of Astro's trailing-slash rule.
- **After the pages** (`astro/build/site.ts`, `astro:build:done`): the
  refusals (raw markup, UUID links, a CSP-blocked inline script, a home page
  with no script), the sitemaps, the app's public pages, then the service
  worker over the finished site.
- **The stylesheet rule stays,** restated: Astro links any stylesheet a page's
  graph imports, so one shell imports the pages' own and the `srd-css` gate
  holds every other module on that graph to none.
- **Tests** render the shells' modules without a build
  (`astro/lib/__tests__/pages.ts`) and run the endpoint routes' own `GET`s.

## Consequences

- One framework's grammar where `ssg/` reimplemented it: routes, static paths,
  endpoints, `?url` assets, dev rendering. About 4,100 lines of `ssg/` and its
  tests go with #1794.
- Astro's Vite is pinned by Astro (`^8.3.4`), so a Vite major waits for Astro.
- Asset names keep the `name-hash` form (`HASHED_NAMES` in `astro.config.ts`):
  the bundle-budget specs match chunks by prefix.
