# ADR-053: The Dataset API v1 at salvageunion.io/api/v1

Decided and built for 4.1.0.

- **Supersedes** ADR-043 decision 1 as ADR-047 left it: the versioned API lives
  on the main host at `/api/v1`, not on `api.salvageunion.io`.
- **Amends** ADR-040: `/schema/*` stays, byte for byte, as the unversioned
  alias of v1. ADR-043's other decisions (static files emitted from the
  committed data, no query Worker, a published slug never dies) stand.

### 1. The address

`salvageunion.io/api/v1/`, served by the one Worker (ADR-050) from the same
`dist/` as every page. No new host, zone, certificate or Worker. `/api/` stays
the human documentation page.

### 2. What v1 serves

Static files, emitted by `apps/web/src/reference/endpoints/apiV1.ts`:

| URL | Body |
|---|---|
| `/api/v1/index.json` | the manifest: version, docs, licence, stability, and per schema its name, item count, `sha256` of its data, and its URLs |
| `/api/v1/<schema>.json` | `data/<schema>.json` verbatim |
| `/api/v1/<schema>.schema.json` | the generated JSON Schema, `$id` set to this URL and nothing else changed |
| `/api/v1/<schema>/<slug>.json` | one entity, as `/schema/<schema>/item/<slug>.json` |

The schemas are `getEntitySchemas()`, the set every surface publishes. A miss
under `/api/v1` is a JSON 404 from the Worker, never the HTML page. Headers
are `/schema/*`'s: CORS open, one hour plus stale-while-revalidate.

### 3. The stability promise

Within v1 a change only adds: new schemas, new optional fields, new entities,
corrected text. A field is never removed, renamed or retyped; a slug that
moves 301s from its old URL (`_redirects`, as for pages). A breaking change is
`/api/v2/`, served beside v1. The manifest's hashes let a client see what
changed without downloading it. `apiV1.test.ts` holds v1 to `/schema/` and to
its own manifest.

### 4. No release stream

ADR-041 holds: the deployed commit is the release, so the manifest carries no
dataset version or date, only content hashes. The `/api/` page states the
promise; nothing is published to a package registry (ADR-014).
