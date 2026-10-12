# Spike S2: one product at salvageunion.io/build

Refit ledger item S2. **Status: decided and built, ADR-048.** The owner's
direction: "lets merge the sites, but not the code. salvageunion.io/build",
then "we can keep them as separate codebases, but mount one at `/build`". ITUN
stays its own app, Worker, workspace, Sentry project and deploy leg; the two
sites are one product at one domain.

**Decision: a Workers route `salvageunion.io/build*` on `su-itun` (option A).
ITUN is built under the base `/build/`, and its Worker keeps
intheunionnow.com to 301 every old link to the same page there.** It ships
with the first deploy of `main` that carries it; the one thing the repo cannot
do for itself is the token permission in [Before the deploy](#before-the-deploy).

## The finding

Ruleset §3.11 already says "one union, two tools: one Union bar; the switcher
reads Reference | Build". Users met two domains, two bar heights (srd 64 + 3px,
ITUN 48 + 3px), two footers and two search entries. The chrome half shipped
first (#1423): one 56px Union bar with one search entry, and one component-lib
`Footer`, in both apps.

## How ITUN is mounted

| Piece | Where | What |
| --- | --- | --- |
| Where it lives | `apps/itun/src/lib/site.ts` | `SITE`: `https://salvageunion.io`, base `/build/` |
| Build | `apps/itun/vite.config.ts` | Vite `base: '/build/'`, output `dist/build/`; `_headers` (its `/assets/*` rule scoped to `/build/assets/*`) and an `index.html` copy move up to `dist/` (`siteLayout`) |
| Router | `main.tsx` | `basepath: '/build'`; routes and links stay root-relative |
| PWA | vite-plugin-pwa | manifest scope and `start_url` `/build/`; `/build/sw.js`, scope `/build/` |
| Share links | `lib/appUrl.ts` | origin + `/build` + route (public sheet, invites, the pattern address); the shell probe is under the base |
| og:url, og:image | `index.html` | `https://salvageunion.io/build/…`; link previews use the request's origin and base |
| Worker | `src/worker/basePath.ts`, `legacyHost.ts`, `index.ts`, `linkPreview.ts` | `BASE_PATH=/build`; strips it, restores it on every URL it builds |
| Wrangler | `apps/itun/wrangler.jsonc` | route `salvageunion.io/build*` (`zone_name`), the intheunionnow.com custom domains, `run_worker_first: ["/*", "!/build/*"]` |
| srd's worker | `apps/srd/ssg/pwa.ts` | srd's service worker (scope `/`) leaves `/build` navigations alone |
| Links in | srd `ITUN_URL`, the bot's `ITUN_ORIGIN` | `https://salvageunion.io/build` |

One configuration: `bun run dev`, `bun run preview`, CI's e2e, the preview slot
and production all serve ITUN under `/build/`. The e2e specs open app routes
through `at()` (`apps/itun/e2e/_base.ts`).

### Request flow

- **`salvageunion.io/build/…`** reaches `su-itun` by its route, which runs
  before `su-srd`'s Custom Domain. Static Assets answers first, with ITUN's
  `_headers` (CSP, `immutable`); the script runs only for a miss that is not a
  navigation (a rotated chunk's 404, an unfurl), as before.
- **Outside `/build/`** the script runs first (`legacyHost.ts`):
  - **intheunionnow.com and `www`**: a 301 to the same page under
    `https://salvageunion.io/build`, query kept. Refit D6's retired addresses
    go straight to where they live now (`/join/X` → `/build/invite/X`), in one
    hop. `www` first takes ADR-033's zone rule to the apex.
  - **`salvageunion.io/build`** (no slash), and the root of the preview slot or
    `wrangler dev`: a 301 to `/build/`. Anything else: 404, `no-store`.
- Nothing else on `salvageunion.io` reaches `su-itun`.

The 301s live in the Worker, not in a zone Redirect Rule, so the redirect is
in the repo, tested (`routing.test.ts`) and deployed with the app; its cost is
one Worker request per old-link hit, a shrinking population.

## Options considered

Facts (Cloudflare docs, 2026-10): a Workers route runs before a Custom Domain
Worker on the same hostname; Static Assets answers by path before a script; a
script invocation counts against the shared 100k/day Free quota, a static hit
does not.

- **A. A Workers route on `su-itun` (chosen).** `/build/*` never reaches srd.
  ITUN's assets, CSP, Sentry project and deploy stay its own. No new quota
  cost under `/build/`.
- **B. A service binding from `su-srd`.** `run_worker_first: ['/build/*']` on
  srd makes every ITUN request an srd Worker invocation, and srd's script
  ITUN's front door; responses built by the script lose `_headers`.
- **C. The O3 edge planner (`planEdgeRequest`).** B with ITUN's `dist/` folded
  into srd's: it merges the code. ADR-047 is unaffected by A.

## Auth

- **The Discord OAuth callback does not change**: Discord redirects to the
  Convex `.site` URL, not the frontend.
- **`SITE_URL`** on the production Convex deployment is
  `https://salvageunion.io/build`. Every itun deploy sets it, after the Worker
  is live (`deploy-cloudflare.yml`, `ITUN_SITE_URL`, held equal to `SITE` by
  `routing.test.ts`). Every `redirectTo` ITUN passes is router-relative, so the
  base is never doubled.
- **No cookies.** Convex Auth's React client keeps its tokens in
  `localStorage`, per origin. **Every player is signed out once**: the first
  visit to salvageunion.io/build starts signed out. Player data is safe
  (Convex is the server of record, ADR-034); signing in is one Discord click.
- **Shared origin, shared storage.** srd's scripts can read ITUN's
  `localStorage`. srd ships no third-party script but Ko-fi's (in both CSPs
  already) and runs no user content; any new third-party script on srd is now
  a question for ITUN's tokens too.

## CSP and Sentry

Each Worker serves its own `_headers`, so each app keeps its own CSP on its own
paths (`packages/observability/CLAUDE.md`: nothing merged, nothing to change
together). ITUN's `public/_headers` stays its one source; the build moves it to
`dist/`. Sentry stays two browser projects and the `workers` project. If the
`itun` project keeps an **Allowed Domains** list, it needs `salvageunion.io`.

## SEO

- srd's canonicals and sitemaps are unchanged. ITUN's shell has no canonical,
  on purpose; `og:url` points at `salvageunion.io/build/`.
- `salvageunion.io/robots.txt` is srd's (`Allow: /`), so `/build/*` is
  crawlable, as intheunionnow.com was. ITUN's own `robots.txt` is gone.
- The 301s carry intheunionnow.com's link equity to the new URLs.

## PWA and offline

- ITUN's manifest and worker are scoped `/build/`; srd's stay `/`. srd's worker
  no longer answers `/build` navigations, so ITUN's network-first shell rule
  decides there.
- The offline shell is ITUN's precached `index.html` under `/build/`.
- **An installed intheunionnow.com PWA** opens the old origin, which now
  redirects to salvageunion.io/build in the browser. Players reinstall once.

## Before the deploy

**One owner step**, before `design-refresh` reaches `main`: the production
Cloudflare token (the `production` Environment's `CLOUDFLARE_API_TOKEN`) needs,
on the **salvageunion.io** zone:

- **Zone → Zone: Read** (wrangler resolves `zone_name`), and
- **Zone → Workers Routes: Edit** (it publishes `salvageunion.io/build*`).

Cloudflare dashboard → My Profile → API Tokens → the deploy token → Edit →
add both, scoped to the `salvageunion.io` zone. Workers Scripts: Edit stays as
it is (ADR-033 §Credentials). Without them the deploy's `plan` job fails
**before anything is built**, naming what is missing: the route would
otherwise be published after the script, leaving a half-deploy.

Nothing else is by hand. No DNS changes; no Redirect Rule; `SITE_URL` is set by
the deploy.

## On deploy

The first deploy of `main` with this change, in its own job order:

1. `plan` checks the token can read the zone and its Workers routes.
2. `build-itun` builds under `/build/`; `push-convex` pushes the backend.
3. `deploy`: `su-itun` gets its new version, the `salvageunion.io/build*` route
   and keeps both intheunionnow.com domains; srd and the bot ship their links.
   Then the itun leg sets `SITE_URL` to `https://salvageunion.io/build`.
4. `smoke` checks `salvageunion.io/build/` (200, CSP, HSTS, the chunk 404 and
   its `no-store`), the bare `/build` 301, and intheunionnow.com's 301s
   (`/`, a path with a query, a retired `/join` link).

The preview slot follows on every `design-refresh` push, at
`https://preview-su-itun.alxjrvs.workers.dev/build/` (`SITE_URL` with the base).

Say in the changelog: sign in again, and reinstall the app if you installed it.

## Rollback

Revert the change and deploy: the route is removed with it, intheunionnow.com
serves again, and `SITE_URL` must be set back by hand
(`bunx convex env set --prod SITE_URL https://intheunionnow.com`). Sessions
made on salvageunion.io are lost (a second sign-out).

## Not done here

- T7 (one OG pipeline) re-opens now that ITUN is on salvageunion.io, as its own
  trigger says.
- `AppBar`'s mark and ITUN's in-app logos use the root path
  `/logos/su-cargo-dark.svg`, which on one origin is srd's copy: it works, but
  couples the two apps.
- ITUN's footer still shows only on a signed-out desktop.
