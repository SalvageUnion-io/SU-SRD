# ADR-050: One App, Two Render Modes

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 50, which summarises it.

## Status

**Accepted; built.** Amends [ADR-011](../ARCHITECTURE.md#decisions) (the UI
library is a folder, not a package), [ADR-031](../ARCHITECTURE.md#decisions)
(the SSG's workspace also holds the Cantina), [ADR-033](033-hosting-on-cloudflare.md)
and [ADR-048](../ARCHITECTURE.md#decisions) (one Worker, `su-srd`, serves both).

## Context

The SRD (`apps/srd`), the Cantina (`apps/cantina`) and their shared components
(`packages/component-lib`) were three workspaces, two Workers, two output folders,
two headers and two install prompts for what readers meet as one site at
`salvageunion.io`. Every cross-cutting change (a header control, a token, the
manifest, a link between the two) crossed a package boundary and two deploys.

## Decision

One workspace, `apps/web`, holds both apps, in two render modes:

1. **The SRD is pre-rendered.** Its pages stay static islands from the in-house
   SSG, under the 20 KB JS budget, with no Convex on the page and a CSP without
   Convex origins. Biome bars SRD `pages`, `endpoints`, `runtime` and islands
   from importing the Cantina's routes, stores and shell, or `convex`.
2. **The Cantina is a client app at `/build/`.** One Vite pass
   (`vite.config.ts`) builds both apps into one `dist/`: srd's entries, and the
   Cantina's shell as `dist/build/index.html`, rendered at build time with the
   Union bar (`src/shell/shell.ts`). Their chunks share `dist/assets/`;
   no Cantina chunk group takes a module an srd page reaches
   (`ssg/appGraph.ts`). The public pages' shells and `/build/sitemap.xml` are
   pre-rendered with real titles.
3. **One Worker.** `su-srd` answers SRD misses and, through
   `run_worker_first` on `/build` and `/build/*`, everything under `/build`, setting the
   Cantina's CSP there. `su-cantina` is retired.
4. **One header, one install, one service worker.** The Union bar is shared.
   One `site.webmanifest` (id, scope and start URL `/`, named Salvage Union)
   installs the whole site, and one worker at `/sw.js` precaches both render
   modes, so an installed app opens at `/` and reaches either half offline
   (`src/pwa.ts`). While a builder tab is open a new worker waits for it;
   otherwise it takes over at once (`public/sw-lifecycle.js`). The builder's
   old worker at `/build/` retires itself (`public/build/sw.js`).
5. **Same-origin links.** srd links `/build/` relatively; the Cantina links
   the SRD at its own origin. `VITE_SITE_ORIGIN` names every absolute address.
6. **The UI library is `apps/web/src/components`.** Biome keeps app state, the router,
   Convex, `idb` and SRD-only code out of it. `PRODUCT` moved to
   `cantina-domain/product`, which the bot and Convex share.

## Deviations from the plan

- The `/build/` shell is the Vite pass's own render, not an SRD SSG page.
- The plan kept two Vite builds; they are one pass, one config. The Vite pass
  runs in its own process (`ssg/bundle.ts`), because the shell needs
  production React and the SSR render after it runs development React.
- One coverage floor for `apps/web`, 97.9, the measured combined total rounded
  down, in place of three per-folder floors (`tools/run-coverage.ts`); its three
  serial shards merge to the serial run's lcov exactly.

## Consequences

- One deploy leg and one Preview per PR; `deploy-surfaces.ts` maps every
  `apps/web` change onto the `srd` surface.
- One `bun run dev` serves both from one Vite server on the same config,
  beside a local Convex.
- The Vite pass renders the pages itself (`ssg/prerender.ts`, a `closeBundle`
  step) before the worker is generated, so the precache sees the home page.
- Every visitor's worker downloads the builder (~1.2 MB gzipped) in the
  background after the page loads; page budgets are unchanged.
- Commit scopes `srd` and `cantina` stay, because `/changelog` sorts by them.
