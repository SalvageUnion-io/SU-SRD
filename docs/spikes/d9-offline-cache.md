# D9 spike: drop ITUN's IndexedDB cache, service worker and Disconnected mode?

Status: **open, for the owner's decision.** A prototype, not a plan of record.
Refit ledger item D9. Measured 2026-10-12 against a local Convex backend.

## Question

Signed-out and offline are both read-only, so the device cache only buys
offline *viewing*, and Convex `useQuery` already caches in memory. Is that worth
about 7k lines, the service worker, an offline e2e and four dependencies?

## What the cache, SW and Disconnected mode buy today

| Behaviour | Who gets it | Depends on |
| --- | --- | --- |
| Sheet stays on screen, read-only, when the network drops mid-session | signed-in player | in-memory stores (**not** IndexedDB) |
| Reopen ITUN with no network and read your sheets | signed-in player, installed PWA | SW precache **and** IndexedDB **and** an offline auth session |
| Rows paint from the device before Convex answers | signed-in player, repeat visit | IndexedDB |
| App shell boots with no network | anyone | SW precache |
| Repeat visits skip the network for the shell and chunks | anyone | SW precache (HTTP cache does the same, below) |
| Installable PWA | anyone | manifest + SW |

## Measured

Local backend (`convex dev`, anonymous local deployment, `ITUN_TEST_AUTH`), a
`vite build` with `VITE_TEST_AUTH=true`, served from `dist` with production's
`/assets/*` immutable `Cache-Control`. Headless Chromium 1194. One account, one
pilot and one mech. Medians of 5. Script: `apps/itun/e2e/spike/d9-measure.ts`.

**Cold load** — navigate to the pilot's sheet URL, time until its name renders:

| | first visit | repeat visit |
| --- | --- | --- |
| Cache + SW (today) | 614 ms · 86 req · 2.56 MB over the wire | 575 ms · 85 req (83 via SW) · 1 KB |
| Flag on (no cache, no SW) | 601 ms · 85 req · 2.55 MB | 610 ms · 84 req (79 from HTTP cache) · 9 KB |

- Against a **localhost** backend the two are indistinguishable (run-to-run
  spread is ±40 ms). Real network latency to `convex.cloud` is **unmeasured**;
  without the cache, first paint of player rows waits for the socket, auth and
  `listMine` (roughly one round trip more than today). No "not found" flash was
  seen at localhost latency; under real latency it is unverified.
- With immutable `/assets/*` headers, the HTTP cache already makes repeat
  visits near-free without a worker (9 KB vs 1 KB over the wire).
- The first-visit bytes for today **exclude** the worker's own precache
  download (147 entries, 3.1 MiB uncompressed), which the page's network log
  does not see. Unmeasured over the wire.

**Offline** (`context.setOffline`):

| | network drops mid-session | reload while offline |
| --- | --- | --- |
| Cache + SW (today) | sheet stays, read-only banner | shell boots, but the app reads **signed out**: no pilot, "Sign in with Discord", still so after 35 s |
| Flag on | sheet stays, read-only banner | browser's "No internet" page |

The headline finding: **today's offline reload does not show cached rows.**
The Convex Auth tokens are still in `localStorage`, but offline the auth
handshake settles as not authenticated, so the mode is Solo and every store
reads empty (`readableRows`). The IndexedDB rows are never read. The one
offline behaviour the cache exists for does not happen in this build. It was
seen with the password test provider; Discord sign-in uses the same
`@convex-dev/auth` token path, but production was not tested. `offline.e2e.ts`
runs signed out, so nothing in the suite would catch this.

## Cost (measured on `design-refresh`, 2026-10-12)

| Area | source lines | test lines | goes with the cache? |
| --- | --- | --- | --- |
| `src/lib/db/` | 600 | 1,023 | all |
| `src/lib/sw/` | 456 | 619 | all |
| `src/lib/account/` | 76 | 71 | all |
| `src/lib/connection/` | 463 | 364 | partly (Disconnected; build floor stays) |
| `src/stores/` | 1,968 | 2,491 | partly (hydration, `adopt`/`forget`) |
| `ShelfSync.tsx`, `AccountReconciler.tsx` | 414 | — | reshaped, not deleted |
| `e2e/offline.e2e.ts` | 169 | — | all |

- Gross: ~3,980 source + ~4,570 test lines in those areas. What actually
  deletes is less: about 1.1k source and 1.9k test lines outright
  (`lib/db`, `lib/sw`, `lib/account`, the offline e2e), plus a share of the
  stores and connection code. The audit's "about 7k" counts whole areas.
- Dependencies (4): `idb`, `workbox-window`, `vite-plugin-pwa`, and the root
  devDependency `fake-indexeddb` (a test preload in `apps/itun/bunfig.toml`).
- Bundle: `idb` 3.4 KB min (1.4 KB gz), `workbox-window` 5.7 KB min (2.3 KB
  gz) in the app bundle; `sw.js` + workbox runtime 24 KB (8 KB gz) as separate
  files. ITUN's own cache and SW code in the bundle was not isolated.
- Rules carried by the cache, each with prose and tests: `DB_VERSION`
  upgrades, blocked-upgrade recovery, the cache-owner claim, prune guards,
  `registerType: 'prompt'`, soft update, chunk recovery against a stale
  precache.

## The prototype

Default off. `localStorage.setItem('itun:convex-direct', '1')` and reload, or
build with `VITE_ITUN_CONVEX_DIRECT=1` (`apps/itun/src/lib/spike/convexDirect.ts`).

- `getDb()` returns an empty in-memory database (`src/lib/db/memoryDb.ts`)
  instead of opening IndexedDB, so `makeHydratedCollection`, `entityStore` and
  `entityBackend` keep their call shapes but hold only what the Convex
  subscriptions (`listMine`, `listWiring`, via `ShelfSync`) delivered this load.
- `main.tsx` registers no service worker and unregisters an existing one.
- It does **not** rewrite the stores as `useQuery` selectors. A real removal
  would: the stores become a projection of the subscriptions, and `adopt`,
  `forget`, prune guards and version tracking go.

## Options

1. **Keep everything.** Pays the full cost for an offline reload that, as
   measured, shows nothing.
2. **Fix offline reload.** Treat stored-but-unverified tokens as "Disconnected"
   rather than Solo, then add a signed-in offline e2e. Makes the cache earn
   its keep; adds code to the most delicate path (auth settling).
3. **Drop IndexedDB and Disconnected-after-reload; keep the SW.** Shell still
   boots offline and the PWA still installs; an offline reload shows an empty
   signed-out app, which is today's behaviour anyway. Deletes `lib/db`,
   `lib/account`, `idb`, `fake-indexeddb` and the cache rules.
4. **Drop all three.** Also deletes `lib/sw`, `vite-plugin-pwa`,
   `workbox-window`, the offline e2e and the precache install. ITUN stops
   being installable; offline reload is the browser's error page.

## Recommendation

**Option 3, after one check on production.** The measured offline benefit of
the IndexedDB cache is zero today, and its rules are the most intricate in
ITUN. The worker is cheaper to keep and keeps the PWA installable; an offline
reload still boots the shell, empty, as it does today. Before deleting, reproduce the offline reload once against
production with a Discord session; if it does show cached rows there, the
finding is test-provider-specific and option 2 is the better fight.

## What the owner needs to decide

- Is reading sheets on a reload **with no network** a requirement? If yes:
  option 2. If no: option 3 or 4.
- Is an installable PWA a requirement? If no, option 4 over 3.
- Who checks the production offline reload (a Discord-signed-in session,
  DevTools offline, reload a sheet)?

## Reproduce

From `apps/itun`, with a local backend carrying `ITUN_TEST_AUTH`, `JWKS`,
`JWT_PRIVATE_KEY` and `SITE_URL` (the nightly `e2e-itun` job's provisioning
step): build with `VITE_CONVEX_URL=<backend> VITE_TEST_AUTH=true bunx vite build`,
serve `dist` on :4173 with SPA fallback and no CSP, then
`bunx playwright test -c e2e/spike/d9.config.ts` (set `D9_CHROMIUM` to a
Chromium binary if the pinned one is missing).
