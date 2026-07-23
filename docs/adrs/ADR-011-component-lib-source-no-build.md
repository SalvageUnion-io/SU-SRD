# ADR-011: `component-lib` Ships as TypeScript Source (No Build Step)

## Status

Accepted

## Context

`component-lib` is the shared component library consumed by both `srd`
(Astro) and ITUN (Vite). A conventional library would compile to `dist/` and
publish built artifacts. In a Bun workspace where every consumer already runs a
bundler that understands TypeScript, a build step for the shared package adds a
rebuild-before-consume cycle, a source-of-truth split between `src/` and `dist/`,
and a class of "stale build" bugs.

## Decision

`component-lib` has **no build step**. It exports TypeScript source directly:
`package.json` `exports` points `"."` at `./src/index.ts`, and consumers import
the `.ts`/`.tsx` source, which their own Vite/Astro pipeline compiles.

- React and other shared libraries are **peer dependencies**, so consumers
  control the versions and the dependency tree isn't duplicated.
- The package stays **data-source agnostic** — it depends on `salvageunion-
reference` types but knows nothing about IndexedDB, snapshots, or persistence
  (consumers inject behavior via slot props; see
  [ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md) and
  `docs/architecture/display-system.md`).

This is **deliberately different** from `salvageunion-reference`, which _does_
build ([ADR-005](ADR-005-reference-data-orm.md)) because it generates JSON Schema
and ships compiled output.

## Consequences

- Edit a component and consumers see it immediately — no rebuild, no stale
  `dist/`.
- No published artifact and no `dist/` to keep in sync; `src/index.ts` is the
  single source of truth.
- Consumers must include `component-lib`'s source in their compile/Tailwind
  `@source` paths; a missing path shows up as untyped imports or unstyled
  components (a known gotcha when wiring a new consumer).
- Peer deps mean a consumer that omits a required peer (React, etc.) fails at
  install/resolve time rather than shipping a duplicate copy.
