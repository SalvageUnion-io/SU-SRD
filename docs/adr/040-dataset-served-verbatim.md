---
status: accepted
---

# ADR-040: The Reference Dataset Is Served Verbatim and Has No Release Stream

## Status

**Accepted; built** (2026-10-08, audit-4 P16, #1136). Supersedes
[ADR-025](025-reference-versioned-releases.md); amends [ADR-014](014-dataset-json-api.md) and [ADR-024](024-derived-release-changelogs.md).

**Amended by [ADR-043](043-dataset-public-contract.md) (2026-10-10; not yet built).** Once
`api.salvageunion.io/v1` ships, decisions 1 and 2 govern only srd's legacy
`/schema/*`, which keeps serving the committed files
verbatim with `$id`s on `salvageunion.io`. The public contract is then
`api.salvageunion.io/v1`, whose rows and 2020-12 schemas are emitted rather
than copied, and whose `$id`s are on that host. Decision 3 stands for the
package: it has no release stream, no changelog and version `0.0.0`. The
contract's version is its URL's major version, and a data change is
identified by `dataRevision`.

## Context

[ADR-014](014-dataset-json-api.md) made srd's JSON API the dataset's only public interface.
By audit 4 that API broke its own contract three ways. `/schema/<id>.json`
re-serialised the models, so every row carried the `schemaName` that
`BaseModel` stamps on its copy, and every `/schema/<id>.schema.json` forbids
that key: 4 of 4 sampled datasets failed their own schema. Every schema's `$id`
named `salvageunion.com/schemas/…`, a host that times out. `llms.txt` taught an
item URL that 404'd.

[ADR-025](025-reference-versioned-releases.md)'s release stream for the package had stopped meaning
anything. Release-please attributes a squash commit to every component whose
files it touches, so the live changelog listed ITUN PRs under "Data v2.14.0"
and one PR twice; in 60 days only two refactor commits touched `data/`. Each
data release also redeployed ITUN and pushed Convex, and `deploy-surfaces.ts`
carried two narrowings (the CHANGELOG's readers, a version-only manifest bump)
for those commits alone.

Two tools wrote `data/*.json`: `edit-data`, which edits the text in place, and
`fix:ids`, which rewrote whole files with `JSON.stringify` against the data
rule.

## Decision

1. **The API serves the committed files.** `/schema/<id>.json` and
   `/schema/<id>.schema.json` are the package's `data/<id>.json` and
   `schemas/<id>.schema.json`, byte for byte, read through its `./data/*` and
   `./schemas/*` exports (`apps/srd/src/lib/referenceFiles.ts`). An item
   endpoint serves its committed row, without `schemaName`.
2. **A schema's `$id` is the URL it is served at**,
   `https://salvageunion.io/schema/<id>.schema.json`.
3. **No reference release stream.** The package is not a release-please
   component and has no `CHANGELOG.md`; its version is `0.0.0`, as
   `component-lib`'s is. A data change reaches users through the site that
   renders it.
4. **`edit-data` is the one writer of `data/*.json`.** `edit-data add` mints a
   missing `id`; `validate` reports and never writes.

## Consequences

- Dropping `schemaName` from served rows is a public-API change. A consumer
  that read it already knew the schema from the URL it fetched.
- `apps/srd/src/lib/__tests__/jsonApi.test.ts` validates every emitted dataset
  and item against its emitted schema, checks each `$id`, and checks that every
  concrete `/schema/…json` URL in `llms.txt` is an emitted endpoint.
- A data-only PR appears in neither site's changelog: each lists only its own
  scope ([ADR-041](041-deployed-commit-is-release.md)).
- npm still serves the orphaned `salvageunion-reference@2.4.0`. Deprecating it
  needs the owner's npm credentials (`npm deprecate`), outside this repo.
