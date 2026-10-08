/**
 * The service worker's workbox options — what `vite.config.ts` hands
 * `VitePWA({ workbox })`. They live here rather than inline in the config so
 * `__tests__/workbox.test.ts` can assert the real values instead of grepping
 * the config's source text.
 *
 * ## Navigations go to the network first
 *
 * This used to be workbox's default for a SPA: a `NavigationRoute` bound to the
 * precached `index.html`, so EVERY navigation was answered from Cache Storage.
 * Combined with `registerType: 'prompt'` (see `vite.config.ts` — it must stay),
 * that meant a returning visitor always booted the build they had last seen,
 * and only reached the current one by accepting the update toast or closing
 * every tab. An installed PWA that is never closed could sit on an old build
 * indefinitely.
 *
 * Now a navigation is fetched from the network, and the precached shell is the
 * fallback when the network fails:
 *
 * - **Online:** the Worker's current shell, so every page load boots the build
 *   that is deployed. Its hashed chunks resolve even while an older worker is
 *   still in control: a chunk the old precache does not list matches no route
 *   here, so it goes to the network, where the Worker serves it as a real file
 *   (its `/assets/*` 404 rule only answers files that do not exist). Chunks a
 *   deploy did not change keep their URL and are still served from the precache.
 * - **Offline:** the precached `index.html`, which is the only shell guaranteed
 *   to name exactly the chunks the active worker precached. That is also why
 *   no shell is kept in a runtime cache: a copy saved from the network can be a
 *   NEWER build than the active worker (one is waiting behind the prompt) or an
 *   OLDER one (the worker updated after the copy was taken), and either way it
 *   names chunks the precache does not hold.
 *
 * ### Why there is no network timeout
 *
 * A short timeout falling back to the precached shell would help on a network
 * that connects but never answers. workbox cannot express it in `generateSW`
 * config: `networkTimeoutSeconds` is rejected on anything but `NetworkFirst`
 * (workbox-build's runtime-caching converter throws), and `NetworkFirst`'s
 * timeout reads its OWN runtime cache — the per-URL shell copy rejected above —
 * never the precache. So a hanging network waits for the browser to give up,
 * then gets the precached shell. The document itself is ~2 KB.
 *
 * ### `directoryIndex: null` is load-bearing
 *
 * `precacheAndRoute` registers its route BEFORE any runtime rule, and by
 * default it maps a URL ending in `/` onto `index.html`. Left alone, a
 * navigation to `/` — the PWA's `start_url`, and the most common entry point —
 * would still be answered from the precache and never reach the rule below.
 */

import type { VitePWAOptions } from 'vite-plugin-pwa'

/** The precached app shell: the offline answer to every navigation. */
const SHELL = 'index.html'

export const WORKBOX_OPTIONS = {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  // Replaces a worker from before network-first navigations at once and
  // reloads its tabs, which `prompt` would otherwise leave on the old build
  // indefinitely. See the header of public/sw-takeover.js.
  importScripts: ['sw-takeover.js'],
  // No precache-bound NavigationRoute. Navigations are the runtime rule below.
  navigateFallback: null,
  directoryIndex: null,
  runtimeCaching: [
    {
      // Stringified into `sw.js` by workbox-build, so it must not reference
      // anything outside its own parameters.
      urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
      // NetworkOnly + a precache fallback, not NetworkFirst: see the header for
      // why no network copy of the shell is ever stored.
      handler: 'NetworkOnly',
      options: { precacheFallback: { fallbackURL: SHELL } },
    },
  ],
} satisfies VitePWAOptions['workbox']
