# ADR-050: One App

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 50, which summarises it.

## Status

**Accepted; built.** Amends [ADR-011](../ARCHITECTURE.md#decisions) (the UI
library is a folder, not a package), [ADR-031](../ARCHITECTURE.md#decisions)
(the SSG's workspace is the whole app), [ADR-033](033-hosting-on-cloudflare.md),
[ADR-041](../ARCHITECTURE.md#decisions) (one changelog stream) and
[ADR-048](../ARCHITECTURE.md#decisions) (one Worker, `su-srd`, serves it all).

## Context

The SRD (`apps/srd`), the app (`apps/cantina`) and their shared components
(`packages/component-lib`) were three workspaces, two Workers, two output folders,
two headers and two install prompts for what readers meet as one site at
`salvageunion.io`. Every cross-cutting change (a header control, a token, the
manifest, a link between the two) crossed a package boundary and two deploys.

The owner's direction: one app, as if it were built from scratch with these
parts. Not two apps that happen to share a repo, and not separable.

## Decision

`apps/web` is one app. Its reference pages and the app differ only in how
a page renders, never in how the app is built, served, installed or checked.

1. **Two render modes, one source tree.** `src/` holds one component library
   (`src/components`), one `lib/`, the static pages (`src/reference/pages`, rendered by
   the in-house SSG in `ssg/`) and the app's routes (`src/routes`, rendered
   in the browser at `/build/`). The pages stay static islands under the 20 KB
   JS budget, with no Convex on them: Biome bars `pages`, `endpoints`,
   `layouts`, `runtime` and the islands from importing the router, Convex, the
   stores or the shell.
2. **One build.** One Vite pass (`vite.config.ts`) builds everything into one
   `dist/` and renders the pages inside the pass (`ssg/prerender.ts`). The
   app's shell is `dist/build/index.html`; their chunks share
   `dist/assets/`, and no app chunk group takes a module a page reaches
   (`ssg/appGraph.ts`). One `bun run dev` serves it all from one server on the
   same config.
3. **One document head.** Every page, the shell included, carries the same
   name, icons and theme colour (`src/lib/documentHead.ts`) and the same Union
   bar (`AppBar`).
4. **One edge.** One Worker module (`src/worker/index.ts`) answers the
   reference's misses and, through `run_worker_first`, everything under `/build`
   (`src/worker/app.ts`). One CSP (`public/_headers`), admitting Convex.
   One error endpoint (`/__errors`), one Convex log-stream path
   (`/__convex-logs`), one 404, one sitemap index.
5. **One install.** One `site.webmanifest` (id, scope and start URL `/`, named
   Salvage Union) and one service worker at `/sw.js` (`src/pwa.ts`), which
   precaches both render modes, so the installed app opens at `/` and reaches
   either half offline. While a builder tab is open a new worker waits for it;
   otherwise it takes over at once (`public/sw-lifecycle.js`). The builder's
   old worker at `/build/` retires itself (`public/build/sw.js`).
6. **One set of checks.** One coverage floor, one e2e config, one CI job per
   kind (`build-web`, `perf`, the nightly `e2e`, one `deploy` matrix), one deploy
   surface (`web`), one changelog stream (`feat(web):`).

## Deviations from the plan

- The `/build/` shell is the Vite pass's own render, not an SSG page: it shares
  the head and the Union bar with the pages, not `BaseLayout`.
- The Vite pass runs in its own process (`ssg/bundle.ts`), because the shell
  needs production React and the SSR render after it runs development React.
- One coverage floor for `apps/web`, 97.9, the measured combined total rounded
  down, in place of three per-folder floors (`tools/run-coverage.ts`); its three
  serial shards merge to the serial run's lcov exactly.

## Consequences

- One deploy leg and one Preview per PR.
- Every visitor's service worker downloads the builder (~1.2 MB gzipped) in
  the background after the page loads; page budgets are unchanged.
- The `srd`, `cantina` and `itun` commit scopes are history: `/changelog`
  still reads them, in the one stream.
- Not changed: the URLs under `/build/` and the reference's, the Worker's name
  (`su-srd`, a Cloudflare step), the package names `salvageunion-reference`
  and `game-domain`, which the bot shares, and the game data.
