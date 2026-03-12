# JSON API Endpoints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose all salvageunion-reference data and JSON Schema definitions as static `/schema/v1/*` endpoints on the suref-web reference site with CORS headers.

**Architecture:** Add `getJsonSchemaDefinition` and `getAllJsonSchemaDefinitions` utility functions to the reference package (static map of eagerly-imported `schemas/*.schema.json` files), then create three Astro static endpoint files in `apps/suref-web/src/pages/schema/v1/` that enumerate schemas from the catalog and serve JSON at build time. CORS headers are added via Netlify's `public/_headers` file.

**Tech Stack:** Bun, TypeScript, Astro 5 static endpoints, Netlify `_headers`, `salvageunion-reference` ORM

---

### Task 1: Add `schemaDefinitions.ts` to the reference package

**Files:**
- Create: `packages/salvageunion-reference/lib/schemaDefinitions.ts`
- Create: `packages/salvageunion-reference/lib/schemaDefinitions.test.ts`

**Step 1: Write the failing test**

Create `packages/salvageunion-reference/lib/schemaDefinitions.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { getJsonSchemaDefinition, getAllJsonSchemaDefinitions } from './schemaDefinitions.js'

describe('getJsonSchemaDefinition', () => {
  it('returns a JSON Schema object for a known schema ID', () => {
    const schema = getJsonSchemaDefinition('chassis')
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')
    expect(schema['$schema']).toBeDefined()
  })

  it('returns undefined for an unknown schema ID', () => {
    const schema = getJsonSchemaDefinition('nonexistent')
    expect(schema).toBeUndefined()
  })
})

describe('getAllJsonSchemaDefinitions', () => {
  it('returns a map with all 27 schema IDs as keys', () => {
    const all = getAllJsonSchemaDefinitions()
    expect(Object.keys(all).length).toBe(27)
    expect(all['chassis']).toBeDefined()
    expect(all['abilities']).toBeDefined()
    expect(all['roll-tables']).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd packages/salvageunion-reference && bun test lib/schemaDefinitions.test.ts
```

Expected: FAIL — `schemaDefinitions.js` not found.

**Step 3: Write the implementation**

Create `packages/salvageunion-reference/lib/schemaDefinitions.ts`:

```typescript
import abilitiesSchema from '../schemas/abilities.schema.json'
import abilityTreeRequirementsSchema from '../schemas/ability-tree-requirements.schema.json'
import actionsSchema from '../schemas/actions.schema.json'
import bioTitansSchema from '../schemas/bio-titans.schema.json'
import catalogCategoriesSchema from '../schemas/catalog-categories.schema.json'
import chassisSchema from '../schemas/chassis.schema.json'
import classesSchema from '../schemas/classes.schema.json'
import crawlerBaysSchema from '../schemas/crawler-bays.schema.json'
import crawlerTechLevelsSchema from '../schemas/crawler-tech-levels.schema.json'
import crawlersSchema from '../schemas/crawlers.schema.json'
import creaturesSchema from '../schemas/creatures.schema.json'
import distancesSchema from '../schemas/distances.schema.json'
import dronesSchema from '../schemas/drones.schema.json'
import equipmentSchema from '../schemas/equipment.schema.json'
import factionsSchema from '../schemas/factions.schema.json'
import guidesSchema from '../schemas/guides.schema.json'
import keywordsSchema from '../schemas/keywords.schema.json'
import meldSchema from '../schemas/meld.schema.json'
import modulesSchema from '../schemas/modules.schema.json'
import npcsSchema from '../schemas/npcs.schema.json'
import rollTablesSchema from '../schemas/roll-tables.schema.json'
import squadsSchema from '../schemas/squads.schema.json'
import systemsSchema from '../schemas/systems.schema.json'
import traitsSchema from '../schemas/traits.schema.json'
import vehiclesSchema from '../schemas/vehicles.schema.json'
import sourcesSchema from '../schemas/sources.schema.json'
import techLevelsSchema from '../schemas/tech-levels.schema.json'

const SCHEMA_DEFINITIONS: Record<string, Record<string, unknown>> = {
  abilities: abilitiesSchema as Record<string, unknown>,
  'ability-tree-requirements': abilityTreeRequirementsSchema as Record<string, unknown>,
  actions: actionsSchema as Record<string, unknown>,
  'bio-titans': bioTitansSchema as Record<string, unknown>,
  'catalog-categories': catalogCategoriesSchema as Record<string, unknown>,
  chassis: chassisSchema as Record<string, unknown>,
  classes: classesSchema as Record<string, unknown>,
  'crawler-bays': crawlerBaysSchema as Record<string, unknown>,
  'crawler-tech-levels': crawlerTechLevelsSchema as Record<string, unknown>,
  crawlers: crawlersSchema as Record<string, unknown>,
  creatures: creaturesSchema as Record<string, unknown>,
  distances: distancesSchema as Record<string, unknown>,
  drones: dronesSchema as Record<string, unknown>,
  equipment: equipmentSchema as Record<string, unknown>,
  factions: factionsSchema as Record<string, unknown>,
  guides: guidesSchema as Record<string, unknown>,
  keywords: keywordsSchema as Record<string, unknown>,
  meld: meldSchema as Record<string, unknown>,
  modules: modulesSchema as Record<string, unknown>,
  npcs: npcsSchema as Record<string, unknown>,
  'roll-tables': rollTablesSchema as Record<string, unknown>,
  squads: squadsSchema as Record<string, unknown>,
  systems: systemsSchema as Record<string, unknown>,
  traits: traitsSchema as Record<string, unknown>,
  vehicles: vehiclesSchema as Record<string, unknown>,
  sources: sourcesSchema as Record<string, unknown>,
  'tech-levels': techLevelsSchema as Record<string, unknown>,
}

export function getJsonSchemaDefinition(schemaId: string): Record<string, unknown> | undefined {
  return SCHEMA_DEFINITIONS[schemaId]
}

export function getAllJsonSchemaDefinitions(): Record<string, Record<string, unknown>> {
  return SCHEMA_DEFINITIONS
}
```

**Step 4: Run test to verify it passes**

```bash
cd packages/salvageunion-reference && bun test lib/schemaDefinitions.test.ts
```

Expected: PASS — 4 tests pass.

**Step 5: Commit**

```bash
git add packages/salvageunion-reference/lib/schemaDefinitions.ts packages/salvageunion-reference/lib/schemaDefinitions.test.ts
git commit -m "feat(reference): add getJsonSchemaDefinition and getAllJsonSchemaDefinitions"
```

---

### Task 2: Export from the reference package barrel

**Files:**
- Modify: `packages/salvageunion-reference/lib/index.ts`

**Step 1: Add the export**

In `packages/salvageunion-reference/lib/index.ts`, add after the existing exports (e.g., after the `search` export block):

```typescript
export { getJsonSchemaDefinition, getAllJsonSchemaDefinitions } from './schemaDefinitions.js'
```

**Step 2: Build the package and verify it compiles**

```bash
bun run build:package
```

Expected: build completes with no TypeScript errors. If you see errors about JSON imports, add `"resolveJsonModule": true` to `packages/salvageunion-reference/tsconfig.build.json` under `compilerOptions`.

**Step 3: Run all reference package tests**

```bash
bun --filter salvageunion-reference test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/salvageunion-reference/lib/index.ts packages/salvageunion-reference/dist
git commit -m "feat(reference): export schema definition helpers from barrel"
```

---

### Task 3: Create the catalog index endpoint

**Files:**
- Create: `apps/suref-web/src/pages/schema/v1/index.json.ts`

> Note: you'll need to create the `v1/` directory. In Astro, directories under `src/pages/` map to URL path segments — just create the file and the directory will be created.

**Step 1: Create the endpoint**

Create `apps/suref-web/src/pages/schema/v1/index.json.ts`:

```typescript
import { getSchemaCatalog } from 'salvageunion-reference'

export function GET() {
  const catalog = getSchemaCatalog()
  return new Response(JSON.stringify(catalog), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

> This is a static endpoint (no `getStaticPaths` needed — it's a single fixed URL `/schema/v1/index.json`).

**Step 2: Verify it builds**

```bash
bun run build
```

Expected: build succeeds and `dist/schema/v1/index.json` exists in the Astro build output (default `apps/suref-web/dist/`).

**Step 3: Spot-check the output**

```bash
cat apps/suref-web/dist/schema/v1/index.json | head -20
```

Expected: JSON object starting with `{"$schema":...,"schemas":[...` (the catalog content).

**Step 4: Commit**

```bash
git add apps/suref-web/src/pages/schema/v1/index.json.ts
git commit -m "feat(suref-web): add /schema/v1/index.json catalog endpoint"
```

---

### Task 4: Create the raw data endpoint

**Files:**
- Create: `apps/suref-web/src/pages/schema/v1/[schemaId].json.ts`

**Step 1: Create the endpoint**

Create `apps/suref-web/src/pages/schema/v1/[schemaId].json.ts`:

```typescript
import { getSchemaCatalog, getModel } from 'salvageunion-reference'
import type { APIRoute } from 'astro'

export function getStaticPaths() {
  const { schemas } = getSchemaCatalog()
  return schemas.map((schema) => {
    const model = getModel(schema.id)
    const data = model ? model.all() : []
    return {
      params: { schemaId: schema.id },
      props: { data },
    }
  })
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

**Step 2: Build and verify**

```bash
bun run build
```

Expected: build succeeds.

**Step 3: Spot-check two outputs**

```bash
cat apps/suref-web/dist/schema/v1/chassis.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'chassis count: {len(d)}')"
cat apps/suref-web/dist/schema/v1/actions.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'actions count: {len(d)}')"
```

Expected: `chassis count: 49` and `actions count: 611` (counts from the catalog `schemas/index.json`).

**Step 4: Commit**

```bash
git add apps/suref-web/src/pages/schema/v1/'[schemaId].json.ts'
git commit -m "feat(suref-web): add /schema/v1/{schemaId}.json data endpoints"
```

---

### Task 5: Create the JSON Schema definition endpoint

**Files:**
- Create: `apps/suref-web/src/pages/schema/v1/[schemaId].schema.json.ts`

> **Note on double extension:** Astro strips the trailing `.ts` and treats the rest as the URL. So `[schemaId].schema.json.ts` → `/schema/v1/chassis.schema.json`. If this doesn't work (Astro version quirk), the fallback is creating `src/pages/schema/v1/[schemaId]/schema.json.ts` instead, producing `/schema/v1/chassis/schema.json`.

**Step 1: Create the endpoint**

Create `apps/suref-web/src/pages/schema/v1/[schemaId].schema.json.ts`:

```typescript
import { getSchemaCatalog, getJsonSchemaDefinition } from 'salvageunion-reference'
import type { APIRoute } from 'astro'

export function getStaticPaths() {
  const { schemas } = getSchemaCatalog()
  return schemas.map((schema) => {
    const definition = getJsonSchemaDefinition(schema.id)
    return {
      params: { schemaId: schema.id },
      props: { definition },
    }
  })
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.definition), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

**Step 2: Build and verify**

```bash
bun run build
```

Expected: build succeeds.

**Step 3: Spot-check the output**

```bash
ls apps/suref-web/dist/schema/v1/ | grep schema
```

Expected: files like `chassis.schema.json`, `equipment.schema.json`, etc.

```bash
cat apps/suref-web/dist/schema/v1/chassis.schema.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('\$schema','missing'))"
```

Expected: `http://json-schema.org/draft-07/schema#` (or similar draft URL).

**Step 4: Commit**

```bash
git add apps/suref-web/src/pages/schema/v1/'[schemaId].schema.json.ts'
git commit -m "feat(suref-web): add /schema/v1/{schemaId}.schema.json definition endpoints"
```

---

### Task 6: Add CORS headers via Netlify `_headers`

**Files:**
- Modify: `apps/suref-web/public/_headers` (create if it doesn't exist — check first with `ls apps/suref-web/public/`)

**Step 1: Check if `_headers` exists**

```bash
ls apps/suref-web/public/_headers 2>/dev/null && echo "exists" || echo "does not exist"
```

**Step 2: Create or append to `_headers`**

If the file does not exist, create `apps/suref-web/public/_headers`:

```
/schema/v1/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET
```

If the file already exists, append those lines at the end.

> Netlify `_headers` syntax: each URL path rule is followed by indented header lines. The file is copied verbatim to the deploy root and Netlify applies the rules at the CDN edge.

**Step 3: Verify the file lands in the build output**

```bash
bun run build && cat apps/suref-web/dist/_headers
```

Expected: the file contains the `/schema/v1/*` block (Astro copies `public/` to the build output root).

**Step 4: Run full CI check**

```bash
bun run check:all
```

Expected: lint, format, typecheck, tests, validate all pass.

**Step 5: Commit**

```bash
git add apps/suref-web/public/_headers
git commit -m "feat(suref-web): add CORS headers for /schema/v1/* endpoints"
```

---

### Task 7: Final verification

**Step 1: Full build**

```bash
bun run build
```

Expected: no errors.

**Step 2: Enumerate generated endpoint files**

```bash
ls apps/suref-web/dist/schema/v1/
```

Expected: `index.json`, 27× `{schemaId}.json`, 27× `{schemaId}.schema.json`, and `_headers` in `dist/`.

**Step 3: Spot-check a few counts**

```bash
ls apps/suref-web/dist/schema/v1/*.json | wc -l
```

Expected: 55 files (1 index + 27 data + 27 schema definitions).

**Step 4: Verify `_headers` is present**

```bash
cat apps/suref-web/dist/_headers | grep "schema/v1"
```

Expected: `/schema/v1/*` rule present.
