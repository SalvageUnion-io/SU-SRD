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
  ([ADR-014](../../docs/ARCHITECTURE.md#decisions):
  the dataset's public interface is the served JSON API).
- One version, one place: a dev tool more than one workspace runs is a root
  devDependency, and a runtime package more than one workspace imports is a
  root `workspaces.catalog` entry, named `catalog:` per manifest
  ([declare what you import](../../docs/ARCHITECTURE.md#areas)).
- Workspace dependencies use the `workspace:*` protocol
  (e.g. `"salvageunion-reference": "workspace:*"`).
- Run `bun install` from the root to install for all workspaces.
- Add a dependency to a specific workspace by `cd`-ing into that package
  directory first. No bot updates the manifests; see
  [dependencies](../../docs/ARCHITECTURE.md#areas).
- A `workspace:*` dependency also has to appear in that app's CI path filter, or
  a change to it silently skips the app's build job. The `workflows` check
  (`tools/check-workflows.ts`, its `path-filters` half) asserts this from the manifests, so you will be told rather than bitten.

## Dependencies

Read [dependencies](../../docs/ARCHITECTURE.md#areas) before touching a
`package.json`, `bunfig.toml` or `overrides`. Bun deps are updated by hand,
Actions by Dependabot; `bun run audit` (any severity, no `--ignore`) gates every
PR that changes `bun.lock` or a `package.json` and runs nightly; `bunfig.toml`
refuses versions under three days old and makes `bun add` pin exactly.

## Test-script flags

Bare `--parallel` and `--isolate` stay banned: both measured slower than serial
(`--parallel` implies `--isolate`). `--parallel=N --no-isolate` is the measured
win (the itun, srd and component-lib `test` scripts); `--changed` is the other
flag that helps. Keep each `test:coverage` process serial: `--parallel`
coverage writes different lcov line counts. ITUN runs as fixed serial shards
(`SHARDS` in `tools/run-coverage.ts`) whose lcov `tools/lib/lcov.ts` merges
back to a serial run's exact `DA` lines; diff the merge against one serial run
on the same commit, per file, before changing the split or the shard count.

## Generated files

Generated files — `routeTree.gen.ts` from TanStack Router, `schemas/*.schema.json`
and `lib/generated/` in `salvageunion-reference` — are lint-ignored and must not
be hand-edited. `Edit(...)` deny rules in `.claude/settings.json` block edits to them,
and `bun run check generated` (`tools/check-generated.ts`) fails on drift of the
committed ones — locally, at pre-push and in CI. The reference package's
`schemas/*.schema.json` and `lib/generated/` are gitignored instead: never
commit them; `packages/salvageunion-reference/tools/ensureGenerated.ts` rebuilds them (postinstall, typecheck,
build, the test preload).
