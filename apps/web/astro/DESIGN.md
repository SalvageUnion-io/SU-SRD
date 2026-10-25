# reference site on Astro — design contract

The reference site, built by Astro 7 (ADR-065 in [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)). Page and endpoint types live in [`src/reference/types.ts`](../src/reference/types.ts).

## Hard rules

1. **Pages link one stylesheet of their own.** `src/styles/global.css`, imported by `layouts/Page.astro`, beside the base both apps share (`src/styles/baseStylesheet.ts`). Astro links every stylesheet a page's graph imports, so a component's `.css` rides into every page reaching it (`bun run check styling`, `srd-css`).
2. **`astro/build/**` is build-time only.** Nothing under `src/` imports it.
3. **`.astro` files hold no logic;** `astro check` types them.
4. **A page is a `.tsx` module behind a five-line shell.** `pages/**.astro` imports one `*.page.tsx` module as `module` and renders it through `lib/reference.tsx`; `pages.test.ts` holds each shell to its `pattern`.
5. **One render path.** `astro dev` renders through the same seam as the build; never a client-rendered SPA in dev.

## Routes are files

`astro/pages/` is the one list of what the site emits. A page module is a `PageModule` (`pattern`, `getStaticPaths?`, `page`); a document with no data is a `public/` file. Non-HTML outputs are `src/reference/endpoints/*.ts` behind `pages/**.ts` routes (`lib/endpoint.ts`); a file Astro would skip (`_redirects`, a leading `_`) is a param route.

## URL -> file table

`trailingSlash: 'always'`, `build.format: 'directory'`:

| route                                  | dist file                                         |
| --- | --- |
| `/` | `index.html` |
| `/404` | `404.html` (Astro's own rule, not a directory) |
| `/chassis/aegis` | `chassis/aegis/index.html` |
| `/schema/chassis.json` | `schema/chassis.json` (a file, not a dir) |
| `/llms.txt` | `llms.txt` |
| `/build/` | `build/index.html`, the app's shell (`pages/build/index.astro`) |

Canonical URLs always carry a trailing slash.

## The island protocol

1. **`createRoot`, unless `hydrate`.** `useGameData`'s server snapshot is `false`, so a game-data island cannot hydrate. `hydrate` is for an `ssr` island whose children are itself, from the same props, reading no game data: they render with `renderToString` and `hydrateRoot` adopts them.
2. **`ssr` is an SEO / no-JS choice, default `false`.** Without `hydrate` the markup is replaced on mount, so it cannot mismatch.
3. **`<Island>` emits one placeholder.** `<div data-island data-client data-island-id>`, plus `data-hydrate` / `data-trigger` / `data-when`; `when="signed-in"` mounts only under the account hint (`src/lib/accountState.ts`), else is marked `data-island-skipped`; `client` is `load | idle | visible | only | interaction`.
4. **Props ship once per page.** One `<script type="application/json" data-island-props>`, keyed by `data-island-id`.
5. **Scheduling.** `load`/`only` mount at once, `idle` on `requestIdleCallback` with a 2 s `timeout` (200ms `setTimeout` where it is missing), `visible` on first intersection. `interaction` waits for the reader's first reach (or, with `trigger`, one on a matching element) and replays what they did meanwhile (`src/runtime/interaction.ts`); `src/runtime/mountNow.ts` says when it cannot wait. React loads only with an island.
6. **The registry uses static dynamic imports.** `src/runtime/islandRegistry.ts`, so Rollup code-splits each island.
7. **Props designed out.** An island whose props would repeat on every page computes them in its own chunk: `MobileNavIsland` takes none; `SchemaViewerIsland` reads its preloaded schema.

## Per-island table

| island | client | ssr | why |
| --- | --- | --- | --- |
| `SearchIsland` | interaction | **true** | chrome; the `hero` variant is a plain GET form |
| `MobileSearchIsland` | interaction | **true** | chrome |
| `MobileNavIsland` | interaction | **true** | chrome; props designed out |
| `AccountIsland`, `AccountAvatarIsland` | idle | false | chrome, `when="signed-in"`: the shared account menu; Sign in is static markup |
| `SchemaViewerIsland` | interaction | **true** | SEO: the island's own band and listing |
| `ReferenceEntityIsland` | visible | false | SSR would be empty; `StaticEntityContent` is the SEO path |
| `RollTableIsland` | idle | **true** | `hydrate`: the bands are content |
| `ColophonIsland` | visible | **true** | prose worth indexing |
| `OgCardIsland` | load | false | screenshot target |
| `ColumnsTableIsland` | idle | **true** | `hydrate`: Callsign, as above |
| `DidYouMeanIsland` | idle | false | the 404's guesses: the missed path is known only in the browser |
| `PeekIsland` | interaction | false | every page, no props, `trigger="[data-peek]"` |

The WIKI link is not an island (`src/lib/wikiLink.ts`).

`EntityCardStatic` ships no JS on the static path; `ReferenceEntityIsland` reuses it only for cards `cardNeedsHydration` flags.

## Build (`bun run build`)

1. **The nav catalog, then Astro** (`build/genNavCatalog.ts`, then `astro.config.ts`), both apps into one `assets/`: keep the shared `react` group, keep the app's groups off the reference site's modules (`build/appGraph.ts`), and never chunk `salvageunion-reference`.
2. **Finish** (`build/site.ts`): sitemaps, the app's public pages, then the service worker.
3. **Refuse silent failures.** No script or stylesheet on the home page, raw markup, a CSP-blocked inline script or a UUID link fails the build.
