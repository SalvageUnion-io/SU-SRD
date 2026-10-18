# ADR-050: One App

`apps/web` is one app. Its reference pages and the Cantina differ only in how
a page renders, never in how the app is built, served, installed or checked.

1. **Two render modes, one source tree.** `src/` holds one component library
   (`src/components`), one `lib/`, the static pages (`src/pages`, rendered by
   the SSG in `ssg/`) and the Cantina's routes (`src/routes`, rendered in the
   browser at `/build/`). The pages stay static islands under the 20 KB JS
   budget with no Convex: Biome bars `pages`, `endpoints`, `layouts`, `runtime`
   and the islands from importing the router, Convex, the stores or the shell.
2. **One build.** One Vite pass (`vite.config.ts`, run in its own process by
   `ssg/bundle.ts`) builds one `dist/` and prerenders the pages
   (`ssg/prerender.ts`). The Cantina's shell is `dist/build/index.html`; chunks
   share `dist/assets/`, and no Cantina chunk group takes a module a page
   reaches (`ssg/appGraph.ts`). One `bun run dev` serves it all.
3. **One document head.** Every page and the shell carry the same name, icons
   and theme colour (`src/lib/documentHead.ts`) and the same `AppBar`.
4. **One edge.** One Worker module (`src/worker/index.ts`) answers the
   reference's misses and, through `run_worker_first`, everything under
   `/build` (`src/worker/cantina.ts`). One CSP (`public/_headers`), one
   `/__errors`, one `/__convex-logs`, one 404, one sitemap index.
5. **One install.** One `site.webmanifest` (scope `/`) and one service worker
   at `/sw.js` (`src/pwa.ts`) precaching both render modes. While a builder tab
   is open a new worker waits for it; otherwise it takes over at once
   (`public/sw-lifecycle.js`).
6. **One set of checks.** One coverage floor, one e2e config, one CI job per
   kind, one deploy surface (`web`), one changelog stream (`feat(web):`).
