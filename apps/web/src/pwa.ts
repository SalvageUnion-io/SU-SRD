/**
 * pwa — the site's one installable app and its one service worker.
 *
 * salvageunion.io installs as one app, from one manifest
 * (`public/site.webmanifest`: id, scope and start URL `/`), and one worker at
 * `/sw.js` serves all of it: the reference's pages and the builder under
 * `/build/`. `vite.config.ts` hands `WORKBOX_OPTIONS` to `VitePWA`; they live
 * here so `__tests__/pwa.test.ts` can assert the real values.
 *
 * ## What it precaches: both halves, so either opens offline
 *
 * Every chunk, stylesheet and font the build emits, the icons, the home page
 * and the builder's shell. An installed app that opens at `/` can switch to the
 * builder offline and back. HTML pages are NOT precached (about a thousand would
 * be a multi-megabyte install): visited pages land in `pages`, and an installed
 * app fills it with every page once per deploy
 * (`src/runtime/offlineWarm.client.ts`).
 *
 * ## Navigations: the network first, always
 *
 * Neither half boots the build a returning visitor last saw:
 *
 * - **The app (`/build/…` and `/play/…`)** is a single-page app: the network's shell, or
 *   the precached `build/index.html` when the network fails. No copy of the
 *   shell is kept in a runtime cache, because one saved from the network can
 *   name a NEWER or an OLDER build's chunks than the precache holds; the
 *   precached shell is the only one guaranteed to match it. No timeout either:
 *   workbox's `networkTimeoutSeconds` reads its own runtime cache, never the
 *   precache.
 * - **Every other page** is pre-rendered: the network, or the `pages` copy
 *   when the network fails or is slower than `NAVIGATION_TIMEOUT_SECONDS`.
 *   `/` falls back to the precached home page, so the installed app always
 *   opens. An unvisited page 404s offline rather than resolve to a stale one.
 *
 * `directoryIndex: null` is load-bearing: `precacheAndRoute` registers BEFORE
 * any runtime rule and by default maps a URL ending in `/` onto its
 * `index.html`, which would answer `/` and `/build/` from the precache and
 * never reach the rules below.
 *
 * ## Updates: wait while the builder is open, take over otherwise
 *
 * `registerType: 'prompt'` in `vite.config.ts`: the plugin then leaves
 * `skipWaiting` and `clientsClaim` off, and `public/sw-lifecycle.js` decides
 * at install time. A builder tab is a long session, and activating drops every
 * precache entry the new build does not list, the chunks it is still reading
 * from; so while one is open the new worker waits for that tab to move onto
 * the new build at its next page change (`src/lib/sw/softUpdate.ts`).
 * With none open it takes over at once, which keeps the precache on the build
 * the reference's pages are on: each of those is a full document load, and a
 * failed chunk reloads it once (`installChunkRecovery`).
 *
 * ## Deliberate non-defaults
 *
 * - `globIgnores` drops the `latin-ext` and `vietnamese` font subsets
 *   (`UNFETCHED_FONT_SUBSETS`), the list projection of `actions` that nothing
 *   loads, the builder's pre-rendered Starter Set pages (the shell with other
 *   words for crawlers; offline, the shell answers them), and the retired
 *   builder worker.
 * - `sourcemap: false`: the plugin otherwise follows `build.sourcemap`.
 * - `cleanupOutdatedCaches: true` deletes precaches left by OLDER WORKBOX
 *   VERSIONS on activate; this build's precache and `pages` are untouched.
 */

import type { VitePWAOptions } from 'vite-plugin-pwa'
import { APP_BASE } from './lib/appBase'

/** The one web manifest, at the site's root; every page links it. */
export const SITE_MANIFEST = '/site.webmanifest'

/**
 * The one service worker: where it is served and what it controls, the whole
 * origin. `vite.config.ts` builds it here, so the app's
 * `virtual:pwa-register` registers it here, and the reference pages'
 * `registerSiteWorker` (`lib/sw/siteWorker.ts`) does the same.
 */
export const SITE_WORKER = { url: '/sw.js', scope: '/' } as const

/**
 * The font subsets left out of the precache. Each `@fontsource` face ships
 * `latin`, `latin-ext` and `vietnamese` subsets split by `unicode-range`, and
 * the browser fetches a subset only when the page draws a glyph in its range;
 * nothing the site ships does, so precaching the last two cost every first
 * visit about 157 KB of fonts it never loads. Their `@font-face` rules stay,
 * so a name typed with, say, a Polish letter still fetches its subset online.
 * Vite keeps the file name ahead of its hash
 * (`barlow-latin-ext-400-normal-<hash>.woff2`).
 */
export const UNFETCHED_FONT_SUBSETS = '**/*-{latin-ext,vietnamese}-*.woff2'

/**
 * The runtime cache visited pages land in, and the one the installed app's
 * warm writes into (`src/runtime/offlineWarm.client.ts`).
 */
export const PAGES_CACHE = 'pages'

/**
 * How long a page navigation waits for the network before a cached copy
 * answers. Long enough that a working connection always wins (Cloudflare
 * answers a static page in well under a second), short enough that bad table
 * wifi does not hold the reader on a blank screen.
 */
export const NAVIGATION_TIMEOUT_SECONDS = 3

/** The precached pages navigations fall back to. */
const HOME = 'index.html'

/** The app's base as `dist` spells it, without the leading slash. */
const APP_DIR = APP_BASE.slice(1)
const BUILDER_SHELL = `${APP_DIR}/index.html`

/**
 * The runtime rules, in match order. Each `urlPattern` is stringified into
 * `sw.js` by workbox-build, so it must not reference anything outside its own
 * parameters.
 */
export const RUNTIME_CACHING = [
  {
    // The app, Build and Play: the network's shell, else the precached one.
    // Literal `APP_BASE` and `PLAY_ROOT`: workbox-build stringifies the
    // function on its own.
    urlPattern: ({ request, url }: { request: Request; url: URL }) =>
      request.mode === 'navigate' && /^\/(build|play)(\/|$)/.test(url.pathname),
    handler: 'NetworkOnly' as const,
    options: { precacheFallback: { fallbackURL: BUILDER_SHELL } },
  },
  {
    // The home page, where the installed app opens: as every page, plus the
    // precached copy when neither the network nor `pages` has one.
    urlPattern: ({ request, url }: { request: Request; url: URL }) =>
      request.mode === 'navigate' && url.pathname === '/',
    handler: 'NetworkFirst' as const,
    options: {
      cacheName: PAGES_CACHE,
      networkTimeoutSeconds: NAVIGATION_TIMEOUT_SECONDS,
      precacheFallback: { fallbackURL: HOME },
    },
  },
  {
    // Every other page: visited pages stay readable offline (table use on
    // bad wifi), answered from `pages` only when the network will not.
    urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
    handler: 'NetworkFirst' as const,
    options: { cacheName: PAGES_CACHE, networkTimeoutSeconds: NAVIGATION_TIMEOUT_SECONDS },
  },
  {
    urlPattern: /\/schema\/.*\.json$/,
    handler: 'StaleWhileRevalidate' as const,
    options: { cacheName: 'data' },
  },
  {
    // The search index: 493 KB, fetched on first search interaction. One
    // deploy stale is fine for a search index.
    urlPattern: /\/search-index\.json$/,
    handler: 'StaleWhileRevalidate' as const,
    options: { cacheName: 'data' },
  },
]

/** What `vite.config.ts` hands `VitePWA({ workbox })`. */
export const WORKBOX_OPTIONS = {
  mode: 'production',
  sourcemap: false,
  cleanupOutdatedCaches: true,
  globPatterns: [
    '**/*.{js,css,woff2,svg,ico}',
    'Powered_by_Salvage_Black.webp',
    'web-app-manifest-*.png',
    HOME,
    BUILDER_SHELL,
  ],
  globIgnores: [
    // workbox-build's default, which setting `globIgnores` replaces.
    '**/node_modules/**/*',
    UNFETCHED_FONT_SUBSETS,
    '**/actions.list.generated-*.js',
    `${APP_DIR}/starter.html`,
    `${APP_DIR}/starter/**`,
    `${APP_DIR}/sw.js`,
    'sw-lifecycle.js',
  ],
  // Waits while a builder tab is open, takes over otherwise (see the header).
  importScripts: ['/sw-lifecycle.js'],
  navigateFallback: null,
  directoryIndex: null,
  runtimeCaching: RUNTIME_CACHING,
} satisfies VitePWAOptions['workbox']
