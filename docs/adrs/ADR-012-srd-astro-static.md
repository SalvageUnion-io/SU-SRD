# ADR-012: `srd` as an Astro Static Site with React Islands

## Status

**Superseded by [ADR-031](ADR-031-srd-vite-ssg.md)** (`srd` builds on an in-house
Vite SSG).

**Astro is gone from this repo.** There are no `.astro` files, no
`astro.config.mjs`, no `astro check` and no `client:*` directives in `apps/srd`;
the site is rendered by the in-house generator at `apps/srd/ssg/`, whose contract
is [`ssg/DESIGN.md`](../../apps/srd/ssg/DESIGN.md). Anything below that names an
Astro file, integration or directive is a historical record of how the site used
to be built, not an instruction.

**What this ADR decided is retained and re-affirmed by ADR-031**, because the
decision was "**static, pre-rendered, no backend, React islands**" and only the
machine producing it changed: static output, island-scoped interactivity, the
`component-lib` + `salvageunion-reference` dependencies, read-only choices
([ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md)), the CSP constraint
behind [ADR-013](ADR-013-csp-zod-jitless.md), the Netlify static deploy, and the
closing rule that new interactive features are scoped as islands rather than
turning the site into an SPA. What ADR-031 overturns is narrower than this
document's title suggests: the **framework**, and with it the TypeScript 6 pin
`@astrojs/check` imposed.

> **Historical note (2026-08-03), preserved:** the decision here was "Astro,
> static, React islands" — the major version was incidental to it. `srd` was on
> **Astro 5** when this was written and ran **Astro 7** when it was superseded
> (upgrade record in
> `plan-docs/upgrade-astro-7.md` (since deleted — it planned an Astro 7
> upgrade for a repo with no Astro left), merged in
> #365). The upgrade changed nothing this ADR decided. The Decision section below
> is preserved as written apart from that version marker.

## Context

The SRD reference site serves a large, fixed catalog of game entities to anyone
on the web. Its priorities are SEO (entity pages should be crawlable and
shareable), fast first paint, and zero operational cost — consistent with the
no-backend posture ([ADR-001](ADR-001-local-first-no-backend.md)). Only a few
parts of the page are interactive (search, the schema viewer, entity display
controls); most of it is static content.

A fully client-rendered SPA would hurt SEO and first paint for a
content-dominant site, while a fully static site couldn't host the interactive
pieces.

## Decision

`srd` is built with **Astro** (v5 when decided, **v7** today — see Status),
pre-rendering all entity reference pages
to static HTML/CSS/JS, with **React 19 islands** for the interactive parts
(search, schema viewer, entity display), hydrated via `client:load` /
`client:visible`.

- File-based routing in `src/pages/` (`/`, `/schema/[schemaId]`,
  `/schema/[schemaId]/item/[itemId]`, `/about`, `/404`).
- Shared UI comes from `component-lib` ([ADR-011](ADR-011-component-lib-source-no-build.md));
  search runs in-memory over the `salvageunion-reference` dataset
  ([ADR-005](ADR-005-reference-data-orm.md)).
- Data shown here is read-only — choices render ephemerally / non-editably
  ([ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md)).
- Deploys to Netlify as a static site (no functions).

## Consequences

- Entity pages are server-pre-rendered: good SEO, fast first paint, and
  cacheable at the CDN edge with no server runtime to operate.
- Interactivity is paid for only where an island exists; the rest ships as static
  HTML.
- The CSP allows inline script/style (needed for Astro hydration and injected
  styles) but denies `eval` — which is one of the constraints behind the CSP-safe
  Zod config ([ADR-013](ADR-013-csp-zod-jitless.md)).
- New interactive features must be scoped as islands rather than turning the site
  into an SPA, to preserve the static-first properties above.
