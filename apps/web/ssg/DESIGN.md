# srd SSG — design contract

The in-house SSG behind `apps/web` (ADR-031 in [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)). Types live in [`ssg/types.ts`](types.ts).

## Hard rules

1. **No `.css` import reachable from an SSR module.** All CSS enters through `src/runtime/styles.entry.ts` (the shared base, `src/styles/base.css`, is built by `src/styles/baseStylesheet.ts`); a stray import builds green and ships nothing (`bun run check styling`, `srd-css`).
2. **`ssg/**` is build-time only.** Nothing under `src/runtime/` or `src/reference/pages/` imports `ssg/` at runtime.
3. **Code style is Biome's.** `biome.jsonc` is the authority.
4. **Output paths follow the URL -> file table.** `ssg/__tests__/outputPath.test.ts` is the judge.
5. **One render path.** `ssg/dev.ts` renders through the same `ssg/render.tsx` as the build; never a client-rendered SPA in dev.

## URL -> file table

| route                                  | dist file                                         |
| --- | --- |
| `/` | `index.html` |
| `/about` | `about/index.html` |
| `/404` | `404.html` (special-cased, not a directory) |
| `/chassis` | `chassis/index.html` |
| `/chassis/aegis` | `chassis/aegis/index.html` |
| `/chassis/aegis/pattern/x` | `chassis/aegis/pattern/x/index.html` |
| `/schema/chassis.json` | `schema/chassis.json` (dotted: a file, not a dir) |
| `/llms.txt` | `llms.txt` |

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
| `SchemaViewerIsland` | interaction | **true** | SEO: the island's own listing |
| `ReferenceEntityIsland` | visible | false | SSR would be empty; `StaticEntityContent` is the SEO path |
| `RollTableIsland` | idle | **true** | `hydrate`: the bands are content |
| `ColophonIsland` | visible | **true** | prose worth indexing |
| `SearchResultsIsland` | only | false | client-only results page |
| `OgCardIsland` | load | false | screenshot target |
| `ColumnsTableIsland` | idle | **true** | `hydrate`: Callsign, as above |
| `DidYouMeanIsland` | idle | false | the 404's guesses: the missed path is known only in the browser |
| `PeekIsland` | interaction | false | every page, no props, `trigger="[data-peek]"` |

The WIKI link is not an island (`src/lib/wikiLink.ts`).

`EntityCardStatic` ships no JS on the static path; `ReferenceEntityIsland` reuses it only for cards `cardNeedsHydration` flags.

## Build (`ssg/build.ts`)

1. **One client-only `vite build`** (`vite.config.ts`, with the app). srd's entries `islands.client.ts`, `styles.entry.ts` and `assets.entry.ts`, `manifest: true`; keep the shared `react` group, keep the app's groups off srd's modules, and never chunk `salvageunion-reference`.
2. **Render from the manifest.** Each route in `ssg/routes.ts` through `ssg/render.tsx`, then endpoints and the sitemap.
3. **Refuse silent failures.** No script or stylesheet in the manifest, two routes on one file, zero pages, or a UUID entity link fails the build.
