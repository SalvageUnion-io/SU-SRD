# ADR-031: `srd` Builds on an In-House Vite SSG

## Status

**Accepted. Supersedes [ADR-012](ADR-012-srd-astro-static.md)** (`srd` as an
Astro static site with React islands).

What ADR-012 _decided_ is unchanged and is re-affirmed here: `srd` is a
statically pre-rendered, no-backend, CDN-cacheable site with React islands for
the few interactive parts, deployed to Netlify. **Only the machine that produces
it changes.** Astro is replaced by an in-house static-site generator at
[`apps/srd/ssg/`](../../apps/srd/ssg/), whose implementation contract is
[`ssg/DESIGN.md`](../../apps/srd/ssg/DESIGN.md). This ADR records _why_; that
file records _how_, and is the one to read before changing the build.

**Amended 2026-08-07 — decision 6 has been REPLACED.** `ssg/parity.ts`, its
`make-parity-baseline.ts` companion and their tests (2,109 lines) were
**deleted**: the "shelf life" this ADR called out under _Consequences_ had
arrived, and the gate's Astro baseline was gone from every checkout, so it could
not run at all. Everything below about parity should be read in the past tense.

Its replacement is **`ssg/snapshot.ts`**, a self-hosted snapshot gate, and the
swap is a deliberate change of KIND. Parity compared against a foreign
**oracle** — Astro's own output — which is strictly stronger while it lasts,
because it can catch output that was wrong from the very first build. It lasted
until the oracle became unregenerable. The snapshot gate compares against **our
own last-blessed output**, which is a weaker assertion (a wrong output committed
as the snapshot stays wrong) traded for one that cannot expire:

| | parity (retired) | snapshot (now) |
| --- | --- | --- |
| baseline | archived Astro `dist`, ~56 MB | our own output, ~680 KB digest |
| in a fresh checkout | absent | committed |
| regenerate | install ~2,200 Astro-era packages | `bun run snapshot:update`, ~3s |
| in CI | **never** | yes, in `build-srd` |
| catches wrong-from-the-start output | yes | no |

The nine files that told people to run a gate nobody could run are the whole
argument: a weaker check that actually executes beats a stronger one that does
not. Coverage is otherwise the same — file set, head metadata, JSON-LD, `<main>`
text, all 899 JSON endpoints, `llms.txt` — and `isInsertionOf`, parity's best
idea, is carried over for `/changelog`. Parity's HTML-analysis layer survives
verbatim as `ssg/htmlDigest.ts`, verified identical to the deleted code across
all 1,039 pages; what rotted was the baseline, never the scanning.

## Context

ADR-012 chose "**Astro, static, React islands**", and explicitly treated the
major version as incidental to the decision. Astro was, by the only measure that
matters for maintenance cost, cheap: in the site's entire history
`apps/srd/astro.config.mjs` was touched by **three commits** — the initial
catalog work, the Astro 7 upgrade (#365), and its upgrade-path doc (#362). None
of what follows is a complaint about Astro's behaviour.

### The driver: a TypeScript 6 pin this repo could not fix

The repo moved to **TypeScript 7** (#447). `apps/srd` did not. It carried its own
`typescript: 6.0.3` devDependency for one reason: its typecheck script was
`astro check && tsc --noEmit`, and `astro check` is `@astrojs/check`, which
declares `peerDependencies: { "typescript": "^5.0.0 || ^6.0.0" }`.

**`@astrojs/check@0.9.10` — the latest release, published 2026-07-27 — still
declares that range.** That was read off the published manifest rather than
assumed, and it is what closed off the cheap option: there was no forward version
to upgrade into, and the fix lived in someone else's dependency graph on nobody's
published schedule.

The pin was not cosmetic. It meant one workspace's typecheck answered a
_different question_ from every other workspace's, using a different compiler,
against a compiler major the rest of the repo had deliberately left behind — and
every root-level tool that walks the source had to know that.

The alternative that _was_ locally available was rejected: drop `astro check`
from srd's typecheck and keep `tsc --noEmit`. That un-pins the compiler
immediately, but `tsc` cannot parse a `.astro` file, and **18 `.astro` files held
the site's routing, layout, head metadata and JSON-LD**. The choice was between
one workspace on a stale compiler and the site's routing layer type-checked by
nothing. Neither is acceptable as a permanent state.

### What the Astro layer was actually buying

Five things. Four port trivially — file-based routing, the sitemap integration,
the PWA integration, and `Astro.props`/`params`/`url`. The fifth — zero-JS
components plus hydrated islands — was the whole question, and one finding made
it tractable:

**Islands can be mounted with `createRoot` rather than `hydrateRoot`.**
`useGameData`'s server snapshot is hardcoded `false` on purpose (the reason
`cardNeedsHydration` exists), so a genuinely _hydrating_ card renders its
fallback on the client's first pass while the server rendered the real thing —
the React #418 mismatch. Client-only mounting has no mismatch class at all: the
markup inside the placeholder is discarded and replaced. That removed the single
largest correctness risk in the migration, and it means **server-rendering an
island is an opt-in SEO/no-JS choice per island, never a hydration contract**.

The audit that preceded this also measured what the Astro shape was costing at
runtime: serialized island props totalled **18.7 MB across 1,039 pages**, of
which **`MobileNavIsland` alone was 17.3 MB** — the same 16.6 KB catalog blob
inlined into every page, roughly a third of a typical entity page. Astro's
props-per-island attribute encoding is what made that invisible.

## Decision

`srd` is built by an in-house static-site generator in `apps/srd/ssg/`: **Vite 8**
for the client bundle, **React 19** `renderToStaticMarkup` for the HTML, run
under Bun. `astro`, `@astrojs/react`, `@astrojs/sitemap`, `@astrojs/check` and
`@vite-pwa/astro` are removed, along with every `.astro` file and
`astro.config.mjs`.

1. **Routes are registered, not discovered.** A page is a
   `src/pages/**/*.page.tsx` module returning `{ meta, children }`; it is built
   only if `ssg/routes.ts` imports and registers it. Non-HTML outputs are
   `src/endpoints/*.ts` — **endpoints are not routes**. Output paths match
   Astro's exactly, including `/404` → `404.html` and dotted endpoints as files.
2. **The island protocol is a placeholder plus one props blob per page.**
   `<Island name client ssr>` emits `<div data-island … data-island-id>`; all of
   a page's props are emitted once as a single
   `<script type="application/json" data-island-props>`. `client` keeps Astro's
   four strategies 1:1 (`load` / `idle` / `visible` / `only`) so the existing
   directive guard test ported rather than being deleted. Mounting is always
   `createRoot`.
3. **`MobileNavIsland` takes zero props.** `buildCatalogSections()` is pure and
   `currentPath` is `location.pathname`, so the island computes both inside its
   own chunk — one shared copy instead of 1,039 inlined ones.
4. **`EntityCardStatic` stays out of the island system entirely**, rendering into
   the page tree and shipping no JS. It is 82% of entity pages; that path is
   untouched.
5. **Each Astro integration has a named replacement:** `@astrojs/sitemap` →
   `ssg/sitemap.ts` (same exclusion filter, same `sitemap-index.xml` +
   `sitemap-0.xml`); `@vite-pwa/astro` → `workbox-build`'s `generateSW` over the
   finished `dist`; `ClientRouter` → cross-document
   `@view-transition { navigation: auto }`; `prefetch` →
   `<script type="speculationrules">`; `astro check` → `tsc --noEmit`.
6. **`ssg/parity.ts` was the acceptance gate** — kept rather than discarded on
   green at the time, and since **retired** (see the amendment under _Status_;
   the clause below describes what it did, not what exists).
   It compared the built `dist` semantically against an
   archived Astro baseline: the exact emitted file set both directions, per-page
   `<title>` / description / canonical / every `og:*` and `twitter:*` / robots /
   every JSON-LD block deep-compared, the normalized visible text of `<main>`,
   all 899 JSON endpoints parsed and deep-compared, and byte-identical
   `llms.txt`.
7. **srd's `typescript@6.0.3` pin is deleted**; the workspace typechecks on the
   repo's TypeScript 7 like every other one.

### Measured

|                            | Astro                             | in-house SSG             |
| -------------------------- | --------------------------------- | ------------------------ |
| Build                      | 6.8s                              | **2.4s**                 |
| HTML payload across `dist` | 48.1 MB                           | **18.2 MB**              |
| `MobileNavIsland` props    | 17.3 MB over 1,039 pages          | **0**                    |
| Parity differences         | —                                 | **0 across 1,039 pages** |
| TypeScript                 | 6.0.3, pinned by `@astrojs/check` | repo-wide 7              |

The parity script is known to bite: it was run against **eight deliberately
injected defects** and failed on each. Zero differences is therefore a result,
not the absence of a test.

## Consequences

### What was given up — stated plainly

**This repo now owns ~1,500 lines of build tooling, forever.** Precisely: 2,388
lines under `apps/srd/ssg/` at the time of the migration, of which ~1,491 are the
generator proper (`build.ts`, `dev.ts`, `render.tsx`, `document.tsx`,
`routes.ts`, `endpoints.ts`, `sitemap.ts`, `pwa.ts`, `outputPath.ts`, `types.ts`,
`vite.config.ts`) and 897 were the parity harness. That is traded against a
dependency that cost this repo three commits in its entire history.

The 897-line parity harness has since been replaced by `ssg/htmlDigest.ts` +
`ssg/snapshot.ts` (see _Status_), which are smaller but not free. The standing
cost is still roughly as stated: a ~1,491-line generator plus a verification
harness. What changed is that the harness now runs.

**This is not a free win, and it should not be sold as one.** Astro's routing,
sitemap, PWA and SSR were maintained by other people, tested against far more
sites than this one, and improved without anyone here doing anything. None of
that is true of `ssg/`. There is no community, no issue tracker and no upgrade
path — `ssg/DESIGN.md` is the entire manual. What justifies it is narrow: the
cheap thing had a hard dependency on a compiler major the rest of the repo had
left, and no available version fixed it.

### What will bite later

- **The dev server must keep rendering through the production path.**
  `ssg/dev.ts` runs Vite in middleware mode and renders every request through the
  same `render` / `renderDocument` pair `ssg/build.ts` calls, via
  `ssrLoadModule`. It is slower than a client-rendered dev shell would be, on
  purpose. If someone "optimizes" dev into a SPA fallback, what developers look
  at stops being what ships, and production-only bugs become writable again.
  Every document dev serves was, at migration time, diffed whole against the
  built file for the same route; keep the shared path even though the gate that
  proved it is gone — with parity retired, dev rendering through the production
  path is now the *main* thing keeping the two honest.
- **The css/SSR stub is load-bearing and order-sensitive.** The SSR pass runs
  under Bun, not through Vite, and `component-lib`'s barrel reaches modules that
  `import './x.css'`. `ssg/build.ts` registers a `Bun.plugin` stubbing `.css` to
  an empty module — and a Bun plugin only affects modules loaded **after** it
  registers, which is why everything downstream is imported dynamically.
  Promoting any of those `await import`s to a top-level import silently hands the
  behaviour back to the runtime. It appears to work unguarded today only because
  Bun currently loads `.css` as a text module; the first `@fontsource` import
  that drifts into an SSR module ends that.
- **`vite build` mutates `NODE_ENV` in the calling process, and the SSR pass
  cannot survive it.** Bun picks its JSX transform at startup (`NODE_ENV` unset →
  `jsxDEV`), but React's `jsx-dev-runtime` re-resolves at import time and its
  _production_ build is an empty stub, so every `component-lib` module dies with
  "jsxDEV_… is not a function". `ssg/build.ts` saves and restores the previous
  value around the Vite call. Anything else that invokes Vite programmatically in
  the same process needs the same guard.
- **`envPrefix: 'PUBLIC_'` is an observability guard, not a style choice.** Astro
  exposed `PUBLIC_`-prefixed env to the client; Vite's default is `VITE_`.
  Without the override, `import.meta.env.PUBLIC_SENTRY_DSN` inlines as
  `undefined`, Sentry initialises with no DSN, and the build, the bundle and the
  deploy all still look healthy — the exact silent failure
  `tools/check-observability.ts` exists to catch. Renaming the variables instead
  was rejected because the values are already configured in the Netlify UI.
- **The parity gate had a shelf life, and it expired.** Its baseline was an
  archived Astro build, so once that baseline was gone `ssg/parity.ts` was a
  historical record of a clean migration rather than a live gate. That is what
  happened: no checkout had a baseline, regenerating one meant installing ~2,200
  Astro-era packages, and the gate was never in CI in the first place — so it
  had quietly become a documented instruction nobody could follow. It was
  replaced on 2026-08-07 by `ssg/snapshot.ts` (see _Status_).
  **The lesson generalises: a verification baseline that lives outside the
  system it checks will eventually stop being regenerable.** If a future gate
  needs an oracle, plan its expiry at the same time as its adoption.
- **The route registry must be maintained by hand.** A new page that nobody adds
  to `ssg/routes.ts` is simply not built, and nothing fails. That is the stated
  trade for having one file that tells you what the site emits.

### Carried over unchanged

- **The root `typescript-classic` alias (`npm:typescript@6.0.3`) stays.** It is
  not Astro residue: `tools/check-architecture.ts` and
  `packages/salvageunion-reference/tools/generateApiReport.ts` both import it for
  the TypeScript 6 compiler API. Astro was never its only consumer, and deleting
  it during an "Astro leftovers" sweep breaks both tools.

  > **Amended (2026-08-05, post-Astro streamline).** Still true, but for ONE
  > consumer rather than two. `generateApiReport.ts` moved to the repo's
  > TypeScript 7: it only ever needed the `tsc` **binary** (it drives the
  > compiler through `--project`, never the API), and TS 7 emits the same 427
  > public symbols for that report. `tools/check-architecture.ts` cannot follow
  > and remains the sole consumer — TS 7's `typescript` entry point exports only
  > `lib/version.cjs`, and its replacement `typescript/unstable/*` API is
  > Project/Snapshot-based with no single-file `createSourceFile`/`forEachChild`
  > to walk. The alias goes when that API stabilises, not before.
- No auth, no backend, no user data; Netlify static deploy with no functions.
  [ADR-030](ADR-030-accounts-games-server-of-record.md) explicitly leaves `srd`
  public and login-free.
- Read-only choices ([ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md))
  and the CSP-safe jitless Zod constraint
  ([ADR-013](ADR-013-csp-zod-jitless.md)) are untouched. The per-page island
  props blob is `type="application/json"`, not executable script.
- New interactive features are still scoped as islands rather than turning the
  site into an SPA — ADR-012's closing constraint survives its framework.
- `tools/check-doc-drift.ts` now tracks **Vite's** major for `apps/srd` where it
  tracked Astro's, so a stale "Vite N" claim in the docs still fails CI.
