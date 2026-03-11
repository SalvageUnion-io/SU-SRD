# JSON API Endpoints Design

**Date:** 2026-03-11
**Status:** Approved

## Goal

Expose the `salvageunion-reference` package's raw JSON data and JSON Schema definitions as publicly accessible static endpoints on the `suref-web` reference site.

## URL Structure

All endpoints live under `/schema/v1/`:

| Endpoint | Description |
|---|---|
| `GET /schema/v1/index.json` | Catalog of all schemas with metadata |
| `GET /schema/v1/{schemaId}.json` | Raw data array for a schema (e.g. `/schema/v1/chassis.json`) |
| `GET /schema/v1/{schemaId}.schema.json` | JSON Schema definition for a schema (e.g. `/schema/v1/chassis.schema.json`) |

## Architecture

### Approach

Astro static endpoints — three new `.ts` files in `apps/suref-web/src/pages/schema/v1/`. Each uses `getStaticPaths()` to enumerate schemas from the catalog and pass data as props. Astro serializes them to static JSON files at build time. No runtime overhead, no data duplication in the repo.

### Reference Package Changes (`salvageunion-reference`)

Add two new exported functions to `lib/index.ts` (or a dedicated `lib/schemaExports.ts` pulled into the barrel):

```typescript
export function getJsonSchemaDefinition(schemaId: string): Record<string, unknown>
export function getAllJsonSchemaDefinitions(): Record<string, Record<string, unknown>>
```

Implemented as a static map that eagerly imports each `schemas/*.schema.json` file. These files are already committed build output — no new generation step required.

### Astro Endpoint Files (`suref-web`)

Three new files under `src/pages/schema/v1/`:

**`index.json.ts`**
Imports `getSchemaCatalog()` and returns the full catalog as JSON.

**`[schemaId].json.ts`**
- `getStaticPaths()`: enumerates `getEntitySchemas()`, passes `model.all()` as a prop for each schema ID
- `GET()`: serializes the data prop as `application/json`

**`[schemaId].schema.json.ts`**
- `getStaticPaths()`: enumerates `getEntitySchemas()`, passes `getJsonSchemaDefinition(schemaId)` as a prop
- `GET()`: serializes the schema prop as `application/json`

## Scope & Exclusions

- **Included:** All schemas in the catalog, including those marked `meta: true` (actions, ability-tree-requirements, catalog-categories)
- **Excluded:** `schemas/shared/*.schema.json` (common, enums, objects) — not in the catalog, can be added as a follow-up if consumers need them for validation
- **CORS headers required** — endpoints are intended for cross-origin consumption. Add `public/_headers` to the `suref-web` app with `Access-Control-Allow-Origin: *` for `/schema/v1/*`
- **No pagination or filtering** — each endpoint returns the full dataset
- **No new site UI** — purely endpoints, no navigation changes

## CORS Configuration

Netlify static sites support a `public/_headers` file for response headers. Add:

```
/schema/v1/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET
  Content-Type: application/json
```
