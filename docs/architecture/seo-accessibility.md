# SEO Strategy & WCAG Compliance

SEO applies to `srd` (the static reference site). Accessibility patterns are shared across both apps via `component-lib` components and Biome's a11y lint rules.

## SEO (srd)

> **`srd` is built by an in-house SSG, not Astro.** Everything below describes
> `apps/srd/ssg` (`build.ts` / `dev.ts` / `render.tsx`), route modules at
> `src/pages/**/*.page.tsx`, and endpoint modules at `src/endpoints/*.ts`. The
> contract is [`apps/srd/ssg/DESIGN.md`](../../apps/srd/ssg/DESIGN.md).
>
> **No automated check compares these SEO surfaces against a reference.** They
> used to be diffed against an archived Astro baseline by `ssg/parity.ts`, which
> is retired. Head metadata, JSON-LD and endpoint payloads are now only as
> correct as the build that emitted them — inspect real output when you change
> anything on this page.

### BaseLayout

**File:** `apps/srd/src/layouts/BaseLayout.tsx`

Every page renders through BaseLayout, which receives the page's `DocumentMeta`
(`ssg/types.ts`) and renders the whole `<html>` document except the hashed asset
tags and the island-props script — `ssg/document.tsx` injects those, because it
is the only module that reads the Vite manifest. **BaseLayout must never import
`.css`**; see the hard rule in `ssg/DESIGN.md`.

```typescript
type DocumentMeta = {
  title?: string
  description?: string
  canonical?: string
  ogType?: string
  ogImage?: string
  /** Descriptive alt text for the og:image. Defaults to the page title. */
  ogImageAlt?: string
  structuredData?: Record<string, unknown>
  additionalStructuredData?: Record<string, unknown>[]
  noindex?: boolean
  preloadImage?: string
  breadcrumbs?: BreadcrumbItem[]
  /** Optional descriptive tail shown after the breadcrumb trail */
  breadcrumbDescription?: string
}
```

**Renders:**

- `<title>`, `<meta name="description">`, `<link rel="canonical">`
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:image` + `og:image:width`/`height`/`alt` — **all OG images are 1200×630** (the site-wide default banner, `DEFAULT_OG_IMAGE` in `src/lib/constants.ts`)
- Twitter Cards: `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image`
- Favicons: SVG, PNG 96x96, Apple Touch Icon 180x180
- Web manifest: `site.webmanifest`
- Web fonts: Barlow superfamily self-hosted via `@fontsource/barlow` and `@fontsource/barlow-semi-condensed`, imported from `src/runtime/styles.entry.ts`; served same-origin under the strict `font-src 'self'` CSP, bundled into **`/assets/`** by Vite with `font-display: swap`. (The old Astro output directory was `/_astro/`; `netlify.toml`'s long-cache rule was moved with it.)
- Prefetch/view transitions are browser-native, replacing Astro's runtime: a `<script type="speculationrules">` block with `eagerness: "moderate"` instead of `prefetch: { prefetchAll, hover }`, and a cross-document `@view-transition { navigation: auto; }` in `global.css` instead of `ClientRouter`. Both ship zero JS.

### Machine-readable surfaces

These are **endpoint modules** (`EndpointModule` in `ssg/types.ts`), not routes.
They live in `src/endpoints/` and are registered in `ssg/endpoints.ts`.

- **`/llms.txt`** (`src/endpoints/llmsTxt.ts`) — an LLM-oriented site map of the
  reference content. Its template literal is a verbatim copy of the Astro
  original — **do not reflow it.** This used to be held byte-for-byte by the
  parity gate; with that retired the rule stands but nothing enforces it, so
  reformatting the literal now changes the shipped file silently.
- **Public JSON API** — every schema and item page has a JSON twin:
  `/schema/{schemaId}.json` (`schemaJson.ts`),
  `/schema/{schemaId}.schema.json` (`schemaDefinitionJson.ts`), and
  `/schema/{schemaId}/item/{itemId}.json` (`itemJson.ts`) — 899 of them, none of
  which are compared against a reference any more. CORS for these paths is opened
  via `public/_headers` (`Access-Control-Allow-Origin: *`, GET only).
- **Search index** — `src/endpoints/searchIndexJson.ts`.
- **PWA** — `ssg/pwa.ts` runs `workbox-build`'s `generateSW` over the finished
  `dist` (replacing `@vite-pwa/astro`), keeping the same
  `globPatterns: ['**/*.{js,css,woff2,svg}']`, `navigateFallback: null`,
  `skipWaiting`, `clientsClaim` and runtime-caching rules, and still emitting
  `registerSW.js`.

### Structured Data (JSON-LD)

Rendered as `<script type="application/ld+json">`. The main content types (the
one-off page types — `AboutPage`, `WebPage`, `SoftwareApplication`,
`TechArticle` — are not listed; grep `@type` under `apps/srd/src/pages/**/*.page.tsx`):

| Type             | Page                                                      | Key properties                                                         |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `WebSite`        | Homepage (`index.page.tsx`)                               | name, url                                                              |
| `CollectionPage` | Schema pages (`schema/[schemaId]/index.page.tsx`)         | description, item count, creator (Organization), keywords              |
| `ItemPage`       | Entity pages (`schema/[schemaId]/item/[itemId].page.tsx`) | name, tech level (PropertyValue), source (Book), parent CollectionPage |
| `BreadcrumbList` | All pages with breadcrumbs (`AppBar.tsx`)                 | Positional list items with URLs                                        |

A page declares JSON-LD by returning `meta.structuredData` /
`meta.additionalStructuredData` from its `page()`. Emitted blocks were once
deep-compared against the Astro baseline; that gate is retired, so a dropped or
malformed block now fails no check — read the built HTML.

Entity page meta descriptions are derived from the first static content paragraph, truncated to 155 characters.

### Static Content Fallback

Entity pages use progressive enhancement so crawlers see full text content even without JavaScript:

**1. Server-side extraction** (`extractStaticEntitySummary` in salvageunion-reference):

- Extracts text paragraphs from content blocks
- Collects numeric stats (SP, EP, HC, slots, cargo, HP, tech level)
- Gathers trait names
- Returns `StaticEntitySummary`

**2. Static HTML** (`StaticEntityContent` — `component-lib`'s `src/components/shared/StaticEntityContent.tsx`, rendered from `apps/srd/src/components/EntityView.tsx`):

```html
<div data-static-fallback>
  <p class="italic">{description}</p>
  <dl>{stats: label + value pairs}</dl>
  <p>{content paragraphs}</p>
  <p>Traits: {traits.join(', ')}</p>
  <p class="text-xs">Source: {source}, p. {page}</p>
</div>
```

**3. Client-side replacement** (`ReferenceEntityIsland.tsx`):
When the island **mounts** — `createRoot`, never `hydrateRoot`; there is no
hydration anywhere in this app — it removes `[data-static-fallback]` elements and
replaces them with the interactive `ReferenceEntityCard`. `BaseLayout` also stamps
`document.documentElement.classList.add('js')` synchronously before first paint so
`.js [data-static-fallback] { display: none }` (`global.css`) hides the no-JS text
for JS users; without it the naked static text flashed on every entity load.

`EntityCardStatic` — the zero-JS render path used by 82% of entity pages — is
**not** an island at all; it renders straight into the page tree.

### Sitemap & Robots

- **Sitemap**: generated by `ssg/sitemap.ts` (replacing `@astrojs/sitemap`), emitting the same `sitemap-index.xml` + `sitemap-0.xml` pair. Two independent exclusion mechanisms, on purpose: the **authoritative** one is `register(page, { sitemap: false })` at the registration site in `ssg/routes.ts`, and a URL-shaped filter in `sitemap.ts` still drops `/image`, `/greembeem`, `.og.png` and `/og-card`. Published at `https://salvageunion.io/sitemap-index.xml`.
- **robots.txt** (`apps/srd/public/robots.txt`): Allows all crawlers, references sitemap.

### Static Build Paths

`src/lib/staticPaths.ts` pre-computes all routes at build time; the page modules
expose them through `getStaticPaths()` on their `PageModule`:

- `getSchemaStaticPaths()` — Routes for all schemas
- `getItemStaticPaths()` — Routes for all items within schemas
- **Meta schemas are excluded from BOTH** (`!s.meta`): entity types like
  `actions` render inline inside their parents and get no listing or item
  pages — a test pins the "every item page has a parent listing" invariant
  (`src/lib/__tests__/staticPaths.test.ts`)
- Slug-based routing: `/schema/{schemaId}/item/{slug}/` (never UUIDs);
  per-file slug uniqueness is enforced by the package's `validate:slugs`
- Trait/keyword mentions in static fallback content are auto-linked via
  `staticLinks.ts` so crawlers see real anchors without JS

---

## Accessibility

### Tooling

**Biome** (`biome.jsonc`'s `linter.rules.a11y` group, part of Biome's `recommended` preset):
Both React apps get the built-in a11y rule group automatically — no separate plugin to enable. Some rules that have no ESLint/jsx-a11y precedent (e.g. `useButtonType`, `useSemanticElements`) are deliberately set to `"warn"` rather than Biome's default `"error"`, so this migration stays a tooling swap rather than a lint-cleanup pass; see `biome.jsonc`'s inline comments and the tooling-migration PR description for the full rationale.

Enforces: `noSvgWithoutTitle`, `useAriaPropsForRole`, `noAutofocus`, `useKeyWithClickEvents`, `noStaticElementInteractions`, and more.

**Automated scanning** (`tools/a11y-scan.ts`):
Puppeteer + axe-core WCAG 2.1 AA scanner. Usage:

```bash
bun tools/a11y-scan.ts http://localhost:4321 / /schema/chassis/ /about/
```

Reports violations with impact level (critical/serious/moderate/minor), node examples, and help URLs. Runs headless Chrome with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `best-practice` rulesets.

### Landmark Structure

| Element    | Location                   | ARIA                           |
| ---------- | -------------------------- | ------------------------------ |
| `<nav>`    | `AppBar.tsx`               | `aria-label="Main navigation"` |
| `<nav>`    | `AppBar.tsx` (breadcrumbs) | `aria-label="Breadcrumb"`      |
| `<main>`   | `BaseLayout.tsx`           | Wraps all page content         |
| `<footer>` | `Footer.tsx`               | Implicit landmark              |

`AppBar` and `Footer` both live in `component-lib` (`src/components/shared/`);
`srd` reaches the nav through `TopNavigation.tsx` → `SiteHeader.tsx` → `AppBar`.

### Heading Structure

- Homepage: `<h1 class="sr-only">` (hidden, for screen readers)
- Schema pages: `<h1>` for main heading with pseudoheader label
- Entity pages: `titleAs="h1"`, passed from `EntityView.tsx` through
  `ReferenceEntityIsland` to `ReferenceEntityCard`, which forwards it to
  `EntityCardHeader` as the title element (defaults to `span`)
- All pages have exactly one `<h1>`

### Component Accessibility Patterns

**Clickable cards** (`Card.tsx`):

```tsx
<div
  role={resolvedCardClick ? 'button' : undefined}
  tabIndex={resolvedCardClick ? 0 : undefined}
  onClick={resolvedCardClick}
  onKeyDown={handleCardKeyDown} // Enter + Space
/>
```

In `SchemaViewerIsland.tsx`, entity cards are wrapped in `<a>` tags for semantic HTML navigation with `aria-label={item.name}`.

**Tab panels** (`ActionsDeck.tsx`):

```tsx
<div role="tablist" aria-label="Filter actions by timing">
  <button type="button" role="tab" aria-selected={view.activeTab === t} />
</div>
```

**Combobox search** (`SearchIsland.tsx`, driven by `component-lib`'s
`useSearchCombobox` hook — the hook supplies `inputProps` including
`aria-activedescendant`, plus `optionId()` for the option ids):

```tsx
<input
  {...inputProps}
  aria-label="Search the SRD"
  role="combobox"
  aria-expanded={isOpen}
  aria-controls={listboxId}
/>
<div id={listboxId} role="listbox">
  <a id={optionId(index)} role="option" aria-selected={index === selectedIndex} />
</div>
```

Keyboard: ArrowDown/ArrowUp navigate, Enter opens, Escape closes, Cmd+K/Ctrl+K focuses.

**Breadcrumbs** (`AppBar.tsx`):

- Separators: `aria-hidden="true"`
- Current page: `aria-current="page"`
- Dual representation: HTML + JSON-LD `BreadcrumbList`

**Filter chips** (`FilterChip.tsx`):

```tsx
<button type="button" onClick={onClick} aria-pressed={active}>
  {label}
</button>
```

**Focus management**: Modals (`ModalShell`, built on Base UI's `Dialog` from `@base-ui/react/dialog`) trap focus and restore on close. Search dropdown manages `aria-activedescendant` for virtual focus.

### Color Contrast

SU brand colors are designed for WCAG 2.1 AA compliance:

Tokens are defined in `component-lib`'s `src/styles/theme.css`, which is the
source of truth for values. The `su-*` brand family this section used to name is
**deleted** — it was a shadow tokenset the semantic tokens aliased, so one colour
had two spellings. Values were preserved; only the names changed:

| Token             | Value                | Usage                    |
| ----------------- | -------------------- | ------------------------ |
| `--color-rust`    | `rgb(168, 82, 34)`   | The single action colour |
| `--color-mech`    | `rgb(122, 151, 138)` | Mech entity accent       |
| `--color-crawler` | `rgb(206, 88, 152)`  | Crawler entity accent    |
| `--color-ink`     | `rgb(40, 32, 25)`    | Primary text             |
| `--color-ink-2`   | `rgb(70, 61, 49)`    | Secondary ink            |

**Key principle**: entity accent colours (mech green, crawler pink, pilot orange)
are used as background accents or on large header text, never as small body text
on paper.

### Mobile Accessibility

Touch targets enforced via CSS media query:

```css
@media (pointer: coarse) {
  button,
  [role='button'],
  input,
  select,
  textarea {
    min-height: 44px;
    min-width: 44px;
  }
}
```

Ensures WCAG 2.5.5 (Target Size) compliance on touch devices.

---

## Verification

Run the a11y scanner after any UI changes:

```bash
# Start dev server, then scan key pages
bun run dev &
bun tools/a11y-scan.ts http://localhost:4321 / /schema/chassis/ /schema/chassis/item/iron-mongrel/ /about/
```

Biome catches static violations on every commit (pre-commit hook). The scanner catches runtime violations (color contrast, missing landmarks, focus management).
