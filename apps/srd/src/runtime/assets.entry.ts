/**
 * assets.entry — the ONLY module in the app that imports a static asset from
 * `src/assets/`.
 *
 * Astro had `astro:assets`, which both emitted the file and handed the page its
 * hashed URL. The in-house SSG splits those two halves, because the SSR pass
 * runs under Bun and never goes through Vite:
 *
 *   1. **Emit** — this file. It is a client-bundle entry (see
 *      `ssg/vite.config.ts`), so importing an asset here makes Vite copy it into
 *      `dist/assets/` with a content hash and record it in
 *      `dist/.vite/manifest.json` under its source path.
 *   2. **Address** — `ssg/build.ts` reads those manifest entries into
 *      `BuiltAssets` and threads them to every page through
 *      `RouteContext.builtAssets`; the page looks the URL up with
 *      `builtAssetUrl()` from `src/lib/builtAssets.ts`. A page must never import
 *      the asset directly: under Bun that import resolves to a filesystem path,
 *      not to the hashed URL the browser needs.
 *
 * The imports are re-exported because Rollup drops an unused import of a module
 * with no side effects — and with it the emitted file. An entry's exports are
 * always preserved, so this array is what keeps the asset in the build.
 *
 * Like `styles.entry.ts`, this entry's JS chunk is deliberately never linked
 * into a page: it exists to pull non-JS resources through Vite and nothing else.
 * Add an asset by importing it here AND adding its key to `src/lib/builtAssets.ts`.
 */

import eldridgeCoastMap from '../assets/eldridge-coast-map.webp'

/** Keeps every import above alive through tree-shaking. Not read at runtime. */
export const emittedAssets = [eldridgeCoastMap]
