# Spike S2: one product at salvageunion.io/build

Refit ledger item S2, spike. **Status: proposed, awaiting the owner.** The
owner's direction: "lets merge the sites, but not the code.
salvageunion.io/build". ITUN stays its own app, Worker, workspace, Sentry
project and deploy leg; the two sites become one product at one domain.

**Recommendation: a Workers route `salvageunion.io/build*` on `su-itun`
(option A), ITUN built under the base `/build/`, intheunionnow.com
redirected by a zone Redirect Rule. Record it as ADR-048 (below).**

## The finding

Ruleset §3.11 already says "one union, two tools: one Union bar; the switcher
reads Reference | Build". Users still meet two domains, two bar heights
(srd 64 + 3px, ITUN 48 + 3px), two footers (srd's licence band; ITUN's
hairline About · Changelog row) and two search entries (srd's field, ITUN's
outline "Search · ⌘K" button). ITUN's search already covers SRD content.

## What this PR does

Nothing here changes production: no route, workflow, DNS or env var changes
on merge. What a deploy of this PR's `main` would change is listed under
[On deploy](#on-deploy).

### 1. Routing prototype, behind `ITUN_SITE`

| Piece | File | Unset (today) | `ITUN_SITE=one-domain` |
| --- | --- | --- | --- |
| Site config | `apps/itun/src/lib/site.ts` | intheunionnow.com, base `/` | salvageunion.io, base `/build/` |
| Vite `base`, output | `apps/itun/vite.config.ts` | `dist/` | `dist/build/`; `_headers` and an `index.html` copy moved to `dist/` (`siteLayout`) |
| `_headers` | `headersForBase` | as is | `/assets/*` → `/build/assets/*` |
| og:url, og:image | `shellForSite` | intheunionnow.com | `https://salvageunion.io/build/…` |
| Router | `main.tsx` | `basepath: '/'` | `basepath: '/build'` |
| Manifest | vite-plugin-pwa default | scope, start_url `/` | `/build/` |
| Service worker | `vite.config.ts`, `sw/register.ts` | `/sw.js`, probe `/?sw-shell-probe` | `/build/sw.js` (scope `/build/`), probe `/build/?sw-shell-probe` |
| Share links | `lib/appUrl.ts` | origin + path | origin + `/build` + path (public sheet, invites, pattern address) |
| Worker | `src/worker/basePath.ts`, `index.ts`, `retiredRedirects.ts`, `linkPreview.ts` | `BASE_PATH` unset | strips `/build`, restores it on 301s, the shell fetch, og URLs and screenshots |
| Wrangler | `wrangler.jsonc` `env.one-domain` | not deployed | `name: su-itun`, route `salvageunion.io/build*`, `BASE_PATH=/build`, `run_worker_first` under `/build` |
| srd SW | `apps/srd/ssg/pwa.ts` | — | srd's worker (scope `/`) no longer answers `/build` navigations (inert today: srd has no `/build` page) |

Verified: `ITUN_SITE=one-domain vite build`, then `wrangler dev --env
one-domain`. `/build/`, `/build/sheet/pilot/x`, `/build/p/mech/x` → 200 shell;
`/build/join/ABCD1234?ref=dm` → 301 `/build/invite/ABCD1234?ref=dm`;
`/build/games` → 301 `/build/`; `/build/assets/<hash>.js` carries `immutable`
and ITUN's CSP; the manifest's scope is `/build/`. The chunk-404 rule cannot be
checked with curl under `wrangler dev`, which treats every request as a
navigation (today's root config too); `oneDomain.test.ts` pins it. The
default build was rebuilt and checked: `_headers` byte-equal to `public/_headers`,
`og:url` on intheunionnow.com, manifest scope `/`.

Routing is router-relative everywhere else: route paths, `AppLink`, Convex
Auth's `redirectTo` (`useLocation().href` excludes the basepath) and the soft
update's `history.block` location (which includes it) need no change.

### 2. Chrome

- **One Union bar** (`AppBar`): the `full`/`compact` densities are gone. One
  56px row at every width, the 40px mark (32px under 25rem, where ITUN's
  three-control phone row must fit 360px), the wordmark from 40rem, product
  nav inline from `lg`. The unused 44px paper product row is gone.
- **One search entry**: srd keeps its `SearchField` combobox; ITUN's trigger
  is `SearchFieldTrigger`, the same paper field drawn as a button. Both read
  "Search the SRD" with the key cap, 14rem wide (`su-union-bar__search-input`).
- **One Footer**: srd's footer moved to component-lib as `Footer` (links,
  mark, `LinkComponent` as props; `su-footer*` classes). ITUN's `SiteFooter`
  renders it, with the licence's required legal text, on its existing
  visibility rule (signed-out desktop).

| Shot | Before | After |
| --- | --- | --- |
| srd, page | 64px bar | 56px bar; same footer |
| srd, phone | 56px bar | 56px bar |
| ITUN, page | 48px bar, mark only, outline "Search" button | 56px bar, mark + wordmark, the SRD's search field |
| ITUN, phone | 48px bar, 32px mark | 56px bar, 40px mark |
| ITUN footer | hairline About · Changelog | rules-blue band, licence text, mark |

Cost: ITUN's sheets and Games give 8px of height back to the bar.

## Routing options

Facts (Cloudflare docs, 2026-10; O3 fact 7): a Workers **route** runs before a
**Custom Domain** Worker on the same hostname; Static Assets answers by path
before a script runs; `single-page-application` answers a navigation miss with
the root `/index.html`; a script invocation counts against the shared 100k/day
Free quota, a static hit does not.

### A. A Workers route on `su-itun` (recommended)

`salvageunion.io/build*` → `su-itun`, ahead of `su-srd`'s Custom Domain.

- `/build/*` never reaches srd's assets or script. ITUN's own `_headers` (CSP,
  `immutable`), Sentry project and deploy leg stay its own.
- Quota: unchanged. ITUN's static hits stay free; its script still runs only
  for non-navigation misses and the retired addresses.
- Needs the base-path build above, and a route, which the CI token cannot
  create today (below).

### B. A service binding from `su-srd`

`su-srd` gets `run_worker_first: ['/build/*']` and forwards to `su-itun`.

- Every ITUN request (every chunk, every navigation) becomes an `su-srd`
  invocation: quota cost on all ITUN traffic, and srd's script is ITUN's front
  door (an srd deploy can break ITUN).
- Responses built by srd's script lose `_headers`, so ITUN's CSP moves into code.
- Only gain: no zone route. **Not recommended.**

### C. The O3 edge planner (`planEdgeRequest`)

O3/ADR-047 made `su-srd` host-aware for `api.`; extending it to a `/build`
path is option B with extra steps: same `run_worker_first` cost, plus ITUN's
`dist/` folded into srd's. It also merges the code, which the owner ruled out.
**Not recommended.** ADR-047 is unaffected by A.

## intheunionnow.com

One **Redirect Rule** on the `intheunionnow.com` zone, which runs before any
Worker and costs no quota:

| When | Then |
| --- | --- |
| hostname in {`intheunionnow.com`, `www.intheunionnow.com`} | 301, dynamic: `concat("https://salvageunion.io/build", http.request.uri.path)`, **preserve query string** |

It replaces ADR-033's www rule on that zone. The custom domains stay attached
to `su-itun` (the `one-domain` env keeps them) so the DNS records stay proxied.

- **D6's 301s keep working, in two hops**: `intheunionnow.com/join/X` →
  `salvageunion.io/build/join/X` → `/build/invite/X`. The Worker's retired
  rules run under `/build` (`patternsUnder('/build')`).
- **Old shared links** (`/p/…`, `/invite/…`, `/sheet/…`) land on the same
  route under `/build`; link previews unfurl from the redirect target.
- Keep the rule (and the zone, and its renewal) for as long as old links
  matter: years. `docs/ops/domain-transfer.md` owns the registration.

## Auth

Convex Auth with Discord, terminating on Convex (ADR-030, ADR-033 §Follow-up).

- **The Discord OAuth callback does not change.** Discord redirects to the
  Convex `.site` URL (`/api/auth/callback/discord`), not to the frontend.
- **`SITE_URL` changes** on the production Convex deployment, from
  `https://intheunionnow.com` to `https://salvageunion.io/build`. Convex Auth
  appends a relative `redirectTo` to it and accepts an absolute one only under
  it; every ITUN caller passes a router-relative path, so `/build` is never
  doubled.
- **No cookies.** The React client keeps its JWT, refresh token and OAuth
  verifier in `localStorage` (`__convexAuthJWT`, …), per origin. There is no
  cookie domain or path to set.
- **Everyone is signed out once.** `localStorage` does not cross origins, so
  the first visit to salvageunion.io/build starts signed out. Player data is
  safe (Convex is the server of record, ADR-034: nothing player-owned lives on
  the device); signing in again is one Discord click. Say so in the changelog.
- **Shared origin, shared storage.** srd's scripts can read ITUN's
  `localStorage`, tokens included. srd ships no third-party script but Ko-fi's
  (in both CSPs already) and runs no user content, so the exposure is what
  ITUN's own origin has today; any new third-party script on srd is now a
  question for ITUN's tokens too.
- **The account gate** (ADR-034) is unchanged: it reads the session, not the
  host.

## CSP and Sentry

`packages/observability/CLAUDE.md`: change every source for an app together.
Each Worker still serves its own `_headers`, so **each app keeps its own CSP
on its own paths**; nothing is merged.

- ITUN: `public/_headers` is unchanged; one-domain moves it to `dist/` with
  `/assets/*` scoped to `/build`. `connect-src` already lists Sentry's EU
  ingest and Convex; `'self'` now means salvageunion.io, which is right.
- srd: unchanged.
- Sentry: two browser projects as today (`srd`, `itun`), same EU region, same
  DSNs. If the `itun` project has an **Allowed Domains** list, add
  `salvageunion.io`. Workers stay `su-srd` and `su-itun`.
- `tools/check-observability.ts` reads `apps/itun/public/_headers`, which
  stays the source. The smoke list's itun lines move to
  `https://salvageunion.io/build/…` in the flip PR.

## SEO

- **Canonicals**: srd's are unchanged. ITUN's shell deliberately has none; keep
  it so (one canonical in a SPA shell claims every route is the home page).
- **og:url / og:image**: the shell's defaults point at
  `https://salvageunion.io/build/` (`shellForSite`); link previews use the
  request's origin and base.
- **robots.txt**: `/robots.txt` on salvageunion.io is srd's (`Allow: /`), so
  `/build/*` is crawlable, as intheunionnow.com is today. ITUN's
  `public/robots.txt` would be served at `/build/robots.txt`, which nothing
  reads; delete it in the flip PR.
- **Sitemaps**: srd's stay srd's. ITUN has none and needs none (its pages are
  per-player).
- **The 301s** carry intheunionnow.com's link equity to the new URLs.

## PWA, install and offline

- ITUN's manifest scope and `start_url` become `/build/`; srd's stay `/`. Two
  installable apps on one origin, each scoped; Chrome installs both.
- ITUN's worker registers at `/build/sw.js` with scope `/build/`. srd's worker
  (scope `/`) would also match `/build/*`; the carve-out in `pwa.ts` keeps it
  off ITUN's navigations, so ITUN's own network-first shell rule decides.
  The more specific scope controls a page once both are registered.
- **The offline shell** is ITUN's precached `index.html` under `/build/`, as
  today. Offline navigation to an SRD page uses srd's `pages` cache.
- **An installed intheunionnow.com PWA** keeps opening intheunionnow.com: the
  redirect sends it to salvageunion.io/build in the browser, outside the app
  window. Players reinstall from the new address; say so in the changelog.

## The bot's links

`apps/discord-bot/src/gameCards.ts` `ITUN_ORIGIN = 'https://intheunionnow.com'`
becomes `'https://salvageunion.io/build'`; the builders only append paths and
strip a trailing slash, so nothing else moves. Until it does, the zone redirect
keeps every bot link working. srd's `ITUN_URL` (`apps/srd/src/lib/constants.ts`)
becomes `/build/` (same origin, so the switcher's Build tab is a plain path),
and `SRD_SITE_URL` stays as is. `buildLink.ts` already anticipates it.

## On deploy

Merging this PR, as is, changes on the next deploy:

- **Both sites**: the Union bar's height (srd 64 → 56px on desktop; ITUN 48 →
  56px), ITUN's wordmark and search field, ITUN's footer band.
- **srd's service worker**: one new condition on its navigation rule (no
  `/build` page exists, so no behaviour change).
- **Nothing else**: same routes, same domains, same ITUN base, same `dist/`
  layout. The `one-domain` wrangler environment is deployed by nothing.

## Owner steps, in order

1. **Decide**: A (recommended), and whether the account sign-out once and the
   PWA reinstall are acceptable.
2. **Cloudflare API token**: add **Zone → Workers Routes: Edit** on the
   `salvageunion.io` zone to the `production` Environment's token, or create
   the route by hand in the dashboard (Workers → `su-itun` → Domains & Routes
   → Add route `salvageunion.io/build*`). wrangler cannot create a zone route
   with the token as scoped today (ADR-033 §Credentials).
3. **Land the flip PR** (an agent can write it): `deploy-cloudflare.yml`
   builds itun with `ITUN_SITE=one-domain` and deploys it with `bun run deploy
   -- --env one-domain`; the smoke list moves to `/build`; the bot's
   `ITUN_ORIGIN` and srd's `ITUN_URL` change; ITUN's `robots.txt` goes.
   Deploy order inside it: ITUN first (the route goes live with it), then srd
   and the bot.
4. **Convex**: `npx convex env set SITE_URL https://salvageunion.io/build
   --prod` (the convex-ops skill), right after the flip deploy. Between the two,
   sign-in on intheunionnow.com would land on the old host.
5. **Redirect Rule** on the `intheunionnow.com` zone (table above); remove the
   old www rule there. Tick **Preserve query string**.
6. **Sentry**: add `salvageunion.io` to the `itun` project's Allowed Domains,
   if set.
7. **Check**: `https://salvageunion.io/build/` 200, `https://intheunionnow.com/p/pilot/x`
   301 → `/build/p/pilot/x`, sign-in round trip, a copied invite link, the
   bot's `/game` link, `https://salvageunion.io/build/assets/index-DEADBEEF.js`
   404, srd's home still srd's. Watch `su-srd` and `su-itun` request counts for
   a day.
8. **Changelog**: one entry saying sign in again and reinstall the app.

DNS: no new records. `salvageunion.io` and `intheunionnow.com` are already
proxied custom domains.

## Rollback

Delete the route `salvageunion.io/build*` and the Redirect Rule, redeploy itun
without `--env one-domain` and with `ITUN_SITE` unset, and set `SITE_URL` back.
intheunionnow.com serves again at once; sessions made on salvageunion.io are
lost (the second sign-out).

## Proposed decision entry

> 48. **ADR-048 One product: ITUN at salvageunion.io/build** — Proposed: a
> Workers route `salvageunion.io/build*` on `su-itun`, ahead of `su-srd`'s
> Custom Domain; ITUN built under base `/build/`; intheunionnow.com 301s there
> by zone Redirect Rule. Separate Workers, CSPs, Sentry projects and deploys.
> One Union bar and one Footer in component-lib. Spike: this file.

Re-opens T7 (one OG pipeline), as its own trigger says.

## Questions for the owner

1. Option A, with the CI token widened (step 2), or the route kept by hand?
2. Is one forced sign-out, and one PWA reinstall, acceptable?
3. ITUN's footer shows only on a signed-out desktop, as before. Should every
   ITUN page end on it, as every srd page does?
4. The Union bar is 56px in both tools. Keep 56, or pick 48 or 64 for both?
