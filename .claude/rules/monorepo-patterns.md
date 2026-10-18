---
paths:
  - '**/package.json'
  - 'bunfig.toml'
  - 'knip.json'
---

# Monorepo Patterns

- Every workspace is `"private": true`: nothing is published to npm (the
  dataset's public interface is the served JSON API).
- Workspace dependencies use `workspace:*`; one version, one place:
  [dependencies](../../docs/ARCHITECTURE.md#dependencies) (root `catalog:` /
  root devDependency). Add a dependency from inside its workspace's directory.
- Never add `ref-generate` to another workspace's script: the root `typecheck`
  runs it once (`packages/salvageunion-reference/CLAUDE.md`).
- Test scripts: `--parallel=N --no-isolate` is the measured win; bare
  `--parallel` / `--isolate` measured slower. `test:coverage` stays serial;
  `apps/web`'s shards are explained in `tools/run-coverage.ts`.
