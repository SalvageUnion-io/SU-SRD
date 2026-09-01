# Monorepo Patterns

Bun workspace conventions that are **not** stated in the root `CLAUDE.md`.

> This file used to restate the workspace roster, the dependency graph, the
> no-build-step note, the `dev:watch` alias and the import conventions — all of
> which root `CLAUDE.md` already carries, and both load into the same session,
> so that block cost its context twice. It had also begun to drift: its
> workspace list omitted the `su-assets` derivative detail `CLAUDE.md` carries.
>
> What survives here is the part that lives nowhere else. For everything
> removed, `CLAUDE.md` is the single source — and for the import rule,
> `biome.jsonc` is, since it is enforced at `error` rather than merely written
> down.

## Bun workspace conventions

Following [Bun workspace conventions](https://bun.com/docs/guides/install/workspaces):

- Root `package.json` is `"private": true` to prevent accidental publishing. So
  is every workspace — nothing here is published to npm
  ([ADR-014](../../docs/adrs/ADR-014-json-api-public-interface-npm-retired.md):
  the dataset's public interface is the served JSON API).
- Each package is self-contained with its own dependencies.
- Workspace dependencies use the `workspace:*` protocol
  (e.g. `"salvageunion-reference": "workspace:*"`).
- Run `bun install` from the root to install for all workspaces.
- Add a dependency to a specific workspace by `cd`-ing into that package
  directory first — but if two or more manifests end up needing it, it belongs
  in `workspaces.catalog` instead. See
  [`docs/architecture/dependency-management.md`](../../docs/architecture/dependency-management.md).
- A `workspace:*` dependency also has to appear in that app's CI path filter, or
  a change to it silently skips the app's build job. `tools/check-path-filters.ts`
  asserts this from the manifests, so you will be told rather than bitten.

## Generated files

Generated files — `routeTree.gen.ts` from TanStack Router, `schemas/*.schema.json`
and `lib/generated/` in `salvageunion-reference` — are lint-ignored and must not
be hand-edited. `.claude/hooks/protect-generated-files.sh` blocks edits to them,
and `bun run check:schemas` fails CI on drift.
