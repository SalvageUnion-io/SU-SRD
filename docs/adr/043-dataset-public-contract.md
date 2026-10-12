---
status: accepted
---

# ADR-043: The Dataset Is a Versioned Public Contract at `api.salvageunion.io`

## Status

**Accepted; not built** (2026-10-10). Amends [ADR-014](014-dataset-json-api.md); amends
[ADR-040](040-dataset-served-verbatim.md). The planned `apps/api` ships after the prerequisites
listed under Decision 9.

## Context

[ADR-014](014-dataset-json-api.md) made srd's JSON API the dataset's only public interface,
and [ADR-040](040-dataset-served-verbatim.md) made it serve the committed files byte for byte. The
2026-10-10 dataset audit found that what this serves is not a contract:

- **There is no version and no stability promise.** In the 90 days to
  2026-10-10, 19 commits changed `schemas/`. Some removed fields (#1203,
  #1264), and nothing compares an old schema with a new one.
- **There is no catalog.** `/schema/index.json` returns 404. A consumer copies
  the 24 schema ids from `/api`.
- **Rows carry no slug.** The item URL is derived from the display name, so a
  consumer has to re-implement `nameToSlug()`, and fixing a misspelt name breaks
  the URL. The slug is also the only ref ITUN stores in players' Convex records.
- **References don't resolve.** Abilities, systems and chassis name rows in
  `actions` and `ability-tree-requirements`, but both are meta schemas, so srd
  doesn't serve them. `actions.json` is the largest file in the dataset.
- **The schemas are hard to consume.** They are draft-07 and fully inlined
  (802 KB, 60% of the data's size), and every `title` is the bare id.
- **No edition is recorded.** `sources.version` exists, but no row sets it, so
  a `page` cannot be tied to a printing.

Measured, the whole dataset is 194 KB over the wire as one brotli-compressed
`all.json`. A static file tree serves it, with no pagination, query server or
search back-end.

The owner has decided three questions that shape the contract:

1. **Licence.** The Salvage Union Open Game Licence 1.0b (the package's
   `LICENCE`) permits serving the verbatim rules text as a public reference
   API. The Required Legal Text goes on every surface, and artwork is excluded.
2. **Edition.** The latest editions are canonical: Workshop Manual (core) 2.0a,
   False Flag 2.0a, Rainmaker 2.0a, We Were Here First! 2.0, and the Starter
   Set booklets, Reclamation of the Wastes, Relics of a Time Gone By,
   Thatcher's Mech Base and The Hive at 1.1. Local text exists for every one
   of them, and for Mech Monday.
3. **Scope.** v1 publishes only what the dataset already captures. A new kind
   of entity, such as encounter tables, would be a new schema type and is out
   of scope for v1.

## Decision

1. **Host.** The contract is served at `https://api.salvageunion.io` by the
   planned `apps/api`, a Worker on Workers Static Assets. Every hit is a static
   file, so a hit runs no script and stays off the shared Free-plan request
   quota. The Worker script answers misses only, copying srd's
   `apps/srd/src/worker/index.ts`: a 404 with `cache-control: no-store`,
   wrapped in `withObservability`. One Bun emitter builds both this tree and
   srd's `/schema/*` endpoints from the package's committed files, so both
   read the same rows, though each host serves its own shape of them. There is no query Worker and no `?expand=`:
   each would count every request against the quota and parse about 1 MB on a
   cold start. A reference is resolvable from static files instead.
2. **URL layout.** Every path is under the major version except the
   discovery and licence pages:

   | Path | Serves |
   | --- | --- |
   | `/` | An HTML landing and docs page, generated from the schemas' descriptions |
   | `/v1/index.json` | The catalog: each schema's id, title, description, row count, and data and schema URLs, plus `dataRevision`, `editions` and `licence` |
   | `/v1/{schema}.json` | A bare array of the schema's rows, each carrying its stored `slug`; it validates against the schema below |
   | `/v1/{schema}/{slug}.json` | One row |
   | `/v1/{schema}.schema.json` | JSON Schema 2020-12. Its `$id` is this URL, it references shared `$defs`, and titles come from the registry |
   | `/v1/all.json` | The catalog fields and every schema's rows, in one file |
   | `/v1/openapi.json` | OpenAPI 3.1, referencing the schema files above |
   | `/llms.txt` | Machine discovery, naming only URLs the build emitted |
   | `/licence` | The SU OGL 1.0b and its Required Legal Text |

   `dataRevision` is a hash of the served data in a canonical serialization
   (sorted keys, no whitespace), so it changes when, and only when, a served
   value changes. `editions` lists each source's `sources.version`. Every
   served file carries
   `Link: <https://api.salvageunion.io/licence>; rel="license"`, set in
   `_headers`, together with `Access-Control-Allow-Origin: *`. The miss
   Worker's 404s do not, because `_headers` is not applied to them.
3. **What `/v1` promises.** The shape is stable for as long as `/v1` is
   served:
   - **Additive changes ship in place.** These are a new schema, a new row, a
     new optional field, a new `$defs` entry, or a new enum member. Consumers
     must ignore fields they don't know and tolerate enum values they don't
     know, and the docs say so. So the `/v1` schemas leave objects open (no
     `additionalProperties: false`): a consumer validating with a schema it
     already holds accepts a row that gained a field.
   - **Data corrections ship in place.** A fixed stat or a corrected prose
     string is data, not shape, and `dataRevision` identifies it.
   - **A breaking change opens `/v2`.** The contract is read-only, so a
     change breaks it when a reader written against the old shape could
     misread the new one: a removed or renamed field, a field that stops
     being always present (it becomes optional or nullable), a changed or
     wider type, a removed enum member, a moved URL, or a published slug that
     disappears without an alias. When `/v2` opens, `/v1` is frozen: it keeps being
     served from its last build, its data no longer changes, and both catalogs
     state the date it ends, no sooner than six months later.
   - **A gate enforces it.** A schema-diff gate, modelled on
     `client-contract` ([ADR-042](042-mid-tab-updates.md) decision 3), compares the public
     schemas with a committed snapshot. It classifies each change as additive
     or breaking and fails a breaking change to a served major version.
4. **Slugs are stored and immutable.** Every published row stores a `slug`,
   validated by pattern and unique within its schema. Once published, a slug
   never changes. A renamed row keeps its slug, and a row whose slug must go
   lists the old one in `formerSlugs`, which the build serves as a 301 to the
   current item URL. A reference is `{schema, slug}`, because slugs are unique
   only within a schema (397 collide across schemas). The API may add an
   `href`. Once slugs are stored, a name can be corrected to the printed text
   without breaking a URL or a player's record. `printedNameDeviations.ts`
   exists to prevent that breakage today.
5. **Publication scope.** `/v1` publishes every schema except the
   presentation-only ones. That adds `actions` and
   `ability-tree-requirements`, which other schemas reference but srd doesn't
   serve, to the 24 srd serves. Fields that exist only to lay out srd and ITUN
   (`entityLayout`, `guideTone`, `hidden`, `paperOnly`, `lead`, `hint`,
   `flavor`) and the `catalog-categories` schema move to an overlay keyed by
   `{schema, slug}`. The apps read the overlay, and the API doesn't serve it.
   No field exposes artwork: no `hasArtwork`, and no `assets.salvageunion.io`
   URL. Mech Monday's patterns ship in v1 tagged as homebrew (#1311). The tag
   marks community-submitted content, so a consumer can tell those patterns
   apart from printed ones.
6. **Licence on every surface.** The Required Legal Text is in
   `/v1/index.json` (`licence`), in `/v1/all.json`, on `/licence` and the docs
   page, in `llms.txt`, and in the `Link` header on every response. The
   licence PDF in the package becomes the 1.0b text that the package's
   `LICENCE` already names.
7. **Edition.** Each `sources` row records its canonical printing in
   `version`: core, False Flag and Rainmaker `2.0a`, We Were Here First! `2.0`,
   and `1.1` for the Starter Set, Reclamation of the Wastes, Relics of a Time
   Gone By, Thatcher's Mech Base and The Hive. Mech Monday has no printing to
   record. The catalog's `editions` exposes it, and a row's `page` cites that
   printing.
8. **srd's `/schema/*` is the legacy contract.** It stays served, unversioned,
   as [ADR-040](040-dataset-served-verbatim.md) defines it: the current committed files, verbatim,
   with `$id`s on `salvageunion.io`. It promises no stable shape and gets no
   new endpoints. Its shape follows the dataset, including the reshaping in
   Decision 9. srd's `/api` page and `llms.txt` point consumers at
   `api.salvageunion.io`.
9. **Prerequisites.** `/v1` opens only after the schema work it depends on.
   Each item is its own stack, and each is designed in its own PR, not here:
   - **Stored slugs.** A `slug` and `formerSlugs` on every row, and a gate that
     fails when a published slug disappears without an alias.
   - **Typed refs.** Refs become `{schema, slug}`, declared in the Zod schema,
     and one generic walker resolves every declared ref. This replaces the
     hand-kept list of paths in the validator.
   - **An explicit primary action.** An entity names its action instead of
     sharing a display name with it, and actions get a scoped key instead of
     suffixed names such as "Bio-Rifle (Equipment)".
   - **Discriminated unions.** Content blocks, classes and choice effects get a
     declared discriminator instead of one inferred from shape.
   - **Public JSON Schema output.** 2020-12 with shared `$defs`, and titles and
     the `meta` flag read from the registry.
   - **The presentation overlay**, from Decision 5.
   - **The schema-diff gate**, from Decision 3. It starts recording once
     `/v1` opens.
   - **Edition rows and licence PDF.** `sources.version` is filled, and the
     1.0a PDF is replaced.

   Any rename that the schema work wants (the audit's glossary) lands before
   `/v1` opens: after that, a rename costs a `/v2`. Then the planned
   `apps/api` is wired into `tools/check.ts`, CI's path filters,
   `deploy-surfaces.ts`, `smoke-production.sh` and
   [services](../ARCHITECTURE.md#services-and-agent-tooling).
10. **Every source is verifiable, so there is no `verified` field.** Mech
    Monday's text is local: Leyline's blog posts, the compilation PDFs for
    Mule, Mazona, Spectrum, Thresher, Bobcat, Goliath and Gatecrasher, and
    the Goliath template. Its patterns are verified against that text like
    any other source's. The five Scrapper patterns exist only as an image, so
    they are checked by hand and are not flagged.

## Consequences

- An outside developer gets one stable, versioned, self-describing tree: a
  catalog to start from, refs that resolve, and slugs to key on.
- srd's `/schema/*` keeps working. Its consumers get no stability promise
  beyond [ADR-040](040-dataset-served-verbatim.md)'s, and the docs direct them to `/v1`.
- The emitter is shared, so a row reaches both hosts through the same code,
  but each host has its own shape. The legacy tree is the committed files, and
  the `/v1` tree is the contract.
- The package keeps version `0.0.0` and has no changelog
  ([ADR-040](040-dataset-served-verbatim.md) decision 3). A consumer reads the contract's version
  from the URL's major version, and a data change from `dataRevision`.
- A breaking schema change now costs a `/v2` and a frozen `/v1` for at least
  six months. The prerequisites are ordered so the breaking changes they need
  land before the promise starts.
- The 2026-10-10 audit checked against the 1.2 and 1.1 printings. Its page,
  stat and prose findings need re-checking against the canonical editions,
  now that their text is local.
- A new public Worker hostname adds a deploy surface, a smoke target and a
  row in the services table.
