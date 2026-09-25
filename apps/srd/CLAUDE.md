# SURef Web (Static Reference Site)

Static SRD reference site for Salvage Union game data. Read-only — choices render
ephemerally/non-editably
([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)).

> **srd is not an Astro app** — it runs on an in-house static-site generator in
> [`ssg/`](ssg/) ([ADR-031](../../docs/adrs/ADR-031-srd-vite-ssg.md), superseding
> ADR-012). No `.astro` files, no `astro.config.mjs`, no `client:*` directives,
> no file-based routing. The contract is [`ssg/DESIGN.md`](ssg/DESIGN.md) —
> **read it first.** This file is the canonical statement of this; others point here.

## Stack

- **Framework:** in-house SSG at `ssg/`, React 19 for rendering, Vite 8 for the
  client bundle. No framework runtime ships to the browser beyond React.
- **Output:** Static HTML (no server runtime, no SSR at request time, no auth,
  no backend)
- **UI:** `component-lib` components and theme (Tailwind v4 while
  [#802](../../docs/design-system/tailwind-removal.md) runs)
- **Components:** Shared components from `component-lib`; React islands for
  interactivity
- **Game data:** `salvageunion-reference` workspace package
- **Tooling:** Biome (`bun run lint`) and TypeScript 7 (`bun run typecheck`).
- **Deployment:** Cloudflare Workers Static Assets (`wrangler.jsonc`; no Worker
  script — `srd` is fully static, so every request is an asset lookup)

## Architecture

### The SSG (`ssg/` — build-time only, never imported by client code)

| file            | role                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `DESIGN.md`     | **the contract.** Read before changing anything here                          |
| `types.ts`      | `PageModule` / `EndpointModule` / `RouteContext` / `DocumentMeta`             |
| `routes.ts`     | the **explicit** route registry                                               |
| `endpoints.ts`  | non-HTML outputs (`*.json`, `llms.txt`, search index)                         |
| `render.tsx`    | render one route → HTML string                                                |
| `document.tsx`  | the `<html>` shell: head tags, JSON-LD, script/style injection                |
| `build.ts`      | orchestrator: vite client build → render every route → emit                   |
| `dev.ts`        | dev server; Vite in middleware mode, **same `render.tsx` path**               |
| `sitemap.ts`    | `sitemap-index.xml` + `sitemap-0.xml`                                         |
| `pwa.ts`        | workbox `generateSW` over the finished `dist`                                 |
| `outputPath.ts` | URL → dist file mapping (`/404` → `404.html`, everything else `…/index.html`) |
| `htmlDigest.ts` | tolerant, dependency-free scanning of built HTML (head, JSON-LD, text)        |
| `snapshot.ts`   | **the output gate** — see below                                              |

### Routes are registered, not discovered

A route is a `src/pages/**/*.page.tsx` module exporting a `PageModule`:

```ts
export const aboutPage: PageModule = {
  pattern: '/about',
  // getStaticPaths?: () => StaticPath<Params, Props>[]   // omit for a fixed route
  page: (ctx) => ({ meta: { title: '…' }, children: <…/> }),
}
```

It only builds if it is imported and `register(…)`ed in
[`ssg/routes.ts`](ssg/routes.ts). That file is the one place to read to know what
the site emits. A finished document with no data behind it is not a route at
all — `/greembeem` ships as `public/greembeem/index.html`, which Vite copies
into `dist` like any public file. Non-HTML outputs are `src/endpoints/*.ts`
wired through `ssg/endpoints.ts` — **endpoints are not routes.**

Current routes: `/`, `/schema/[schemaId]`, `/schema/[schemaId]/item/[itemId]`,
`/schema/[schemaId]/item/[itemId]/pattern/[patternId]`, `/about`, `/api`,
`/changelog`, `/search`, `/discord`, `/bot/privacy`, `/bot/terms`, `/og-card`,
`/404`.

### The island protocol

```tsx
<Island name="SearchIsland" client="idle" props={{ … }} ssr={false} />
```

renders exactly one placeholder:

```html
<div data-island="SearchIsland" data-client="idle" data-island-id="i0">…</div>
```

- **Four client strategies** (`data-client`): `load` and `only` mount immediately, `idle` via
  `requestIdleCallback` (fallback `setTimeout(…, 200)`), `visible` via
  `IntersectionObserver` on first intersection.
- **Mounting is always `createRoot`, never `hydrateRoot`**
  (`src/runtime/islands.client.ts`). `useGameData`'s server snapshot is hardcoded
  `false`, so hydrating would reintroduce the React #418 mismatch that
  `cardNeedsHydration` exists to avoid. The mounter clears the placeholder
  (`el.replaceChildren()`) and renders fresh.
- Consequently **`ssr` is an SEO/no-JS decision per island, never a hydration
  contract** — server markup inside a placeholder is discarded on mount, so a
  mismatch is impossible. Default `false`; the per-island table is in
  `ssg/DESIGN.md`.
- Props for every island on a page are emitted **once per page** as a single
  `<script type="application/json" data-island-props>` keyed by
  `data-island-id` — not per-island attributes.
- `src/runtime/islandRegistry.ts` maps name → `() => import('…')`. Every
  specifier must be a **static string literal** so Rollup code-splits it; a
  computed specifier collapses the registry into one eager chunk.
- **`MobileNavIsland` takes zero props on purpose.** As a prop, its 16.6 KB
  catalog blob would be inlined into all 1,039 pages (17.3 MB); the island
  computes `buildCatalogSections()` and `location.pathname` itself inside its own
  chunk. Do not "helpfully" pass it props again.
- `EntityCardStatic` is **not** an island — it renders straight into the page
  tree and ships no JS. It is 82% of entity pages; leave that path alone.

## Hard rules

1. **No `.css` import may be reachable from an SSR module.** Note what this does
   NOT do: it does **not** break the build. Measured — a `.css` import in an SSR
   module resolves under Bun and returns an object, exit 0, and `ssg/build.ts`'s
   `ssg-css-stub` plugin makes that deterministic rather than introducing it.
   That is precisely why the rule matters: a stylesheet imported anywhere else
   never reaches Vite, so its authored rules never ship, with a green build, a
   green typecheck and an unchanged output snapshot (which digests `<main>` text,
   not CSS). `bun run check styling` (its `srd-css` rule set) is what actually enforces it. **All** css is
   imported from
   `src/runtime/styles.entry.ts`, which is a client-bundle entry and nothing
   else. `ssg/**`, `src/pages/**`, `src/layouts/BaseLayout.tsx` and
   `src/runtime/Island.tsx` must stay stylesheet-free. The same split applies to
   static assets: `src/runtime/assets.entry.ts` is the only module that imports
   from `src/assets/`, and pages address the emitted file through
   `RouteContext.builtAssets`.
2. **`ssg/**` is build-time only.** Nothing under `src/runtime/` or `src/pages/`
   may import from `ssg/` at runtime.

## Verification — the output gate

`bun run gate` (build, `ssg/checkPageExamples.ts`, then `ssg/snapshot.ts`) diffs the built
`dist` against the committed `ssg/output-snapshot.json`, and runs in CI's
`build-srd` job. **Use the `/srd-gate` skill** (`.claude/skills/srd-gate/`): it
owns the procedure — read the diff, then `bun run snapshot:update` and commit
the snapshot with the change — plus what the gate does and does not cover and
the `/changelog` insertion exemption. `ssg/__tests__/snapshot.test.ts` is its
own test suite, including the exit-code contract (0 match, 1 drift, 2 no build).

## Key Directories

- `ssg/` - the static-site generator (build-time only)
- `src/pages/` - `*.page.tsx` route modules, registered in `ssg/routes.ts`
- `src/endpoints/` - `*.ts` endpoint modules (JSON, llms.txt, search index)
- `src/runtime/` - `Island.tsx`, `islandRegistry.ts`, `islands.client.ts`,
  `styles.entry.ts`, `assets.entry.ts`
- `src/components/islands/` - React island components
- `src/components/` - React components rendered into the page tree
- `src/layouts/BaseLayout.tsx` - the shared page shell

## Conventions

- **No auth, no backend, no user data** - pure static reference
- Search: In-memory via `salvageunion-reference` package `search()` function
- Cmd+K/Ctrl+K shortcut to focus search
- Imports from `component-lib` for shared UI components
- Dev command: `bun run dev` (= `bun ssg/dev.ts`). Dev renders through the same
  `render.tsx` as production **on purpose** — it is slower than an SPA dev server
  and honest about what production will emit. Do not "optimize" it into a
  client-rendered SPA.

## Social preview images (og:image)

Each entity page's `og:image` is a **screenshot of its Catalog tile** — the same
`EntityCatalogTile` component the schema index grid renders, so the preview cannot
drift from the Catalog view. Generated by `scripts/og-screenshots.ts` into
`dist/schema/{schemaId}/item/{itemId}.og.png`.

- The tile is laid out at `CATALOG_VIEWPORT_WIDTH` (1440), **not** at its own
  width. The card's shape comes from viewport media queries (`md:flex-row`,
  `md:w-2/5`), so a narrow viewport captures the mobile stack — artwork above
  the prose — instead of the desktop tile.
- Its width is **fitted per entity**: the generator re-flows the card at every
  width in `CATALOG_TILE_WIDTHS` and keeps whichever covers the most of the
  1200×630 canvas (`pickTileWidth` in `src/lib/ogCard.ts`, unit-tested). The
  grid tile is fluid (`flex-1`), so every candidate is a real catalog layout.
  Near-ties go to the narrowest, so a card only widens when widening buys
  canvas; content-light tiles stay at the 432px grid width. The run logs the
  width distribution, and says so if cards pile up at the ceiling.

- Run it with `bun --filter srd og:generate` (chromium via `og:install-browser`).
  It is **opt-in** — a plain `bun run build` never renders images, so CI stays fast.
- The build always emits the _default_ og:image; the script then rewrites the meta
  only for pages whose PNG actually landed. Generation being skipped, capped by
  `OG_SCREENSHOTS_BUDGET_MS`, or failing outright therefore degrades to the
  default banner and **never fails the build** — the failure mode that got the
  previous version of this deleted (#482).
- Bump `SCRIPT_VERSION` in the script whenever the tile's _rendering_ changes
  (the card stack, fonts, dimensions); entity data changes invalidate on their own.
- Chassis **patterns** are covered as entities in their own right — a pattern has
  its own page, card view and provenance, so it gets its own tile at
  `…/item/{itemId}/pattern/{patternId}.og.png` rather than inheriting the
  chassis image.

## Changelog (generated)

The `/changelog` page (`src/pages/changelog.page.tsx`) is rendered **at build time**. Its
`page()` reads two markdown files with `node:fs` during the SSR pass — paths resolved from
`import.meta.url`, never `process.cwd()`, because `bun ssg/build.ts` makes no promise about the
cwd — and merges them via the shared `parseChangelog` / `mergeChangelogs` helpers from
`component-lib`, then renders `Changelog`:

- `apps/srd/CHANGELOG.md` — changes to this site and its companion tools (area badge **Site**)
- `packages/salvageunion-reference/CHANGELOG.md` — changes to the game-data package (area badge **Data**)

Both files are **maintained by release-please** from conventional-commit PR titles (see
[ADR-024](../../docs/adrs/ADR-024-derived-release-changelogs.md)). Entries are
merged newest-first by date across both sources.

**Do NOT hand-edit `CHANGELOG.md`.** The only allowed manual touch is optionally polishing the
entries in an **open release PR** before merging it. Otherwise the changelog is derived entirely
from PR titles:

- Write a clear conventional PR title (`feat:` / `fix:` …) — it becomes the changelog entry.
- No per-commit or per-PR array bookkeeping is needed anymore; the release PR accumulates entries.

Historical entries (everything predating automation, marked in the file header) are backfilled in
the legacy `## <date> — <title>` heading shape, which `parseChangelog` also understands.
