# ADR-025: Versioned Internal Releases + Public-Surface Gate for `salvageunion-reference`

## Status

Accepted. **Partially supersedes [ADR-014](ADR-014-json-api-public-interface-npm-retired.md)**
(the CHANGELOG-freeze clause only; ADR-014's no-npm stance is preserved).

## Context

[ADR-014](ADR-014-json-api-public-interface-npm-retired.md) established that the
dataset's public distribution is the **served JSON API** (`apps/suref-web`
`/schema/*.json` + `.schema.json` + item endpoints + `api.astro`/`llms.txt`),
retired npm publishing, kept the package **`private: true`, workspace-internal**
(consumed only via `workspace:*` TypeScript source, no build step), and
**froze** `packages/salvageunion-reference/CHANGELOG.md` "since there is no
future npm release for it to document." `bun run build:package` regenerates
`schemas/*.schema.json` + registry codegen from the Zod sources, and a CI
`build-package` job fails on any generated-file drift.

Two new goals motivate this decision:

1. Give the ref **formal (internal) versioned releases** so its changelog can
   participate in the sites' on-site release history
   ([ADR-024](ADR-024-derived-release-changelogs.md)) — a dataset update _is_
   user-visible "what's new" on both sites.
2. **Gate the ref's public surface** on that version. The public surface is the
   exported **TypeScript API** (models/types consumed via `workspace:*`) **and**
   the generated **JSON schemas** (already the served public API per ADR-014).

**The load-bearing nuance:** because apps consume the ref as TS **source** via
`workspace:*`, they always compile against `HEAD` — a version _number_ does
**not** gate consumers at build or runtime. The real gate is a **committed
surface snapshot that CI diffs** (the exact mechanism the `build-package` job
already uses for schemas). The version is the human-facing label a release
attaches to an _acknowledged_ surface change, not itself an enforcement
mechanism.

## Decision

- **The ref becomes a release-please component** (in the shared
  [ADR-024](ADR-024-derived-release-changelogs.md) config), versioned with a
  maintained `CHANGELOG.md`. This **unfreezes** the CHANGELOG that ADR-014
  froze — but does **not** resume npm publishing. The package stays
  `private: true`, workspace-internal; ADR-014's core stance (the JSON API is
  the public distribution, no npm) is preserved. Only ADR-014's
  changelog-freeze clause is superseded.

- **Public-surface gate = a committed API report, CI-diffed.** A snapshot of
  the ref's exported TypeScript surface is committed
  (`etc/salvageunion-reference.api.md` via `@microsoft/api-extractor`, or a
  normalized `.d.ts` snapshot if TS7 toolchain compatibility forces the
  fallback — see Consequences). Its generation **folds into `build:package`**,
  and the existing **`build-package` CI drift job's diff check is extended to
  the report path**. A change to the public TS surface **fails CI** until the
  report is regenerated and committed — and that commit is a release-worthy
  conventional commit, so release-please attaches a version bump + changelog
  entry. The JSON-schema surface is **already** gated by the same job.
  Together: **TS exports + JSON schemas are both gated**, in one command
  (`build:package`) behind one job (`build-package`).

  The chain is: _change the public surface → regenerate + commit the report
  (CI-enforced) → that commit is a `feat:`/`fix:` release-please turns into a
  version + changelog entry._ No bespoke "did you bump the version?" check is
  needed — the report **is** the forced acknowledgement, and the release falls
  out of it.

- **Seed version `2.3.5`** — the local `package.json` source-of-record per
  ADR-014 — with `bootstrap-sha` at the adopting commit. The orphaned npm
  `2.4.0` (an out-of-band publish outside this repo's history, per ADR-014) is
  ignored, consistent with ADR-014.

- **Optional, not in this decision's required scope:** the served JSON API
  (`api.astro`/`llms.txt`) may now surface the ref version so external
  consumers know which dataset version they fetched. Noted as a follow-on.

## Consequences

- The ref's **public TS surface can no longer change silently** — CI forces an
  acknowledged, released change. This closes the gap ADR-014 left: schemas were
  drift-checked, but the TS export surface was not.
- ADR-014's version-discrepancy note is **resolved forward** — local `2.3.5`
  becomes the live source-of-record and advances from there under
  release-please. npm's orphaned `2.4.0` remains untouched and unpublished-to
  (still out of scope).
- **Tooling risk:** `@microsoft/api-extractor` is built on the TypeScript
  compiler API and may not yet support the **TS7** compiler the repo runs
  (the repo already keeps a TS6 `typescript-classic` foothold for exactly this
  class of lag). The fallback is a committed, normalized `.d.ts` snapshot. The
  **gate is identical either way** (a CI diff of a committed surface file); only
  the report _format_ differs. The implementation resolves this early and
  falls back if needed.
- The ref's changelog now appears in **both sites' `/changelog`**
  ([ADR-024](ADR-024-derived-release-changelogs.md) merge), so a data update
  reads as "what's new" on the sites — the primary user-facing benefit.
- `build:package` becomes slightly slower (it now also emits declarations +
  the report). Accepted: it is a dev/CI tool step, not a hot path, and keeping
  one command + one gate matches the least-processing goal.
