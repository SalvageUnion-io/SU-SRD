# srd SSG — design contract

This is the in-house static-site generator that replaces Astro for `apps/srd`
(Plan B of the "One Stack, Two Sites" migration). Every agent working on this
migration implements against THIS contract. Do not invent a different one.

## Why this shape

Astro gave us five things. Four port trivially; the fifth (zero-JS components +
islands) is the whole decision. The key finding that makes it tractable:

**We mount islands with `createRoot`, never `hydrateRoot`.**

`useGameData`'s server snapshot is hardcoded `false` on purpose (see
`EntityView.astro`'s comment and `cardNeedsHydration`), so a hydrating card
renders its fallback on the client's first pass while the server rendered the
real thing — the React #418 mismatch. Client-only mounting has no mismatch class
at all: the server markup inside a placeholder is simply discarded and replaced.
That removes the single largest correctness risk in the migration.

Consequence: server-rendering an island's markup is **opt-in per island**, and is
purely an SEO/no-JS concern, never a hydration concern.

## Directory layout

```
apps/srd/
  ssg/                     build-time only; never imported by client code
    DESIGN.md              this file
    types.ts               the contract (below)
    routes.ts              the explicit route registry
    document.tsx           <html> shell: head tags, JSON-LD, script/style injection
    render.tsx             render one route -> html string
    build.ts               orchestrator: vite build -> render all -> emit
    dev.ts                 dev server; SAME render path as prod
    endpoints.ts           non-HTML outputs (JSON, llms.txt, search-index)
    sitemap.ts             sitemap.xml + sitemap-index.xml
    pwa.ts                 workbox generateSW over the finished dist
  src/
    pages/**/*.page.tsx    route modules (see PageModule)
    endpoints/*.ts         endpoint modules
    runtime/
      Island.tsx           <Island> — the SSR-side placeholder component
      islandRegistry.ts    island name -> () => import(...)  (client side)
      islands.client.ts    client entry: scans placeholders and mounts
      styles.entry.ts      imports ALL css (fontsource + global.css)
    layouts/BaseLayout.tsx replaces BaseLayout.astro
```

## Hard rules

1. **No `.css` import may be reachable from an SSR module.** The SSR pass runs
   under Bun and does not go through Vite, so a stray `import './x.css'` breaks
   the build. ALL css is imported from `src/runtime/styles.entry.ts`, which is a
   client-bundle entry only. `BaseLayout.tsx` must not import css.
2. **`ssg/**` is build-time only.** Nothing under `src/runtime/` or `src/pages/`
   may import from `ssg/` at runtime.
3. **Relative imports only** (repo rule — never `@/` aliases).
4. **`type` over `interface`**; `import type` for type-only imports; no `any`.
5. Output paths must match Astro's exactly (see "URL -> file" below).
   `ssg/__tests__/outputPath.test.ts` is the judge, not your reading of the code.

## types.ts — the contract

```ts
import type { ReactNode } from 'react'

/** A JSON-LD object. */
export type StructuredData = Record<string, unknown>

export type BreadcrumbItem = { name: string; url: string }

/** Everything BaseLayout needs to build <head>. Mirrors BaseLayout.astro's Props. */
export type DocumentMeta = {
  title?: string
  description?: string
  canonical?: string
  ogType?: string
  ogImage?: string
  ogImageAlt?: string
  structuredData?: StructuredData
  additionalStructuredData?: StructuredData[]
  noindex?: boolean
  preloadImage?: string
  breadcrumbs?: BreadcrumbItem[]
  breadcrumbDescription?: string
}

/** What a page returns: its head metadata and its body tree. */
export type PageResult = { meta: DocumentMeta; children: ReactNode }

export type RouteContext<Params, Props> = {
  params: Params
  props: Props
  /** Full URL of the page being rendered, e.g. https://salvageunion.io/about/ */
  url: URL
  /** Pathname with a trailing slash, e.g. /schema/chassis/item/aegis/ */
  pathname: string
}

export type StaticPath<Params, Props> = { params: Params; props: Props }

export type PageModule<Params = Record<string, string>, Props = unknown> = {
  /** Astro-style pattern, e.g. '/schema/[schemaId]/item/[itemId]' */
  pattern: string
  /** Omit for a single fixed route. */
  getStaticPaths?: () => StaticPath<Params, Props>[]
  page: (ctx: RouteContext<Params, Props>) => PageResult
}

/** A non-HTML build output. */
export type EndpointModule<Params = Record<string, string>, Props = unknown> = {
  /** Concrete output path relative to dist, may contain [params]. */
  pattern: string
  getStaticPaths?: () => StaticPath<Params, Props>[]
  contentType: string
  body: (ctx: RouteContext<Params, Props>) => string
}
```

## URL -> file mapping (must match Astro exactly)

Astro is configured `trailingSlash: 'ignore'`, `output: 'static'`. Verified
against the baseline build:

| route                                  | dist file                                                   |
| -------------------------------------- | ----------------------------------------------------------- |
| `/`                                    | `index.html`                                                |
| `/about`                               | `about/index.html`                                          |
| `/404`                                 | `404.html` **(special-cased, not a directory)**             |
| `/schema/chassis`                      | `schema/chassis/index.html`                                 |
| `/schema/chassis/item/aegis`           | `schema/chassis/item/aegis/index.html`                      |
| `/schema/chassis/item/aegis/pattern/x` | `schema/chassis/item/aegis/pattern/x/index.html`            |
| `/schema/chassis.json`                 | `schema/chassis.json` (dotted endpoint — a FILE, not a dir) |
| `/llms.txt`                            | `llms.txt`                                                  |

Canonical URLs always carry a trailing slash (BaseLayout.astro appends one).
Preserve that: `canonicalUrl = new URL(pathnameWithSlash, SITE_URL).href`.

## The island protocol

### SSR side — `<Island>`

```tsx
<Island name="SearchIsland" client="idle" props={{ ... }} ssr={false} />
```

Renders exactly:

```html
<div data-island="SearchIsland" data-client="idle" data-island-id="i0">…ssr markup or empty…</div>
```

- `client`: `'load' | 'idle' | 'visible' | 'only'`. Kept 1:1 with the Astro
  directives currently in use so the existing guard test can be ported rather
  than deleted.
- `ssr`: default `false`. When `true`, the island's element is also rendered
  with `renderToStaticMarkup` into the placeholder for crawlers/no-JS. This is
  an SEO decision ONLY — mounting is always `createRoot`, so the markup is
  replaced, and a mismatch is impossible.
- Props for every island on the page are collected and emitted **once per page**
  as a single JSON script tag, keyed by `data-island-id`:

```html
<script type="application/json" data-island-props>
  {"i0":{...},"i1":{...}}
</script>
```

This is already better than Astro (which repeats props in an attribute per
island), but it is NOT where the 17.3 MB win comes from — see below.

### Client side — `islands.client.ts`

1. Parse the `data-island-props` JSON once.
2. `document.querySelectorAll('[data-island]')`.
3. For each, resolve the loader from `islandRegistry`, schedule it per `data-client`:
   - `load` / `only` → immediately
   - `idle` → `requestIdleCallback` (fallback `setTimeout(…, 200)`)
   - `visible` → `IntersectionObserver`, mount on first intersection
4. `const root = createRoot(el); root.render(<C {...props} />)`.
   **`createRoot`, not `hydrateRoot`** — clear the placeholder's SSR markup first
   (`el.replaceChildren()`) so `ssr:true` islands do not double-render.

`islandRegistry.ts` maps name -> `() => import('../components/islands/X')`.
Static dynamic-import specifiers are required so Rollup can code-split them.

### The 17.3 MB win — props designed out

Measured on the baseline build: serialized island props total **18.7 MB across
1,039 pages**, of which **`MobileNavIsland` alone is 17.3 MB** — the same 16.6 KB
catalog blob copied into every page (31% of a typical entity page).

**`MobileNavIsland` must take zero props.** `buildCatalogSections()` is a pure
function from `component-lib` and `currentPath` is `location.pathname`, so the
island computes both itself inside its own chunk — one copy, shared by every
page, instead of 1,039 inlined copies. Do this; it is a stated goal of the plan.

`SchemaViewerIsland`'s `initialData` (1.0 MB over 24 pages) is a _stretch_:
correctness first. Only design it out if the island can source the same data via
its existing `preloadSchemas` path without changing what the page shows.

## Per-island decisions (SSR flag)

| island                  | client  | ssr      | why                                                              |
| ----------------------- | ------- | -------- | ---------------------------------------------------------------- |
| `SearchIsland`          | idle    | false    | chrome, no SEO value                                             |
| `MobileSearchIsland`    | idle    | false    | chrome                                                           |
| `MobileNavIsland`       | idle    | false    | chrome; props designed out                                       |
| `SchemaViewerIsland`    | visible | **true** | the entity grid is this page's SEO content                       |
| `ReferenceEntityIsland` | visible | false    | SSR would emit a skeleton; `StaticEntityContent` is the SEO path |
| `ColophonIsland`        | visible | **true** | prose worth indexing                                             |
| `SearchResultsIsland`   | only    | false    | was `client:only="react"`                                        |
| `OgCardIsland`          | load    | false    | screenshot target                                                |

`EntityCardStatic` is NOT an island — it renders straight into the page tree and
ships no JS. That path must stay exactly as it is; it is 82% of entity pages.

## What replaces the rest of Astro

| Astro feature                                | replacement                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ClientRouter` (view transitions)            | cross-document `@view-transition { navigation: auto; }` in `global.css`. Deletes the router JS. Also delete the `data-astro-rerun` `.js`-class script: with real document navigations the inline script runs on every page, so re-running it is moot.                                      |
| `prefetch: { prefetchAll, hover }`           | `<script type="speculationrules">` with `eagerness: "moderate"` — browser-native, zero JS.                                                                                                                                                                                                 |
| `@astrojs/sitemap`                           | `ssg/sitemap.ts`. Must reproduce the same filter: exclude `/image`, `/greembeem`, `.og.png`, `/og-card`. Emit `sitemap-index.xml` + `sitemap-0.xml` as Astro did.                                                                                                                          |
| `@vite-pwa/astro`                            | `workbox-build`'s `generateSW` in `ssg/pwa.ts`, run over the finished `dist`. Reuse the existing config verbatim: `globPatterns: ['**/*.{js,css,woff2,svg}']`, `navigateFallback: null`, `skipWaiting`, `clientsClaim`, and the two `runtimeCaching` rules. Keep emitting `registerSW.js`. |
| `astro:transitions` import                   | gone                                                                                                                                                                                                                                                                                       |
| `Astro.props` / `Astro.params` / `Astro.url` | `RouteContext`                                                                                                                                                                                                                                                                             |
| `astro check`                                | `tsc --noEmit` only                                                                                                                                                                                                                                                                        |

## Verification — the parity script (RETIRED)

**Historical.** `ssg/parity.ts` was the acceptance gate for this migration. It
compared the new `dist` semantically against an archived Astro baseline — the
exact emitted path set both directions, per-page head metadata and every JSON-LD
block deep-compared, `<main>` visible text normalized, all 899 JSON endpoints
parsed and deep-compared, and byte-identical `llms.txt`. It reported zero
differences across 1,039 pages, and it was known to bite: it failed against
eight deliberately-injected defects. The migration passed on its evidence.

It has since been **deleted**, along with `make-parity-baseline.ts` and its
tests. Its baseline was a ~56 MB Astro-era `dist` that was gitignored, absent
from every checkout, and regenerable only by installing ~2,200 Astro-era
packages — so in practice the gate had stopped being runnable at all, while the
docs still told people to run it. [ADR-031](../../../docs/adrs/ADR-031-srd-vite-ssg.md)
called this shelf life in the original decision.

**Nothing replaced it.** No check now compares the finished site against a
reference; the remaining tests cover this generator's individual pieces. Treat
"the build succeeded" as saying nothing about whether the output is correct, and
verify emit changes against real built HTML.

## Build orchestration (`ssg/build.ts`)

1. `vite build` (client only). Entries: `src/runtime/islands.client.ts` and
   `src/runtime/styles.entry.ts`. Emit `manifest: true`. Keep the existing
   `react-vendor` manualChunks rule and the deliberate NON-chunking of
   `salvageunion-reference` (its JSON data must stay dynamically split).
2. Read `dist/.vite/manifest.json` -> entry JS + CSS urls.
3. Enumerate routes from `ssg/routes.ts`; render each with `ssg/render.tsx`.
4. Write endpoints, sitemap, `registerSW.js`.
5. `workbox generateSW`.
6. Copy `public/` (Vite does this; ensure `_headers` and `favicon.ico` land).

`ssg/dev.ts` runs Vite in **middleware mode** and renders through the SAME
`render.tsx` path via `ssrLoadModule`. Do NOT serve a client-rendered SPA in
dev — the plan calls that out as the largest hidden cost and the most likely
source of production-only bugs. Slower and honest beats fast and divergent.
