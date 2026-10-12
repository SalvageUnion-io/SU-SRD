# Spike O3: one salvageunion.io edge Worker

Refit ledger item O3, a spike for the owner to decide. Nothing here changes
production: no `wrangler.jsonc`, workflow, `_headers` or route is edited, and
the prototype (`apps/srd/src/worker/edgeHost.ts`) is imported only by its test.

**Recommendation: fold `api.` into the srd Worker (option B). Keep `assets.` as
its own Worker. Supersede ADR-043 decision 1 with the entry proposed below.**
That leaves four deployables, not three: salvageunion.io (with `api.`),
`assets.salvageunion.io`, intheunionnow.com and the bot. Folding `assets.` too
costs more than the Worker it saves (see option D).

## Why

[ADR-043](../ARCHITECTURE.md#decisions) decision 1 plans `apps/api`, a fifth
Worker beside `su-srd` (a 64-line miss handler) and `su-assets` (270 lines over
R2), all on the `salvageunion.io` zone. Its own text says the new Worker
"copies srd's `apps/srd/src/worker/index.ts`", and its emitter is the same one
that builds srd's `/schema/*`. A new Worker brings what every Worker brings:
its own `withObservability` entry and `check-observability` row, its own
`_headers` and CSP, its own `SURFACES` entry in `tools/deploy-surfaces.ts`, CI
path filters, a deploy matrix leg, smoke lines, a preview slot and a row in
[services](../ARCHITECTURE.md#areas). ADR-043's last consequence names that
cost; this spike asks whether to pay it.

## Facts the options turn on

Checked against Cloudflare's docs (2026-10):

1. **Static Assets ignores the host.** A Worker with assets answers a request
   from `dist/` by path before any script runs, whatever hostname it came in
   on. Attach `api.` to `su-srd` as it is and `api.salvageunion.io/` serves
   srd's home page. A host switch needs the script to run for the paths where
   hosts disagree.
2. **`assets.run_worker_first`** takes `true` or up to 100 path patterns
   (globs, `!` exceptions). Paths only, never hosts.
3. **Static asset requests are free and unlimited; a script invocation counts**
   against the Free plan's 100k requests/day, shared with RANDSUM
   ([ADR-033](adr/033-hosting-on-cloudflare.md) §6).
4. **Workers Caching (`cache.enabled`, which `su-assets` uses) bills every
   request, static asset hits included**, at the Worker request rate.
5. **`_headers` matches absolute URLs** (`https://api.salvageunion.io/*`), so
   per-host headers on static files need no script. It is not applied to a
   response the script builds; it is applied to one fetched through `ASSETS`.
6. **Free plan: 20,000 static assets per Worker version.** The dataset is
   1,562 rows over 27 files; `/v1` adds about one file per row plus one or two
   per schema.
7. **A Workers route runs before a Custom Domain Worker** on the same
   hostname: the Custom Domain is treated as the origin. This decides S2.

## Options

### A. Host switch with `run_worker_first: true`

Every request on every host runs the script, which picks a tree by host.
Simplest code, worst cost: every srd page view becomes a Worker request
(fact 3), which is what ADR-043 decision 1 chose static files to avoid. Every
response is then built by the script, so `_headers` stops reaching any of
them (fact 5) and the CSP moves into code. **Rejected.**

### B. One `dist/`, path-disjoint, three shared paths (recommended for `api.`)

The ADR-043 emitter writes the `/v1/*` tree into srd's `dist/` instead of
`apps/api/dist/`. Those paths exist only for the API, srd's pages only for srd,
so both are plain static hits. Only the paths both hosts claim with different
bytes run the script first:

| Path          | salvageunion.io      | api.salvageunion.io       |
| ------------- | -------------------- | ------------------------- |
| `/`           | srd home             | `/_api/index.html` (docs) |
| `/llms.txt`   | srd's (exists today) | `/_api/llms.txt`          |
| `/robots.txt` | srd's (exists today) | `/_api/robots.txt`        |
| any miss      | srd's `404.html`     | a bare JSON 404           |

`/licence` is new and API-only, so it is a plain file on both hosts. The
script's decision is `planEdgeRequest()` in the prototype; wired up, the miss
handler in `index.ts` becomes "plan, then `ASSETS.fetch` or the host's 404".

What it costs:

- **Quota:** `run_worker_first: ['/', '/llms.txt', '/robots.txt']` makes each
  srd home-page view a Worker request (the other two are crawler traffic).
  Everything else stays free. The test pins the list at three, so growing it
  is a visible quota decision.
- **Cross-host leakage, both ways.** `salvageunion.io/v1/chassis.json` answers,
  and `api.salvageunion.io/schema/chassis/` serves an srd page. Neither is
  harmful: srd pages already carry a `salvageunion.io` canonical, and an
  absolute-URL `_headers` block can mark `https://salvageunion.io/v1/*`
  `X-Robots-Tag: noindex` (fact 5). `_headers` rules add up and cannot
  subtract, so marking srd's pages noindex on `api.` alone would need a script;
  the canonical is enough. ADR-043's `$id`s stay on `api.salvageunion.io`.
- **One failure domain.** A broken srd build or deploy takes the API down with
  it, and an API emitter failure blocks an srd deploy. The two already share
  their emitter and data, so most failures are common to both anyway.
- **Asset count** stays well under 20,000 (fact 6), but the deploy now uploads
  both trees; measure on the first build.

### C. ADR-043 as written: `apps/api`, a fifth Worker

Clean separation and an independent deploy, at the full per-Worker cost listed
under "Why", for a Worker whose script is a copy of srd's. Keep this if the
owner wants the API's deploys or outages independent of srd's.

### D. Also fold `assets.` into the srd Worker

`su-assets` is not a static site: every request runs its script (R2 and the
Images binding), and Workers Caching is on. Folding it in:

- would either turn Workers Caching on for `su-srd`, billing every srd static
  hit (fact 4), or drop it and run the R2/Images script on every artwork hit;
- needs `run_worker_first` on the artwork key space (`/chassis/*`, …) and on
  `/robots.txt`, whose two answers must never cross: srd's allows crawling,
  the licensed artwork's must say `Disallow: /`;
- puts R2 and Images bindings, the `sandbox` CSP and the licence posture into
  the srd Worker, and makes an srd deploy redeploy the artwork origin.

It saves one Worker and adds more surface than it removes. **Not recommended.**

## What moves under B

| Concern | Today / ADR-043 as written | Under B |
| --- | --- | --- |
| Worker | `su-srd`, plus planned `apps/api` | `su-srd` only; no `apps/api` workspace |
| Routes (`apps/srd/wrangler.jsonc`) | apex, `www` | apex, `www`, `api.salvageunion.io` (custom domain) |
| Script | srd miss handler | miss handler + `planEdgeRequest` for three paths |
| `run_worker_first` | unset | `['/', '/llms.txt', '/robots.txt']` |
| Emitter output | `apps/api/dist/` | `apps/srd/dist/v1/` and `dist/_api/` |
| Sentry | a second `withObservability` entry | one entry, `su-srd`; tag events with `edgeHostOf(host)` |
| CSP / headers | a second `_headers` | srd's `_headers`; `/v1/*` block adds `Link: <…/licence>; rel="license"` and CORS; `https://api.salvageunion.io/*` blocks for robots |
| `check-observability` | a new Worker row | none new (`srd-worker` covers it) |
| `deploy-surfaces.ts` | a new `api` surface + path filter | none: the emitter lives in srd or `packages/`, already a surface/shared |
| `deploy-cloudflare.yml` | a new matrix leg | none |
| Smoke (`tools/smoke-production.sh`) | new API lines | the same new API lines, plus `api.…/` is not srd's home |
| Preview | a third preview Worker | none: `preview-su-srd` serves `/v1/*` by path |
| Services area | a new row | `su-srd` gains `api.salvageunion.io` |

### Sentry, CSP and the deploy gate, consolidated

- **Sentry.** One Worker entry, so one `withObservability('su-srd')` and the
  `workers` project as today. API misses are not errors (as with `su-assets`),
  so the only new signal is a tag; the browser side is unaffected (the API
  ships no JS).
- **CSP.** srd's `/*` CSP reaches `/v1/*` JSON too. It is inert on JSON and
  stricter than none, so it needs no carve-out; `check-observability` keeps
  guarding the one source. The API docs page at `/_api/index.html` inherits
  srd's CSP; if it ships no script, that is a no-op.
- **Deploy gate.** One build, one `wrangler deploy`, one smoke list. ADR-033 §7
  holds unchanged: a red gate halts the deploy, now for both hosts at once.

## S2: ITUN at salvageunion.io/build

O3 does not touch it, and S2 should not route through the srd Worker.

- **Recommended for S2: a Workers route** `salvageunion.io/build*` on `su-itun`.
  A route runs before the `su-srd` Custom Domain (fact 7), so `/build` never
  reaches srd's Static Assets or script, and srd's `run_worker_first` list does
  not grow. ITUN stays its own app, Worker, Sentry project and deploy leg
  ("merge the sites, but not the code").
- **Not via the edge Worker.** Proxying `/build/*` from `su-srd` to `su-itun`
  over a service binding needs `run_worker_first: ['/build/*']`: every ITUN
  request becomes an srd Worker request too, and srd's code becomes ITUN's
  front door.
- S2's own spike has to settle what B does not touch: ITUN's Vite `base` and
  asset paths under `/build/`, whether its Worker's Static Assets serve under a
  route as they do under its Custom Domain, the PWA scope, the OAuth callback
  origin, and the CSP of two apps on one origin.

B and S2 compose: the apex then carries srd (custom domain), ITUN (route) and
nothing else; `api.` is srd's second custom domain.

## Risk

- **Medium, and almost all of it at cutover.** The code is a pure function and
  a three-entry list; the risk is the Cloudflare configuration: a route
  attached to the wrong Worker, a `_headers` absolute-URL rule that does not
  match, or `run_worker_first` patterns that over-match.
- **Quota:** bounded by srd's home-page traffic; Cloudflare's dashboard shows
  the request count by Worker within a day of shipping.
- **The API is not built yet** (ADR-043 is "accepted, not built"), so nothing
  live depends on it. Deciding B now costs nothing until `/v1` opens; deciding
  it later means moving a live hostname.

## Rollback

`api.` has no traffic until ADR-043's prerequisites land, so the first rollback
is free: delete the route line. After that:

1. Remove `api.salvageunion.io` from `apps/srd/wrangler.jsonc`'s `routes` and
   deploy, or detach it in the dashboard (Workers → `su-srd` → Domains &
   Routes). The hostname then 404s; nothing else on the zone changes.
2. To fall back to option C, ship `apps/api` with the same emitter output and
   attach `api.` to it. The URLs are identical, so consumers see no change.

## Owner steps (in order, when `/v1` is ready to open)

1. Decide: B, or C as written. If B, merge the superseding entry below.
2. Confirm no DNS record exists for `api.salvageunion.io` (wrangler's custom
   domain attach creates it and fails with 409 if one exists, as with `www`
   in ADR-033).
3. Land the PR that adds the `api.salvageunion.io` route,
   `run_worker_first`, the emitter output and the `_headers` blocks to srd. Its
   first deploy attaches the domain and issues the certificate.
4. Check **Always Use HTTPS** covers `api.` (zone-wide, so it should) and add
   `http://api.salvageunion.io/` → 301 to the smoke list with the rest.
5. Watch `su-srd`'s request count in the dashboard for a day against the 100k
   Free quota.
6. For S2, later: add the `salvageunion.io/build*` route to `su-itun` in its
   own PR, after S2's spike.

## Proposed superseding entry

Not added to [ARCHITECTURE.md](../ARCHITECTURE.md); for the owner to accept:

```md
46. **ADR-046 One salvageunion.io edge Worker**
    Proposed: `su-srd` also serves `api.salvageunion.io`; `/v1` is static in srd's `dist/`, three shared paths run the script.
    Supersedes ADR-043 decision 1 (no `apps/api`); amends ADR-033. Spike: [o3-one-edge-worker.md](spikes/o3-one-edge-worker.md).
```

ADR-043's entry would then read "amended by ADR-046" (its other decisions
stand), and ADR-033's "amended by ADR-046". The entry number is whatever is
next when it lands.

## Not decided here

- The emitter itself, `/v1`'s layout and its prerequisites (ADR-043 decisions
  2–10 stand).
- S2's design beyond the routing choice above.
