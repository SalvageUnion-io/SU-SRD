# ADR-012: `srd` as an Astro Static Site with React Islands

## Status

Accepted

> **Note (2026-08-03):** the decision here is "**Astro, static, React islands**" —
> the major version is incidental to it. `srd` was on **Astro 5** when this was
> written; it runs **Astro 7** today (`apps/srd/package.json`; upgrade record in
> [`plan-docs/upgrade-astro-7.md`](../../plan-docs/upgrade-astro-7.md), merged in
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
