# Upgrade Path: Astro 6 → 7 (suref-web)

**Status:** Deferred / not yet started. Held because it requires a non-trivial
change to the shared game-data ORM. Everything else in the frontend-tooling
bump (Vite 8, `@vitejs/plugin-react` 6) has already been adopted; this doc
covers the remaining, harder step.

Dependabot is configured to **ignore Astro / `@astrojs/*` major bumps** while
this is open (see `.github/dependabot.yml`) so it stops re-proposing a build it
cannot pass. Remove that ignore when this upgrade lands.

## Why it's deferred (the blocker)

`astro@7` hard-depends on `vite: ^8` and `esbuild: ^0.28` — there is no
Astro 7 + Vite 7 option, so this is all-or-nothing for `apps/suref-web`.

With Astro 7 + Vite 8, `astro build` fails during **static-route generation**:

```
Cannot find module '.../dist/.prerender/data/abilities.json'
  imported from '.../dist/.prerender/chunks/lib_*.mjs'
```

**Root cause.** The shared ORM loads its dataset with import-attribute dynamic
imports — ~30 loaders of the form:

```ts
// packages/salvageunion-reference/lib/ModelFactory.ts
import('../data/abilities.json', { with: { type: 'json' } })
```

Under Vite 8's rolldown-based SSR build (Astro's prerender **is** an SSR build),
rolldown preserves these as **literal Node runtime imports** in the prerender
chunk but does **not emit** the JSON asset next to them. Vite's documented SSR
behavior is that "static assets aren't emitted [in the SSR build] as it is
assumed they would be emitted as part of the client build" — and preserved
import-attribute JSON falls through that gap. Verified: the emitted
`dist/.prerender/chunks/*.mjs` contains
`import("../data/abilities.json", { with: { type: "json" } })` verbatim, and
`dist/.prerender/` has no `data/` directory.

`astro check` (typecheck) passes clean on Astro 7 — the break is purely the
runtime prerender emission, not types.

## Prerequisites (already done)

- **Vite 8 + `@vitejs/plugin-react` 6** adopted for ITUN + suref-react.
- **suref-web pinned to Vite 7** (`apps/suref-web/package.json`:
  `"@tailwindcss/vite": "4.3.1"`, `"vite": "^7.3.5"`). This pin exists **only**
  because the monorepo now also carries Vite 8: the root-hoisted
  `@tailwindcss/vite` would otherwise bind to Vite 8 and feed Astro 6's build a
  config shape rolldown rejects (`Missing field 'tsconfigPaths'`). **This pin is
  removed as step 2 of this upgrade** — once Astro is on 7/Vite 8 there is no
  Vite-7 island to preserve.

## The work (in order)

Vite 8, plugin-react 6, Astro 7, and `@astrojs/react` 6 must land **together in
one commit** — Astro 7 requires Vite 8, and any partial Vite-8 adoption breaks
Astro 6's suref-web build via the shared `@tailwindcss/vite` hoist.

1. **Make the ORM JSON loaders emit-safe under rolldown SSR (the hard blocker).**
   `packages/salvageunion-reference/lib/ModelFactory.ts` — the ~30
   `import('../data/*.json', { with: { type: 'json' } })` loaders must be made
   to work in Astro's SSR/prerender build. Options, roughly in order of
   preference:
   - **Spike Vite `build.ssrEmitAssets: true`** (or Astro's prerender asset
     handling) — the upstream lever for "emit assets in the SSR build too." It
     is _not confirmed_ to cover preserved import-attribute dynamic imports;
     this needs a proof-of-concept before committing to it.
   - **Rework the loaders to a bundler-friendly form** — e.g. `import.meta.glob`
     eager JSON, or drop the `with: { type: 'json' }` attribute so rolldown
     inlines the JSON rather than preserving the import. This is the reliable
     fallback but has the largest blast radius (see below).
   - **Blast radius of a loader change:** the `salvageunion-reference` package is
     consumed by **ITUN, suref-web, the Discord bot, and its own test suite**.
     Any change to the loader contract must be validated across all four
     consumers (Vite build, Astro build, `bun build` for the bot, and Bun test
     with its `fake-indexeddb`/preload setup). This is the reason the upgrade is
     deferred rather than done inline.

2. **Remove the suref-web Vite-7 pin** — delete `@tailwindcss/vite` + `vite`
   from `apps/suref-web/package.json` devDependencies so suref-web rides the
   monorepo Vite 8.

3. **Bump the Astro stack together:** `astro` → `^7.0.6`, `@astrojs/react` →
   `^6.0.1` (peers only on react/react-dom 19, already satisfied).
   `@astrojs/check` / `@astrojs/sitemap` needed no bump when last evaluated —
   re-verify.

4. **Verify the rolldown CSS serialization change.** Astro 7's Rust/rolldown CSS
   pipeline serializes named colors to hex (e.g. `rebeccapurple` → `#639`).
   Cosmetic, but visually diff suref-web's built CSS / a few rendered pages to
   confirm no regressions in the SU brand theme.

5. **Confirm `@vite-pwa/astro` against Astro 7.** It currently peers `astro
^1–^5` (already stale vs. Astro 6, satisfied by a nested copy). Confirm the
   PWA integration functions against Astro 7 or bump it.

## Verification checklist (definition of done)

- `bunx astro build` in `apps/suref-web` completes (881+ pages, static routes
  generated, no missing-module error).
- ITUN + suref-react still build (they're already on Vite 8 — regression check).
- `bun run check:all` green; `bun --filter suref-web test` and the suref-web
  e2e smoke suite (nightly) green.
- The `data/*.json` assets are present in `dist/.prerender/` (or the loaders no
  longer need them at prerender time).
- Suref-web deploy preview renders correctly (visual spot-check of the CSS
  serialization change).
- Remove the Dependabot `ignore` for `astro` / `@astrojs/*` majors.

## Notes

- **Bonus already banked:** the Vite 8 bump pulled `esbuild` to 0.28.1, clearing
  advisory GHSA-gv7w-rqvm-qjhr — the `--ignore` flag was dropped from the CI
  `audit` job. Astro 7 is not required for that.

## Sources

- [Astro 7.0 release](https://astro.build/blog/astro-7/)
- [Upgrade to Astro v7](https://v7.docs.astro.build/en/guides/upgrade-to/v7/)
- [Vite Build Options — `ssrEmitAssets`](https://vite.dev/config/build-options)
- [rolldown-vite SSR architecture](https://deepwiki.com/vitejs/rolldown-vite/6.1-ssr-architecture)
