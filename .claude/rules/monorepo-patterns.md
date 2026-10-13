---
paths:
  - '**/package.json'
  - 'bunfig.toml'
  - 'knip.json'
---

# Monorepo Patterns

Bun workspace conventions that are **not** stated in [`AGENTS.md`](../../AGENTS.md).

## Bun workspace conventions

Following [Bun workspace conventions](https://bun.com/docs/guides/install/workspaces):

- Root `package.json` is `"private": true` to prevent accidental publishing. So
  is every workspace — nothing here is published to npm
  ([ADR-014](../../docs/ARCHITECTURE.md#decisions):
  the dataset's public interface is the served JSON API).
- One version, one place: see
  [dependencies](../../docs/ARCHITECTURE.md#dependencies) (root `catalog:` /
  root devDependency).
- Workspace dependencies use the `workspace:*` protocol
  (e.g. `"salvageunion-reference": "workspace:*"`).
- Run `bun install` from the root to install for all workspaces.
- Add a dependency to a specific workspace by `cd`-ing into that package
  directory first. No bot updates the manifests; see
  [dependencies](../../docs/ARCHITECTURE.md#dependencies).
- A `workspace:*` dependency also has to appear in that app's CI path filter, or
  a change to it silently skips the app's build job. The `workflows` check
  (`tools/check-workflows.ts`, its `path-filters` half) asserts this from the manifests, so you will be told rather than bitten.

## Test-script flags

Bare `--parallel` and `--isolate` stay banned: both measured slower than serial
(`--parallel` implies `--isolate`). `--parallel=N --no-isolate` is the measured
win: every workspace's `test` script is `bun test --parallel=4 --no-isolate`
(`check test-layout`; Bun reads neither flag from `bunfig.toml`). `--changed`
is the other flag that helps. Keep each `test:coverage` process serial: `--parallel`
coverage writes different lcov line counts. ITUN runs as fixed serial shards
(`SHARDS` in `tools/run-coverage.ts`) whose lcov `packages/gates/lib/lcov.ts` merges
back to a serial run's exact `DA` lines; diff the merge against one serial run
on the same commit, per file, before changing the split or the shard count.

## Generated files

Generated output and where `su-ref-generate` runs:
`packages/salvageunion-reference/CLAUDE.md` (drift: `bun run check generated`).
Never add `su-ref-generate` to another workspace's script: every workspace's
`typecheck` except the reference package's is plain `tsc -b`.
