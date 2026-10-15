/**
 * pwa — what the site's two service workers share. salvageunion.io installs as
 * ONE app, from one manifest (`public/site.webmanifest`: scope `/`, start URL
 * `/build/`), but keeps two workers, by design:
 *
 * - **srd's, at `/`** (`ssg/pwa.ts`): the reference's islands, styles and
 *   fonts, and visited pages for offline reading. It never precaches the
 *   Cantina, so an SRD reader never downloads the Cantina's precache.
 * - **the Cantina's, at `/build/`** (`src/cantina/lib/sw/workbox.ts`): the
 *   app shell and its chunks, with network-first navigations under `prompt`.
 *   The narrower scope wins every page under `/build/`.
 *
 * Their options stay two, because the two apps need opposite update
 * strategies (each file's header says why). What both must agree on is here,
 * for both Vite configs to read.
 */

/** The one web manifest, at the site's root; both apps' pages link it. */
export const SITE_MANIFEST = '/site.webmanifest'

/**
 * The font subsets left out of both precaches. Each `@fontsource` face ships
 * `latin`, `latin-ext` and `vietnamese` subsets split by `unicode-range`, and
 * the browser fetches a subset only when the page draws a glyph in its range;
 * nothing either app ships does, so precaching the last two cost every first
 * visit about 157 KB of fonts it never loads. Their `@font-face` rules stay,
 * so a name typed with, say, a Polish letter still fetches its subset online.
 * Vite keeps the file name ahead of its hash
 * (`barlow-latin-ext-400-normal-<hash>.woff2`).
 */
export const UNFETCHED_FONT_SUBSETS = '**/*-{latin-ext,vietnamese}-*.woff2'

/**
 * The ignores both precaches start from. The first is workbox-build's
 * default, which setting `globIgnores` replaces.
 */
export const PRECACHE_IGNORES = ['**/node_modules/**/*', UNFETCHED_FONT_SUBSETS]
