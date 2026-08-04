# Upgrade Path: Astro 6 → 7 (srd)

**Status:** ✅ **Merged** in #365. srd now runs Astro 7 + Vite 8. This doc
is kept as the historical record of how the deferred blocker was resolved (the
loader change and the `trailingSlash` decision are described under **Decisions
for review** below). Two notes for anyone revisiting the loaders: `ssrEmitAssets`
was verified NOT to fix the blocker; dropping the `with: { type: 'json' }`
attribute did, and was validated across all four consumers.

> **Do not move or delete this file.** `apps/srd/astro.config.mjs:15` cites it
> **by path** — the comment reads
> _"build succeeds. See plan-docs/upgrade-astro-7.md for the SEO trade-off."_ —
> so relocating it orphans a live code comment. It is the only remaining
> occupant of `plan-docs/`; the other planning documents were folded into
> [`docs/design/`](../docs/design/) on 2026-08-03. If this ever does move,
> update that comment in the same change.

## What landed

Four coordinated changes, all in one commit (Astro 7 hard-requires Vite 8, so
this is all-or-nothing for `apps/srd`):

1. **ORM JSON loaders made bundler-inline-safe** —
   `packages/salvageunion-reference/lib/ModelFactory.ts`. Dropped the
   `with: { type: 'json' }` import attribute from the ~27 **dynamic** data
   loaders and ~27 **dynamic** schema loaders. This is the documented blocker's
   fix (see below). The one **static** `import schemaIndex from
'../schemas/index.json' with { type: 'json' }` KEEPS its attribute — TS
   `NodeNext` requires it on static default imports (`TS1543`), and it was never
   part of the blocker.
2. **Removed the srd Vite-7 pin** — deleted `vite` and `@tailwindcss/vite`
   from `apps/srd/package.json` devDependencies; srd now rides the
   monorepo Vite 8 (root-hoisted `@tailwindcss/vite`).
3. **Bumped the Astro stack** — `astro` → `^7.0.6`, `@astrojs/react` → `^6.0.1`.
   `@astrojs/check` (0.9.9) and `@astrojs/sitemap` (3.7.3) needed no bump —
   `astro check` passes clean on 7.
4. **`trailingSlash: 'always'` → `'ignore'`** in `astro.config.mjs` — works
   around a second, undocumented Astro 7 routing break (see below).
5. Removed the Dependabot `ignore` for `astro` / `@astrojs/*` majors.

## Blocker 1 (documented) — solved by dropping the import attribute

`astro@7` hard-depends on `vite: ^8`. Under Vite 8's rolldown SSR build (Astro's
prerender **is** an SSR build), the ORM's `import('../data/*.json', { with: {
type: 'json' } })` loaders were preserved as **literal Node runtime imports** in
the prerender chunk, but rolldown did **not emit** the JSON asset next to them —
so `astro build` failed static-route generation with `Cannot find module
'.../dist/.prerender/data/abilities.json'`.

- **`build.ssrEmitAssets: true` does NOT fix it** (verified on 7.0.6). A
  preserved import-attribute dynamic import isn't tracked as an emittable asset,
  so there's nothing for `ssrEmitAssets` to emit. Confirmed: `.prerender/` still
  had no `data/` dir and the import stayed verbatim in the chunk.
- **Dropping the `with: { type: 'json' }` attribute DOES fix it.** Without the
  attribute rolldown inlines the JSON into the chunk (self-contained, no runtime
  import), and the build completes (881 pages).

### Cross-consumer validation of the loader change (the deferred concern)

The doc's whole reason for deferral was the loader contract's blast radius. All
four consumers were validated green with the attribute dropped:

| Consumer    | Command                                    | Result                 |
| ----------- | ------------------------------------------ | ---------------------- |
| srd         | `astro build` (Astro 7 / Vite 8)           | ✅ 881 pages           |
| package     | `bun --filter salvageunion-reference test` | ✅ 605 pass / 0 fail   |
| discord-bot | `bun run build:bot` (`bun build`)          | ✅ 165 modules bundled |
| ITUN        | `bun run build:itun` (Vite 8)              | ✅ built + PWA         |

Plus full `bun run check:all`: lint, format, typecheck (all 5 workspaces incl.
`astro check`), **3,199 tests / 0 fail**, `validate:all` (27 files), knip — all
green. The attribute is only required at **raw-Node-ESM runtime**; every consumer
either bundles the JSON (srd / ITUN / bot) or runs via Bun (tests), so none
of them ever needs it.

## Blocker 2 (NEW — not anticipated by the original deferral) — trailingSlash

Once Blocker 1 was cleared, the build hit a second, independent Astro 7 failure:

```
TypeError: Missing parameter: schemaId
  rendering /schema/abilities.json/
```

Under Astro 7's routing, `trailingSlash: 'always'` appends a slash to the
**dotted `.json` endpoint routes** (`src/pages/schema/[schemaId].json.ts` and
`[schemaId].schema.json.ts`), producing `/schema/abilities.json/`, and param
resolution then throws during static generation. Setting `trailingSlash:
'ignore'` makes the build pass. This is not in the official v6→v7 upgrade guide.

## Decisions for review (why this is a draft, not a merge)

1. **ORM loader contract change** — dropping `with: { type: 'json' }` was the
   change deliberately deferred here. It is validated green across all four
   consumers and 3,199 tests, but it does change the package's data-loading
   contract, so it wants an explicit sign-off rather than a silent ship.
2. **`trailingSlash: 'ignore'` (SEO)** — the site was intentionally `'always'`.
   A 1-line diff, but on paper it touches URL canonicalization for all 881
   indexed HTML pages, whereas the bug it works around is confined to 3 internal
   JSON data endpoints with no SEO relevance. So the framing to weigh is
   "tiny diff, site-wide surface" vs. the alternative (restructure the dotted
   `.json` endpoints, or await an upstream Astro patch) — "bigger diff, endpoint-
   local surface."

   **Measured impact on this site, however, is effectively nil.** The emitted
   SEO signals are unchanged under `'ignore'` — verified in the Astro 7 build:
   - `<link rel="canonical">`, `<meta property="og:url">`, and the sitemap all
     still carry trailing slashes (`/schema/abilities/`, `/about/`, `/`), because
     those derive from the page's directory-index `pathname`, not from the
     enforcement mode.
   - HTML pages still emit as `dir/index.html` (served at `/path/`).
   - The `.json` endpoints are pure `APIRoute` endpoints — `trailingSlash` never
     applied to them; they emit flat `schema/{id}.json` files under both 6 and 7,
     which is why the live app's `fetch('/schema/chassis.json')` already works.
   - Netlify carries no trailing-slash redirect config, so hosting behavior is
     unchanged.

   What `'ignore'` actually relaxes is Astro's **build-time** trailing-slash
   enforcement — the thing that was (incorrectly, in 7) slashing the endpoint
   routes. Recommend accepting `'ignore'`; the endpoint-restructure alternative
   buys no measurable SEO benefit here.

## Verification checklist (definition of done)

- [x] `astro build` in `apps/srd` completes (881 pages, no missing-module).
- [x] ITUN + component-lib + bot still build (regression check).
- [x] `bun run check:all` green; all workspace tests green.
- [x] `data/*.json` no longer needed at prerender time (inlined into the chunk).
- [x] Data endpoints emit at their fetched paths — `dist/schema/{id}.json` is a
      flat file matching the app's `fetch('/schema/{id}.json')` (no-slash) calls;
      HTML canonical/og/sitemap URLs unchanged (still trailing-slash).
- [x] CSS serialization spot-check — SU theme uses hex/oklch, not CSS named
      colors, so Astro 7's named-color→hex change is a no-op here.
- [x] `@vite-pwa/astro` 1.2.0 functions against Astro 7 (srd PWA emitted in
      the build; its stale `astro ^1–^5` peer is satisfied by a nested copy and
      is only a warning).
- [x] Dependabot `ignore` for `astro` / `@astrojs/*` majors removed.

## Sources

- [Astro 7.0 release](https://astro.build/blog/astro-7/)
- [Upgrade to Astro v7](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Vite Build Options — `ssrEmitAssets`](https://vite.dev/config/build-options)
