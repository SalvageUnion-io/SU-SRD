# srd SSG — design contract

The in-house static-site generator behind `apps/srd`
([ADR-031](../../../docs/ARCHITECTURE.md#adr-031) records why). Implement
against this contract; do not invent a different one. The files are listed in
[`apps/srd/CLAUDE.md`](../CLAUDE.md), and the types are
[`ssg/types.ts`](types.ts): read them there.

## Why this shape

**We mount islands with `createRoot`, never `hydrateRoot`.**

`useGameData`'s server snapshot is hardcoded `false` on purpose
(`cardNeedsHydration`), so a hydrating card would render its fallback on the
client's first pass while the server rendered the real thing: React #418.
Client-only mounting has no mismatch class at all: the server markup inside a
placeholder is discarded and replaced.

So server-rendering an island's markup is **opt-in per island**, and purely an
SEO and no-JS concern, never a hydration concern.

## Hard rules

1. **No `.css` import may be reachable from an SSR module.** All CSS is
   imported from `src/runtime/styles.entry.ts`, a client-bundle entry only, and
   `BaseLayout.tsx` imports none. A stray import does not fail the build: the
   `ssg-css-stub` plugin in `build.ts` resolves it to an empty module, so its
   rules never ship, under a green build and typecheck. `bun run check styling`
   (its `srd-css` rule set) enforces this rule.
2. **`ssg/**` is build-time only.** Nothing under `src/runtime/` or `src/pages/`
   may import from `ssg/` at runtime.
3. Code style (relative imports, `import type`, no `any`, …) is Biome's:
   `biome.jsonc` is the authority, not this list.
4. Output paths follow "URL -> file" below.
   `ssg/__tests__/outputPath.test.ts` is the judge, not your reading of the code.

## URL -> file mapping

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

Canonical URLs always carry a trailing slash:
`canonicalUrl = new URL(pathnameWithSlash, SITE_URL).href`.

## The island protocol

### SSR side — `<Island>`

```tsx
<Island name="SearchIsland" client="idle" props={{ ... }} ssr={false} />
```

Renders exactly:

```html
<div data-island="SearchIsland" data-client="idle" data-island-id="i0">…ssr markup or empty…</div>
```

- `client`: `'load' | 'idle' | 'visible' | 'only'`.
- `ssr`: default `false`. When `true`, the island's element is also rendered
  with `renderToStaticMarkup` into the placeholder for crawlers and no-JS. This
  is an SEO decision only: mounting is always `createRoot`, so the markup is
  replaced, and a mismatch is impossible.
- Props for every island on the page are emitted **once per page** as a single
  JSON script tag, keyed by `data-island-id`:

```html
<script type="application/json" data-island-props>
  {"i0":{...},"i1":{...}}
</script>
```

### Client side — `islands.client.ts`

1. Parse the `data-island-props` JSON once.
2. `document.querySelectorAll('[data-island]')`.
3. For each, resolve the loader from `islandRegistry`, scheduled per `data-client`:
   - `load` / `only` → immediately
   - `idle` → `requestIdleCallback` (fallback `setTimeout(…, 200)`)
   - `visible` → `IntersectionObserver`, mount on first intersection
4. `const root = createRoot(el); root.render(<C {...props} />)`.
   **`createRoot`, not `hydrateRoot`**: clear the placeholder's SSR markup first
   (`el.replaceChildren()`) so `ssr: true` islands do not double-render.

`islandRegistry.ts` maps name -> `() => import('../components/islands/X')`.
Static dynamic-import specifiers are required so Rollup can code-split them.

### Props designed out

An island whose props would repeat on every page computes them inside its own
chunk instead. **`MobileNavIsland` takes zero props**: its catalog is computed
at build time into its own chunk, one shared copy, and `currentPath` is
`location.pathname`. Inlined per page it was 17.3 MB of HTML across 1,039
pages. `SchemaViewerIsland` takes no `initialData` either: the listing's schema
is always in its `preloadSchemas`, so the island reads
`getModel(schemaId).all()` behind its `GameDataGate`, the same call the page
builds from.

## Per-island decisions (SSR flag)

| island                  | client  | ssr      | why                                                              |
| ----------------------- | ------- | -------- | ---------------------------------------------------------------- |
| `SearchIsland`          | idle    | false    | chrome, no SEO value (bar); the home band's `hero` variant is **true**: its server markup is a plain GET form to `/search/` |
| `MobileSearchIsland`    | idle    | false    | chrome                                                           |
| `MobileNavIsland`       | idle    | false    | chrome; props designed out                                       |
| `SchemaViewerIsland`    | visible | **true** | SEO content; server markup is a named row per entity, not the island |
| `ReferenceEntityIsland` | visible | false    | SSR would emit a skeleton; `StaticEntityContent` is the SEO path |
| `RollTableIsland`       | idle    | **true** | a roll table's page (board 08b); server markup is the same `RollTableView` with no roll, so its bands are real content |
| `ColophonIsland`        | visible | **true** | prose worth indexing                                             |
| `SearchResultsIsland`   | only    | false    | a client-only results page                                       |
| `OgCardIsland`          | load    | false    | screenshot target                                                |

`EntityCardStatic` is NOT an island: it renders straight into the page tree and
ships no JS, for 82% of entity pages. Keep it that way.

## Verification

There is no whole-site output snapshot. `ssg/build.ts` refuses the silent
failures itself: a Vite manifest with no script or stylesheet, two routes
resolving to one file, a registry that renders zero pages, and an entity link
that uses a UUID. `ssg/__tests__/routes.test.ts` holds the registry: every
registered route emits at least one page, each to its own file, and the total
stays above a floor. CI's `build-srd` job then checks the built `dist` with
`ssg/checkPageExamples.ts` (every example the site prints resolves), the
Playwright smoke and bundle-budget specs, and the axe-core scan.

## Build orchestration (`ssg/build.ts`)

1. `vite build` (client only). Entries: `src/runtime/islands.client.ts` and
   `src/runtime/styles.entry.ts`. Emit `manifest: true`. Keep the existing
   `react-vendor` `codeSplitting` group and the deliberate NON-chunking of
   `salvageunion-reference` (its JSON data must stay dynamically split).
   Vite copies `public/` (`_headers`, `favicon.ico`, `registerSW.js`) and
   `vite-plugin-pwa` then writes `sw.js` over the js/css/woff2/svg it emitted.
2. Read `dist/.vite/manifest.json` -> entry JS + CSS urls.
3. Enumerate routes from `ssg/routes.ts`; render each with `ssg/render.tsx`.
4. Write endpoints and the sitemap.

`ssg/dev.ts` runs Vite in **middleware mode** and renders through the SAME
`render.tsx` path via `ssrLoadModule`. Do NOT serve a client-rendered SPA in
dev: a second render path is where production-only bugs come from.
