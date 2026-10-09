---
paths:
  - '**/package.json'
  - 'bunfig.toml'
  - 'knip.json'
---

# Monorepo Patterns

Bun workspace conventions that are **not** stated in the root `CLAUDE.md`.

## Bun workspace conventions

Following [Bun workspace conventions](https://bun.com/docs/guides/install/workspaces):

- Root `package.json` is `"private": true` to prevent accidental publishing. So
  is every workspace — nothing here is published to npm
  ([ADR-014](../../docs/ARCHITECTURE.md#adr-014):
  the dataset's public interface is the served JSON API).
- One version, one place: a dev tool more than one workspace runs is a root
  devDependency, and a runtime package more than one workspace imports is a
  root `workspaces.catalog` entry, named `catalog:` per manifest
  ([declare what you import](../../docs/ARCHITECTURE.md#declare-what-you-import)).
- Workspace dependencies use the `workspace:*` protocol
  (e.g. `"salvageunion-reference": "workspace:*"`).
- Run `bun install` from the root to install for all workspaces.
- Add a dependency to a specific workspace by `cd`-ing into that package
  directory first. No bot updates the manifests; see
  [dependencies](../../docs/ARCHITECTURE.md#dependencies).
- A `workspace:*` dependency also has to appear in that app's CI path filter, or
  a change to it silently skips the app's build job. The `workflows` check
  (`tools/check-workflows.ts`, its `path-filters` half) asserts this from the manifests, so you will be told rather than bitten.

## Generated files

Generated files — `routeTree.gen.ts` from TanStack Router, `schemas/*.schema.json`
and `lib/generated/` in `salvageunion-reference` — are lint-ignored and must not
be hand-edited. `.claude/hooks/protect-generated-files.sh` blocks edits to them,
and `bun run check generated` (`tools/check-generated.ts`) fails on drift —
locally, at pre-push and in CI.
