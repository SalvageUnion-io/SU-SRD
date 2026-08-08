# SURef Web (Static Reference Site)

Static SRD reference site for Salvage Union game data. Read-only — choices render
ephemerally/non-editably
([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)).

> **This app is no longer built with Astro.** It was migrated onto an in-house
> static-site generator built on Vite, living at
> [`ssg/`](ssg/). There are no `.astro` files, no `astro.config.mjs`, no
> `astro check`, no `client:*` directives and no file-based routing anywhere in
> this app — if you find yourself looking for one, it has not existed since the
> migration. [ADR-012](../../docs/adrs/ADR-012-srd-astro-static.md) records the
> **superseded** Astro decision; the live contract is
> [`ssg/DESIGN.md`](ssg/DESIGN.md). **Read that first.**

## Stack

- **Framework:** in-house SSG at `ssg/`, React 19 for rendering, Vite 8 for the
  client bundle. No framework runtime ships to the browser beyond React.
- **Output:** Static HTML (no server runtime, no SSR at request time, no auth,
  no backend)
- **UI:** Tailwind v4 with theme from `component-lib` package
- **Components:** Shared components from `component-lib`; React islands for
  interactivity
- **Game data:** `salvageunion-reference` workspace package
- **Tooling:** **Biome** for lint/format (`bun run lint`, `bun run format`) and
  **TypeScript 7** for `bun run typecheck` — srd's old `typescript@6.0.3` pin is
  gone, it now uses the repo's TS 7. (The _root_ `typescript-classic` alias
  deliberately remains, but for exactly ONE consumer now:
  `tools/check-architecture.ts`, which needs the classic compiler API that TS 7
  does not expose. `generateApiReport.ts` moved to TS 7 — it only ever needed
  the `tsc` binary. Astro was never a consumer of either.)
- **Deployment:** Netlify (static)

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
the site emits. `registerDocument(…)` is the variant for a standalone page that
brings its own `<html>` (`greembeem`). Non-HTML outputs are `src/endpoints/*.ts`
wired through `ssg/endpoints.ts` — **endpoints are not routes.**

Current routes: `/`, `/schema/[schemaId]`, `/schema/[schemaId]/item/[itemId]`,
`/schema/[schemaId]/item/[itemId]/pattern/[patternId]`, `/about`, `/api`,
`/changelog`, `/search`, `/discord`, `/bot/privacy`, `/bot/terms`, `/og-card`,
`/greembeem`, `/404`.

### The island protocol

```tsx
<Island name="SearchIsland" client="idle" props={{ … }} ssr={false} />
```

renders exactly one placeholder:

```html
<div data-island="SearchIsland" data-client="idle" data-island-id="i0">…</div>
```

- **Four client strategies** (`data-client`), kept 1:1 with the old Astro
  directives: `load` and `only` mount immediately, `idle` via
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
- **`MobileNavIsland` takes zero props on purpose.** Astro inlined a 16.6 KB
  catalog blob into all 1,039 pages (17.3 MB of the payload); the island now
  computes `buildCatalogSections()` and `location.pathname` itself inside its own
  chunk. Do not "helpfully" pass it props again.
- `EntityCardStatic` is **not** an island — it renders straight into the page
  tree and ships no JS. It is 82% of entity pages; leave that path alone.

## Hard rules

1. **No `.css` import may be reachable from an SSR module.** The SSR pass runs
   under Bun and never goes through Vite, so a stray `import './x.css'` anywhere
   in the SSR graph breaks the build. **All** css is imported from
   `src/runtime/styles.entry.ts`, which is a client-bundle entry and nothing
   else. `ssg/**`, `src/pages/**`, `src/layouts/BaseLayout.tsx` and
   `src/runtime/Island.tsx` must stay stylesheet-free. The same split applies to
   static assets: `src/runtime/assets.entry.ts` is the only module that imports
   from `src/assets/`, and pages address the emitted file through
   `RouteContext.builtAssets`.
2. **`ssg/**` is build-time only.** Nothing under `src/runtime/` or `src/pages/`
   may import from `ssg/` at runtime.
3. Relative imports only (never `@/` aliases); `type` over `interface`;
   `import type` for type-only imports; no `any`.

## Verification — `ssg/snapshot.ts` is the output gate

```bash
cd apps/srd
bun run gate          # = bun ssg/build.ts && bun ssg/snapshot.ts
```

It compares the built `dist` against `ssg/output-snapshot.json`, a committed
~680 KB digest of the site, and **runs in CI** (in the `build-srd` job, which is
path-filtered on anything that can change srd's output — `apps/srd/**`,
`packages/component-lib/**`, `packages/salvageunion-reference/**`).

### If your change alters the output on purpose

```bash
bun run snapshot:update   # re-bless, then COMMIT the snapshot with your change
```

The snapshot is one line per page, so "23 pages changed" is literally 23 changed
lines in the diff. **That diff is the deliverable** — it is the complete,
reviewable statement of what your change did to the site. Re-blessing without
reading it defeats the entire mechanism.

### What it covers

- the exact emitted **file set**, both directions — this is what holds the page
  count at 1,039; drop a route from `routes.ts` and it fails here
- per page: `<title>`, description, canonical, robots as **plaintext** (so the
  diff reads), plus a digest of every `og:*` / `twitter:*` tag
- per page: the ordered list of JSON-LD `@type`s
- per page: a digest of `<main>`'s normalized visible text, plus its length
- all 899 JSON endpoints, canonicalized then digested (so key reordering is not
  a false positive)
- `llms.txt`, both sitemaps, `_headers`, the webmanifest

Deliberately **not** covered:

- **bundle bytes** (`assets/**`, `sw.js`) and binary assets. Their names are
  content-addressed and their content changes on every dependency bump, so
  digesting them would make the snapshot churn and the gate would get switched
  off. Hashed filenames are normalized to `-[hash]`, so the file SET is still
  asserted.
- **markup and attributes inside `<main>`** — the digest is of visible TEXT.
  A change that alters only attributes passes. Verified concretely: the
  `CardImage` regression that hid every piece of entity artwork behind
  `style="opacity:0"` (#717) does **not** fail this gate. Hashing full markup
  would catch it and would also fire on every Tailwind class change, which here
  is constant. **Visual regressions are not this gate's job** — look at the page.

Parity did not cover any of these either.

### It bites

26 tests in `ssg/__tests__/snapshot.test.ts`. Most inject a defect and assert it
is reported — dropped route, changed title/description/canonical, removed `og:`
tag, dropped JSON-LD block, altered `<main>` text, altered JSON endpoint,
reflowed `llms.txt`. It was also run against **eight defects injected into the
real 1,039-page build** and caught all eight.

Four of them cover `run()` rather than `compare()`, because **the exit code is
the gate**: CI never reads findings, it reads a process exit code, and a
comparator that finds a difference paired with a runner that returns 0 anyway
blocks nothing. They assert matches → 0, drifted → 1, no-build-to-check → 2
(never 0 — a missing `dist` must not read as "nothing changed"), and that
`--update` re-blesses so the next run passes.

### `/changelog` is compared for insertion, not equality

It renders from the two `CHANGELOG.md` files release-please **prepends** to, so
under equality every release PR would fail this gate and need a regeneration to
land — a release deadlock. Its full `<main>` text is stored and compared with
`isInsertionOf`: every character previously emitted must still be present, in
order, with growth confined to one contiguous insertion. Deleting, reordering or
rewording an old entry still FAILS, and everything else on that page (its title,
metadata, JSON-LD) is still compared normally. The gate prints the exemption on
every run.

### What it cannot do

Parity compared against a foreign **oracle** (Astro's own output), so it could
catch output that was wrong from the start. This compares against what we last
blessed, so **a wrong output that gets committed as the snapshot is wrong
forever.** That is the price of a baseline that survives; read the diff.

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
`CatalogTile` component the schema index grid renders, so the preview cannot
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
