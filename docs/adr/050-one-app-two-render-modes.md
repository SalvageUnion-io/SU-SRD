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
   from importing `src/cantina` or `convex`.
2. **The Cantina is a client app at `/build/`.** One Vite pass
   (`vite.config.ts`) builds both apps into one `dist/`: srd's entries, and the
   Cantina's shell as `dist/build/index.html`, rendered at build time with the
   Union bar (`src/cantina/shell/shell.ts`). Their chunks share `dist/assets/`;
   no Cantina chunk group takes a module an srd page reaches
   (`ssg/appGraph.ts`). The public pages' shells and `/build/sitemap.xml` are
   pre-rendered with real titles.
3. **One Worker.** `su-srd` answers SRD misses and, through
   `run_worker_first` on `/build` and `/build/*`, everything under `/build`, setting the
   Cantina's CSP there. `su-cantina` is retired.
4. **One header, one manifest.** The Union bar is shared; one
   `site.webmanifest` (start URL `/build/`, scope `/`) installs both. Two service
   workers stay, scoped `/` and `/build/`, so an SRD reader never downloads
   the Cantina's precache; their shared precache rules are `src/pwa.ts`.
5. **Same-origin links.** srd links `/build/` relatively; the Cantina links
   the SRD at its own origin. `VITE_SITE_ORIGIN` names every absolute address.
6. **The UI library is `apps/web/src/ui`.** Biome keeps app state, the router,
   Convex, `idb` and SRD-only code out of it. `PRODUCT` moved to
   `cantina-domain/product`, which the bot and Convex share.

## Deviations from the plan

- The `/build/` shell is the Vite pass's own render, not an SRD SSG page.
- The plan kept two Vite builds; they are one pass, one config. The Vite pass
  runs in its own process (`ssg/bundle.ts`), because the shell needs
  production React and the SSR render after it runs development React.
- Coverage floors stay per folder: `apps/web (srd)` 99, `apps/web (cantina)` 97,
  `apps/web (ui)` 95.5 (`tools/run-coverage.ts`).

## Consequences

- One deploy leg and one Preview per PR; `deploy-surfaces.ts` maps every
  `apps/web` change onto the `srd` surface.
- One `bun run dev` serves both from one Vite server on the same config,
  beside a local Convex.
- Each app's service worker precaches only its own files: srd's drops what
  only the Cantina loads, and the Cantina's adds its chunks from `assets/`.
- Commit scopes `srd` and `cantina` stay, because `/changelog` sorts by them.
