# ADR-014: Dataset Public Interface Is the JSON API; npm Publishing Is Retired

## Status

Accepted

## Context

`packages/salvageunion-reference` was historically published to npm (133
versions exist on the registry, latest `2.4.0` at the time of writing). The
package ships TypeScript source directly and has no compile step
([ADR-011](ADR-011-component-lib-source-no-build.md) established this pattern
for `component-lib`; `salvageunion-reference` follows the same shape) — `bun run
build:package` only regenerates `schemas/*.schema.json` from the Zod source
([ADR-005](ADR-005-reference-data-orm.md)). Publishing TypeScript source to
npm as a library was never a good fit for external consumers, and the repo
owner has decided to stop publishing it altogether.

Since `apps/srd` added `/schema/v1` JSON API endpoints (#107), it has
served the same dataset publicly as a CORS-enabled JSON API — one JSON
document and one JSON Schema document per schema, plus per-item lookups:

- `apps/srd/src/pages/schema/[schemaId].json.ts` — full dataset for a
  schema
- `apps/srd/src/pages/schema/[schemaId].schema.json.ts` — the schema's
  JSON Schema
- `apps/srd/src/pages/schema/[schemaId]/item/[itemId].json.ts` —
  single-item lookup
- `apps/srd/src/pages/api.astro` — human-readable documentation of the
  above, plus `llms.txt` for machine discovery

This API requires no install, no auth, and no build step — it is strictly
easier for an external consumer to use than an npm package that ships raw
TypeScript. The package's own `README.md` already documents a deprecation
notice pointing at this API, and `package.json` is already `private: true`.
However, that notice only exists in the repository; it is not reflected on
the live npm registry listing (fixing that requires the repo owner's own npm
publish credentials to run `npm deprecate`, which is a separate manual step
outside this decision's scope).

**Version discrepancy, noted here for the record (not "fixed" by this ADR):**
the local `package.json` `version` field reads `2.3.5`, but the npm
registry's latest published version is `2.4.0` — local is _behind_
published. The full git history of `packages/salvageunion-reference/package.json`
(across all branches) never contains the string `2.4.0`; the version field
progresses `2.3.4` → `2.3.5` and stops there locally. There is also no
npm-publish workflow anywhere in `.github/workflows/` — every one of the 133
versions on the npm registry was published by hand (`npm publish`), never by
CI. The npm-published `2.4.0` package metadata's `repository` field points to
`alxjrvs/salvageunion-data`, a standalone repo that now 404s on GitHub —
different from (and older than) the `SalvageUnion-io/SU-SRD` URL already
correct in the local `package.json`. Taken together, this indicates
`salvageunion-reference` originated as a standalone repo
(`alxjrvs/salvageunion-data`) later absorbed into this monorepo, and `2.4.0`
was published by hand from that old standalone checkout (or some other
out-of-band location) after the absorption — it was never synced back into
`SU-SRD`'s git history. Local `2.3.5` is the accurate source-of-record for
this repository; `2.4.0` on npm is an orphaned publish from outside this
repo's history. This ADR does not change the local `version` field.

## Decision

- The dataset's public interface is the `srd` JSON API, not an npm
  package. External consumers should fetch
  `https://salvageunion.io/schema/{schemaId}.json` (and the sibling
  `.schema.json` / item endpoints), not `npm install salvageunion-reference`.
- `packages/salvageunion-reference` remains a **private, workspace-internal**
  module, consumed only via the `workspace:*` protocol by other packages in
  this monorepo. It is not published to npm going forward.
- npm-publish-only metadata in `packages/salvageunion-reference/package.json`
  (`files`, `keywords`, `engines`, `repository`, `bugs`, `homepage`, `author`)
  is removed as dead weight, since it has no effect once the package is never
  packed or published. `private: true`, `description`, `license` (and the
  `LICENCE` file, which remains legally load-bearing regardless of
  distribution channel), and the `exports` map remain — they are load-bearing
  for the workspace-internal resolution path or otherwise still useful.
- The package's `CHANGELOG.md` is frozen as a historical record (see the note
  added at its top) rather than deleted or continued, since there is no
  future npm release for it to document.
- Actually deprecating the live npm registry listing (`npm deprecate
salvageunion-reference`) is **out of scope for this decision** — it
  requires the repo owner's own npm publish credentials and is being handled
  separately.

## Consequences

- Documentation (`docs/architecture/package-contracts.md`, this ADR) now
  matches the package's actual `package.json` shape: no `dist/`, no build
  step, no npm distribution.
- External consumers have one clear, always-current integration path (the
  JSON API) instead of two (a stale npm package and the API).
- The npm registry listing for `salvageunion-reference` is not touched by
  this change — `npm install salvageunion-reference` will continue to
  silently succeed against the last-published version until the repo owner
  runs `npm deprecate` themselves. This is a known gap, not an oversight.
- The version-field discrepancy (`2.3.5` local vs. `2.4.0` published) is
  explained (an orphaned out-of-band publish predating or bypassing this
  repo's history — see above) but not "fixed": the local field is left as-is
  rather than bumped to match a publish this repo's history never produced.
