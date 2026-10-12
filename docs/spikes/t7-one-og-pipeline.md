# Spike T7: one OG image pipeline

Refit ledger item T7, spike. **Status: for the owner to decide.** Nothing here
is built; this doc is the deliverable.

## The question

Two pipelines draw the same `OgCard` (issue 1280):

| | srd (salvageunion.io) | ITUN (intheunionnow.com) |
| --- | --- | --- |
| What | ~1,004 reference cards (entities + chassis patterns) | player sheets, patterns, invites |
| When | build time, in the deploy's `og-srd` job | runtime, on the unfurl's image request |
| How | Playwright + Chromium over `wrangler dev`, `sharp` palette compression (`apps/srd/scripts/og-screenshots.ts`) | Browser Rendering REST `/screenshot` of the SPA's `/og/:kind/:id` surface (`apps/itun/src/worker/linkPreview.ts`) |
| Cache | `actions/cache`, keyed on the card's built closure + entity JSON (E6, #1391) | Cache API (per colo), keyed on a hash of the public answer |
| Secrets | none | `CF_ACCOUNT_ID`, `BROWSER_RENDERING_TOKEN` (optional) |

ITUN cannot go build-time: its cards are user data that changes at any
moment. So "one pipeline" can only mean srd moves to runtime, or srd stops
having per-entity images.

## What the build-time path costs now (after E6)

Measured on the last preview deploy before E6 landed
([run 38223710175](https://github.com/SalvageUnion-io/SU-SRD/actions/runs/38223710175),
cold cache), and from E6's own local runs:

- **Cold** (any change to the card's rendering, i.e. `OgCard`, `ChapterBand`, the
  og-card page's CSS or fonts, the script, or a Playwright/sharp bump):
  `og-srd` job **110 s**, of which the render is 80 s (1,004 cards, 5 workers).
- **Warm** (every other commit): E6 restores all 1,004 PNGs in about 1 s. The job
  still costs its fixed overhead: about 6 s of checkout, Bun and artifact download,
  about 6 s of Chromium install and fingerprinting, about 4 s re-uploading the 29 MB
  `srd-dist` artifact, and runner start. That puts **~25–30 s** on the deploy's
  critical path, because `ship` needs `og-srd` and `build-itun` finishes first.
- **Data edit**: only the touched cards re-render (E6: a Mule rename re-rendered
  7 cards in 8 s).

So the saving on offer is ~25–30 s per deploy, plus the cold re-renders,
which the design refresh triggers often while the card is still changing.
That is far less than the 108 s the ledger was written against.

## Options

### A. Runtime for both, cached in R2

srd pages always advertise `/schema/…/item/{id}.og.png?v=<key>`. The file is never
in `dist`, so Static Assets misses. srd's `not_found_handling` is `none`, so a miss
already runs `apps/srd/src/worker/index.ts`. A new branch there would:

1. read `og/<key>.png` from an R2 binding and serve it if present;
2. otherwise call Browser Rendering's `/screenshot` on
   `https://salvageunion.io/og-card/?schema=…&item=…[&pattern=…]`. The
   page already reads its target from the query string (`OgCardIsland`), so the
   surface needs no change beyond waiting on `html[data-og-current="<key>"]`
   rather than `[data-og-ready]`. Then `put` the PNG to R2 and serve it.

`<key>` is the hash the build already computes per entity (the render fingerprint
plus entity JSON, `ogRenderFingerprint.ts`). It is computed without Chromium in about 1 s
and baked into the page's meta, so a new deploy changes the URL and an unchanged
card hits R2 on every deploy. ITUN would move its Cache API store to the same kind of
R2 bucket so a cold colo stops re-rendering (optional; its key scheme is fine).

- **Deletes:** `og-screenshots.ts` (533 lines), `.github/actions/srd-og/`, the `og-srd` jobs in `deploy-cloudflare.yml` and
  `deploy-preview.yml`, the `og:generate` / `og:install-browser` scripts, and
  srd's `sharp` dependency (`og-screenshots.ts` is its only importer). It
  **keeps** `ogRenderFingerprint.ts` (the key) and Playwright (the e2e suites).
- **Adds:** about 80–120 lines in srd's Worker (largely a port of `ogImage` and
  `screenshot` from ITUN's `linkPreview.ts`, which could move into a shared
  module), an R2 binding, two secrets on `su-srd`, and a runtime dependency on a
  paid API for the reference site, which today has no backend at all (ADR-033).
- **Loses:** `sharp`'s palette compression. Browser Rendering returns plain PNGs
  (about 78 KiB per card measured locally, against the compressed build output), unless the
  Worker re-encodes them, for example through Cloudflare Images as `su-assets` already does.

### B. Keep build-time for srd (status quo after E6)

- **Costs:** ~25–30 s per warm deploy, ~110 s cold, and Chromium in CI.
- **Keeps:** zero first-hit latency, no secrets or paid API on srd, and every
  card is known-good before it ships. The "never fails the build" contract (#482)
  already holds.

### C. One static image per site

Every srd page uses `/og-image.png` (and ITUN its default). This deletes
everything in A's list and adds nothing. The cost is the product: issue 1280's
per-entity preview, with its name, stats, tone and cite, was the point. A link to
`/schema/chassis/item/mule/` would unfurl as the site banner, with only
`og:title`/`og:description` to tell it apart. It does not unify ITUN (its sheets
need per-thing cards), so it only removes srd's half.

## Cost of runtime rendering (A)

**Browser Rendering** (now "Browser Run"; REST API billed on duration only):
Workers Paid includes **10 browser-hours/month**, then **$0.09/browser-hour**.
REST limit: 10 requests/s. (Workers Free: 10 min/day, which is not enough for a backfill.)

- A full re-render of all 1,004 cards at an assumed 3–5 s of billed browser time
  each is **0.8–1.4 browser-hours**. Lazily (A as written), only cards someone
  actually shares are ever rendered, so a month is very likely well inside the
  included 10 h. A design-refresh week of daily card changes, *with* a warm-on-deploy
  sweep, could be 5–10 h, which is still at or near free. Worst case
  past the allowance is cents.
- That per-card time is **an estimate, not a measurement**: this session has no
  Browser Rendering token. Locally, a fresh Chromium (no reuse) loads `/og-card/`,
  fetches 0.3–0.8 MB of chunks and data, and screenshots in **0.75–1.1 s**
  (launch 0.2–1.4 s more). Browser Rendering adds a browser start in Cloudflare's
  pool and the round trip to salvageunion.io.

**R2:** about 1,004 × ~80 KiB ≈ 80 MB per render key, so one live key plus a few stale ones
stays inside the free 10 GB-month. Writes are Class A, ~1k per full re-render
(free tier 1M/month). Reads are Class B (free tier 10M/month). There is no egress
charge. A lifecycle rule (delete after N days) would clear stale keys.

**First-hit latency:** the risk that decides it. The first unfurl of a card
waits on the screenshot, an estimated **3–8 s** cold (one Worker subrequest, Browser
Rendering's page load with `waitUntil: networkidle0`, and the R2 put). Discord, X and
Slack do not document their image-fetch timeouts (searched; nothing official). What
is documented in practice is that Discord **caches the embed and image by URL**,
so a first fetch that times out can stick as a picture-less embed for that URL.
ITUN accepts this today. srd's links are posted far more (every rule
reference), so it matters more there. The mitigation is a post-deploy **warm sweep**:
a job that requests every changed card's URL so R2 is filled before anyone
shares it. That brings back a CI job (without Chromium, about 1–2 min of HTTP
calls on a cold key at 10 req/s) and re-creates most of what A set out to delete.

## Owner steps (only if A is chosen)

1. Create an R2 bucket for OG renders (e.g. `su-og`), with a lifecycle rule.
2. Add an `r2_buckets` binding to `apps/srd/wrangler.jsonc` (and to
   `apps/itun/wrangler.jsonc` if ITUN moves off the Cache API).
3. `wrangler secret put CF_ACCOUNT_ID` and `BROWSER_RENDERING_TOKEN` on
   `su-srd` (reusing ITUN's token, which needs Browser Rendering edit permission).
   Leave them optional as on ITUN: without them srd advertises the default image.
4. If the warm sweep is wanted, give it its own deploy job (it needs no secrets beyond
   the site URL).

## Recommendation

**B: keep build-time for srd, and close T7 as measured.** After E6 the
build-time path costs ~25–30 s on a warm deploy. A trades that for a paid
runtime dependency, two secrets and a bucket on a site that has no backend
(ADR-033), uncompressed PNGs, and a first-unfurl latency that only a warm sweep
fixes, and that sweep is a CI job again. Unifying the *code* has value (one
`screenshot` + cache module), but the two pipelines already share the part that
matters, the drawing (`OgCard`, `ogCardForEntity`), so the preview cannot drift
between sites.

Revisit when one of these changes:

- **S2** puts ITUN at salvageunion.io/build. One zone then makes a shared R2 bucket
  and a single OG Worker route natural, and srd's Worker gains a second job anyway.
- The deploy's critical path shrinks enough that `og-srd`'s ~30 s is the
  largest remaining step.
- A browser-free renderer (Satori + resvg-wasm in a Worker, say) can draw
  `OgCard` faithfully. That would take Chromium out of both pipelines and is the
  real "one pipeline", but the card's CSS (the speckle, the notched title, the fonts)
  would need proving against Satori's subset first. Out of scope here.

## Prototype

None shipped. A Worker branch would need the bindings and secrets above to do
anything, and a dormant code path would fail `knip`'s dead-code gate. The only
prototype run was a local measurement: Playwright over the built
`apps/srd/dist`, a fresh browser per card, rendering `/og-card/?schema=…&item=…`
for a chassis, a system, an ability and a chassis pattern. Numbers are above.
