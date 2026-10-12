# Spike T7: one OG image pipeline

Refit ledger item T7, spike. **Status: decided again (2026-10-12): option B, after the
round-2 re-measure below. Closed until a [re-open trigger](#recommendation) fires.** First round: option B, chosen 2026-10-12
([#1396](https://github.com/SalvageUnion-io/SU-SRD/pull/1396#issuecomment-6124251979)),
re-open trigger "S2 moves ITUN to salvageunion.io/build". S2 has landed (#1423,
#1426): ITUN is the Workers route `salvageunion.io/build*` on `su-itun`, its own
app, Worker and deploy leg (ADR-048). Nothing here is built; the doc is the
deliverable (see [Prototype](#prototype)).

## The question

Two pipelines draw the same `OgCard` (issue 1280):

| | srd (salvageunion.io) | ITUN (salvageunion.io/build) |
| --- | --- | --- |
| What | ~1,004 reference cards (entities + chassis patterns) | player sheets, patterns, invites |
| When | build time, the deploy's `og-srd` job | runtime, on the unfurl's image request |
| How | Playwright + Chromium over `wrangler dev`, `sharp` palette compression (`apps/srd/scripts/og-screenshots.ts`) | Browser Rendering REST `/screenshot` of the SPA's `/og/:kind/:id` surface (`apps/itun/src/worker/linkPreview.ts`) |
| Cache | `actions/cache`, keyed on the card's built closure + entity JSON (E6, #1391) | Cache API (per colo), keyed on a hash of the public answer |
| Secrets | none | `CF_ACCOUNT_ID`, `BROWSER_RENDERING_TOKEN` (optional) |

ITUN cannot go build-time: its cards are user data. So "one pipeline" means srd
renders at runtime, or something other than a browser draws both, or srd drops
per-entity images.

## Measured (round 2)

**`og-srd` on main**, the last six deploys that built srd (runs 38005649860 to
38102977883): **warm 22–28 s, cold 140–173 s**, and **four of the six were cold**.
Cold is any change to the card's rendering (`OgCard`, `ChapterBand`, the og-card
page's CSS or fonts), which the refresh does most days. `deploy` needs `og-srd`;
the job beside it, `push-convex`, ends ~15–20 s after `build-srd`. So `og-srd`
puts **~10 s (warm) to ~150 s (cold)** on every leg's critical path, ITUN's, the
bot's and su-assets' included, since `deploy` is one matrix with one `needs`.
Round 1's "110 s cold" was a preview run; main is slower.

**Satori + resvg, against the real `OgCard`** (a scratch probe: `satori@0.18.3`,
`@resvg/resvg-js@2.6.2`, the Scrapper card). It renders only after a pre-pass
that rewrites the tree, and it is not the same picture:

- Satori reads inline styles only. `ChapterBand`'s layout is stylesheet classes
  (`.su-chapter-band__row`, `__title`, `__eyebrow`: padding, the hero size, the
  `@media` steps) with `var(--space-*)`, so the band collapsed to a strip and the
  notched title lost its seat on the band's foot.
- Every multi-child box needs an explicit `display: flex`; `calc()` borders,
  `useId` (Speckle's filter ids), a root-relative logo `src` and `z-index` (the
  speckle layers) all needed rewriting or were dropped.
- The speckle's SVG filters (`feTurbulence`) did draw, through resvg.
- Speed: **~20 ms layout + ~270 ms PNG** per card, warm (2.7 s cold, font parse).

So a Satori renderer is a **second drawing of the card** in Satori's subset, which
is the drift issue 1280 built `OgCard` to prevent. The card's fonts, stats, foot
and frame came through; the band would need its og-scale layout moved out of the
stylesheet into style objects first.

## What S2 changes, per option

### A. srd renders at runtime, cached in R2

Round 1's design, unchanged: srd pages advertise `…/item/{id}.og.png?v=<key>`
(`<key>` = `ogRenderFingerprint.ts` + entity JSON, ~1 s, no Chromium); a miss
reads R2, else screenshots `/og-card/?schema=…&item=…` through Browser Rendering
and `put`s it. Deletes `og-screenshots.ts`, `.github/actions/srd-og/`, both `og-srd`
jobs, `og:generate` / `og:install-browser`, srd's `sharp`. S2 adds two variants:

- **A1, in srd's Worker.** As round 1: an R2 binding and the two secrets on `su-srd`,
  a paid runtime API on the site that has no backend (ADR-033).
- **A2, in ITUN's Worker.** `/build/og/ref/…png` answered by `ogImage`, which already
  has the screenshot, the secrets and the route. **No new route or secret**; the
  same-origin page it shoots is srd's `/og-card/`. But srd's unfurls then ship on
  ITUN's Worker and deploy leg, and a broken `su-itun` blanks every rule reference's
  preview: the coupling "merge the sites, not the code" (ADR-048) rules out. The
  preview slot breaks too: a preview srd page would point at production ITUN.
- **One bucket, one module.** A shared `su-og` bucket bound to both Workers is
  natural on one zone. A shared `screenshot + cache` module is not worth having
  today: srd's half is Playwright in CI, ITUN's a REST call in a Worker; they share
  a viewport and a selector. It becomes real only once A exists, and then it is
  ITUN's `screenshot` + an R2 `ImageCache` moved to a package both Workers import.

S2 does **not** change A's costs: first-unfurl latency (an estimated 3–8 s cold;
Discord caches a timed-out embed by URL), and so the **warm sweep**. New in round 2:
the sweep runs *after* `deploy`, so it is **off the critical path**, which is
A's real gain. A cold key is ~1,004 renders at BR's 10 req/s: ~2–7 min after each
cold deploy, ~1–1.4 browser-hours each. At four cold deploys a day that is
~120–170 h/month past the included 10 h, **~$10–15/month** at $0.09/h, during the
refresh only. Loses `sharp` compression (~78 KiB/card plain).

### B. Keep build-time for srd (status quo)

Costs ~10 s warm / ~150 s cold on every leg's deploy. Keeps zero first-unfurl
latency, no runtime dependency on srd, every card known-good before it ships, and
"never fails the build" (#482). S2 changes nothing here.

### C. One static image per site

Deletes everything in A's list, adds nothing, and loses issue 1280's per-entity
preview; ITUN keeps its renderer, so it unifies nothing. Unchanged by S2.

### D. A browser-free renderer (Satori + resvg-wasm), for both

The real "one pipeline": the same JSX → PNG in srd's build (or Worker) and ITUN's
Worker, no Chromium anywhere, no Browser Rendering secrets, ~0.3 s a card. **Not
viable as `OgCard` stands** (measured above): it needs `ChapterBand`'s og scale and
`Speckle` rewritten into Satori's subset, and a test that holds the Satori and
browser pictures equal, or the preview drifts from the page.

## Owner steps

- **A1:** create an R2 bucket (`su-og`) with a lifecycle rule; bind it in
  `apps/srd/wrangler.jsonc` (and ITUN's, to replace its Cache API); `wrangler secret
  put CF_ACCOUNT_ID` and `BROWSER_RENDERING_TOKEN` on `su-srd` (ITUN's token can be
  reused); accept the BR bill; approve a post-deploy warm-sweep job.
- **A2:** the bucket and ITUN binding as A1; confirm both secrets are set on
  `su-itun` (they are optional there); accept srd unfurls depending on `su-itun`;
  approve the sweep. No new route or secret.
- **B, C:** none.
- **D:** none for infrastructure; a design call that the og-scale band may be
  restyled for Satori, then a build-out PR (and A's bucket if ITUN's renders should
  outlive a colo's cache).

## Recommendation

**B again, with the next trigger named. The owner chose it (2026-10-12, #1429).** S2 makes A cheaper only as A2, and A2
puts srd's previews on ITUN's leg, against ADR-048. A1 is round 1's trade with one
new fact on each side: cold deploys cost ~150 s and happen most refresh days, but
moving the work to a post-deploy sweep moves it to a paid API and a sticky-blank
first unfurl. D is the only option that is truly one pipeline, and it fails on
fidelity today.

Re-open when:

- `ChapterBand`'s og scale is pure style objects (D becomes a port, not a redraw);
- the refresh ends and cold deploys stop being daily (B's cost falls to ~10 s); or
- the deploy's critical path is otherwise short enough that ~150 s cold dominates.

## Prototype

None shipped: nothing in this round needs no new infrastructure *and* is worth
having regardless (see "One bucket, one module"), and a dormant path would fail
`knip`. Round 1 measured a local Playwright render of `/og-card/` (0.75–1.1 s a
card, fresh browser). Round 2's Satori probe ran from a scratch directory against
`component-lib`'s `OgCard`, compared with `bun run shot compositions--og-card--default`.
