# srd SSG — design contract

The in-house SSG behind `apps/srd` (ADR-031 in [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)). Types live in [`ssg/types.ts`](types.ts).

## Hard rules

1. **No `.css` import reachable from an SSR module.** All CSS enters through `src/runtime/styles.entry.ts`; a stray import builds green and ships nothing (`bun run check styling`, `srd-css`).
2. **`ssg/**` is build-time only.** Nothing under `src/runtime/` or `src/pages/` imports `ssg/` at runtime.
3. **Code style is Biome's.** `biome.jsonc` is the authority.
4. **Output paths follow the URL -> file table.** `ssg/__tests__/outputPath.test.ts` is the judge.
5. **One render path.** `ssg/dev.ts` renders through the same `ssg/render.tsx` as the build; never a client-rendered SPA in dev.

## URL -> file table

| route                                  | dist file                                         |
| -------------------------------------- | ------------------------------------------------- |
| `/`                                    | `index.html`                                      |
| `/about`                               | `about/index.html`                                |
| `/404`                                 | `404.html` (special-cased, not a directory)       |
| `/schema/chassis`                      | `schema/chassis/index.html`                       |
| `/schema/chassis/item/aegis`           | `schema/chassis/item/aegis/index.html`            |
| `/schema/chassis/item/aegis/pattern/x` | `schema/chassis/item/aegis/pattern/x/index.html`  |
| `/schema/chassis.json`                 | `schema/chassis.json` (dotted: a file, not a dir) |
| `/llms.txt`                            | `llms.txt`                                        |

Canonical URLs always carry a trailing slash.

## The island protocol

1. **Mount with `createRoot`, never `hydrateRoot`.** `useGameData`'s server snapshot is `false`, so hydrating mismatches (React #418); the mounter clears the placeholder first.
2. **`ssr` is an SEO / no-JS choice, default `false`.** `true` server-renders markup into the placeholder; it is replaced on mount, so it cannot mismatch.
3. **`<Island name client props ssr>` emits one placeholder.** `<div data-island data-client data-island-id>`; `client` is `load | idle | visible | only`.
4. **Props ship once per page.** One `<script type="application/json" data-island-props>`, keyed by `data-island-id`.
5. **Scheduling.** `load`/`only` mount at once, `idle` on `requestIdleCallback` with a 2 s `timeout` (200ms `setTimeout` where it is missing), `visible` on first intersection.
6. **The registry uses static dynamic imports.** `src/runtime/islandRegistry.ts`, so Rollup code-splits each island.
7. **Props designed out.** An island whose props would repeat on every page computes them in its own chunk: `MobileNavIsland` takes none; `SchemaViewerIsland` reads its preloaded schema.

## Per-island table

| island                  | client  | ssr      | why                                                              |
| ----------------------- | ------- | -------- | ---------------------------------------------------------------- |
| `SearchIsland`          | idle    | false    | chrome; the home `hero` variant is **true** (a plain GET form)   |
| `MobileSearchIsland`    | idle    | false    | chrome                                                           |
| `MobileNavIsland`       | idle    | false    | chrome; props designed out                                       |
| `SchemaViewerIsland`    | visible | **true** | SEO; server markup is a named row per entity, not the island     |
| `ReferenceEntityIsland` | visible | false    | SSR would be empty; `StaticEntityContent` is the SEO path        |
| `RollTableIsland`       | idle    | **true** | the bands are real content (same `RollTableView`, no roll)       |
| `ColophonIsland`        | visible | **true** | prose worth indexing                                             |
| `SearchResultsIsland`   | only    | false    | client-only results page                                         |
| `OgCardIsland`          | load    | false    | screenshot target                                                |
| `ColumnsTableIsland`    | idle    | **true** | a columns table (Callsign); same `ColumnsTableView`, no roll      |
| `DidYouMeanIsland`      | idle    | false    | the 404's guesses: the missed path is known only in the browser  |
| `PeekIsland`            | idle    | false    | every page, no props: the one Peek host; loads on the first Peek |
| `WikiLinkIsland`        | idle    | false    | chrome, mounted twice; the WIKI link rolls 1 in 100 per page load |

`EntityCardStatic` is not an island: it renders into the page and ships no JS. Keep it that way.

## Build (`ssg/build.ts`)

1. **Client-only `vite build`.** Entries `islands.client.ts` and `styles.entry.ts`, `manifest: true`; keep the `react-vendor` group and never chunk `salvageunion-reference`.
2. **Render from the manifest.** Each route in `ssg/routes.ts` through `ssg/render.tsx`, then endpoints and the sitemap.
3. **Refuse silent failures.** No script or stylesheet in the manifest, two routes on one file, zero pages, or a UUID entity link fails the build.
