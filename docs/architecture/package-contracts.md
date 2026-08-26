# Package Contracts & Dependency Rules

This document defines what each package exposes, what it consumes, and the rules for making cross-package changes.

## Dependency Graph

```
salvageunion-reference (game data ORM, no build step)
  |
  +---> component-lib (shared UI components, no build step)
  |       |
  |       +---> srd (static reference site, in-house SSG at apps/srd/ssg over Vite)
  |       |
  |       +---> itun (character builder, React 19 + Vite)
  |
  +---> discord-bot (standalone, Discord.js)
```

All workspace dependencies use `workspace:*` protocol. React 19.2.0+ is aligned across all packages.

---

## salvageunion-reference

**Location:** `packages/salvageunion-reference/`
**Build required:** No (ships TS source; `bun run build:package` only regenerates `schemas/*.schema.json` from Zod)

### Public Interface

**This package is private and workspace-internal — it is not published to npm.**
It has no npm distribution and is consumed only within this monorepo via the
`workspace:*` protocol. The dataset's actual public interface is the
CORS-enabled JSON API served by `srd`. Those are **endpoint modules**, not
routes: `apps/srd/src/endpoints/schemaJson.ts`,
`schemaDefinitionJson.ts`, `itemJson.ts` (plus `searchIndexJson.ts` and
`llmsTxt.ts`), all registered in `apps/srd/ssg/endpoints.ts` and documented on
the `/api` page at `apps/srd/src/pages/api.page.tsx`. External consumers should
use that API, not `npm install salvageunion-reference`. See
[ADR-014](../adrs/ADR-014-json-api-public-interface-npm-retired.md) for the
full rationale.

### Entry Points

```json
{
  ".": {
    "types": "./lib/index.ts",
    "default": "./lib/index.ts"
  },
  "./rules": {
    "types": "./lib/rules/index.ts",
    "default": "./lib/rules/index.ts"
  },
  "./zod": {
    "types": "./lib/zod.ts",
    "default": "./lib/zod.ts"
  },
  "./schema-definitions": {
    "types": "./lib/schemaDefinitions.ts",
    "default": "./lib/schemaDefinitions.ts"
  },
  "./data/*": {
    "import": "./data/*.json",
    "default": "./data/*.json"
  },
  "./schemas/*": {
    "import": "./schemas/*.json",
    "default": "./schemas/*.json"
  },
  "./package.json": "./package.json"
}
```

Consuming apps resolve `lib/index.ts` directly — there is no `dist/` build and
no `development`/`import` condition split. `./rules` is the pure-math rules
entry point ([ADR-006](../adrs/ADR-006-pure-rules-logic.md)). `./zod` is the
canonical Zod re-export ([ADR-013](../adrs/ADR-013-csp-zod-jitless.md)) — every
other package/app must import `z` from here, never from `zod` directly.
`./schema-definitions` exposes the generated JSON Schema documents
(`getJsonSchemaDefinition` / `getAllJsonSchemaDefinitions`) behind their own
subpath so the ~783 KB schema corpus is never pulled into an app bundle through
the main barrel — only the srd `/schema/[id].schema.json` build route imports it
(enforced by `noRestrictedImports` in the root `biome.jsonc`).

`tools/check-doc-drift.ts` (`bun run validate:all`) fails CI if this block
ever falls out of sync with `packages/salvageunion-reference/package.json`'s
actual `exports` map again — the exact class of drift a prior campaign PR had
to fix by hand.

### Public API

**Static model accessors** (27 models):
`SalvageUnionReference.Chassis`, `.Classes`, `.Abilities`, `.Equipment`, `.Systems`, `.Modules`, `.Drones`, `.Vehicles`, `.Crawlers`, `.CrawlerBays`, `.Creatures`, `.BioTitans`, `.Squads`, `.NPCs`, `.Factions`, `.Keywords`, `.Traits`, `.Distances`, `.RollTables`, `.Meld`, `.Guides`, `.Sources`, `.TechLevels`, `.CatalogCategories`, `.Actions`, `.AbilityTreeRequirements`, `.CrawlerTechLevels`

**Generic accessors:**
`.get(schemaName, id)`, `.exists()`, `.getMany()`, `.findIn()`, `.findAllIn()`

**Reference strings:**
`.parseRef()`, `.getByRef()`

**Metadata (standalone exports from `lib/utilities.ts`, re-exported via the barrel — NOT `SalvageUnionReference` methods):**
`getTechLevel(entity)`, `getTechLevelNumber(entity)`, `getSalvageValue(entity)`

**Search:**
`.search()`, `.searchIn()`, `.getSuggestions()`

**Type exports:**
All entity types (`SURef*`), enum types (`SURefEnum*`), common types (`SURefCommon*`), object types (`SURefObject*`), `SchemaToEntityMap`, `EntitySchemaNames` (runtime Set).

**Utility exports (representative — `lib/index.ts` is the source of truth):**
`nameToSlug`, `getEntitySlug`, `findEntityBySlug`, `getParagraphString`, `replaceChassisPlaceholder`, `parseContentBlockString`, `resultForTable`, `resultForColumnsTable`, `isColumnsTable`, `rollOnTable` (shared roll orchestration with injectable roller — consumed by the Discord bot and ITUN), `BaseModel`, `getDataMaps`, `getSchemaCatalog`, `resolveGrantedEntities`, `resolveChoiceView`

**Choice-resolver types:**
`ChoiceSelections` (`Record<string, string[]>`), `ResolvedChoiceView` (`{ datavalues, traits, prompts }`), `ChoicePrompt`

### Dependencies

- **Runtime:** `zod` (^4.4.3), `jsonc-parser` (^3.3.1)
- **Dev only:** none (`devDependencies` is empty — validation tooling runs on Bun + the runtime deps)

### Generated Files (do not edit)

- `schemas/*.schema.json` — Generated from Zod schemas

To change output: edit Zod schemas in `lib/schemas/`, then `bun run build:package`.

### Lazy-Loading Architecture

All JSON data files (~1.1 MB total) are loaded via dynamic `import()` at runtime, not at module scope. This allows consuming apps to code-split the data corpus.

**How it works:**

1. At module load time, `SalvageUnionReference` creates one `LazyModel<T>` instance per schema. These are stable object references — references captured before `preload()` are still valid after it.
2. `preload()` calls `loadSchemas()` in `ModelFactory`, which fires dynamic imports in parallel for the requested schemas.
3. After each schema loads, the `LazyModel` receives a "backing" model via `_install()`. All subsequent data-access calls delegate to the backing model.
4. Before `preload()`, any data-access call throws a descriptive error.

Zod schemas are still statically imported because they are code (types + validation), not data, and must be available at compilation time.

### preload() API

```typescript
// Load all schemas (safe default for most consumers):
await SalvageUnionReference.preload('all')

// Load only specific schemas (enables code-splitting):
await SalvageUnionReference.preload(['chassis', 'systems', 'modules'])

// Check whether a schema is loaded:
SalvageUnionReference.isLoaded('chassis') // boolean
```

`preload()` is idempotent: calling it multiple times for the same schemas is safe. Already-loaded schemas are skipped.

Accessing a model before its schema is loaded throws:

```
Schema "chassis" not loaded. Call SalvageUnionReference.preload(['chassis']) or SalvageUnionReference.preload('all') first.
```

**Enumeration risk:** Only schema IDs registered in `ModelFactory.ts`'s `dataLoaders` map are valid. Passing an unrecognised ID to `preload()` throws `No loader found for schema ID: <id>`. When adding new schemas, both the data loader and the `LazyModel` instance in `index.ts` must be added together or neither will work.

### Reference String Protocol

Reference strings are the cross-schema pointer format used in JSON data and throughout the codebase. The format is `"schemaId::entityId"`. Entity ids are UUIDs for nearly the whole dataset (1706/1712 — only `catalog-categories` uses semantic slug ids), so real refs look like `"chassis::550e8400-e29b-41d4-a716-446655440000"`; the examples below use a readable id for clarity only.

```typescript
// Parse a reference string:
const parsed = SalvageUnionReference.parseRef('chassis::iron-mongrel')
// => { schemaName: 'chassis', id: 'iron-mongrel' } | null

// Resolve directly to an entity:
const entity = SalvageUnionReference.getByRef('chassis::iron-mongrel')
// => SURefChassis & { schemaName: 'chassis' } | undefined
```

`parseRef()` returns `null` for malformed strings (wrong separator, unknown schema, empty parts). `getByRef()` returns `undefined` for unresolvable refs.

When storing cross-entity references in new JSON data files, always use the `"schemaId::entityId"` format — never raw IDs without a schema prefix.

---

## component-lib

**Location:** `packages/component-lib/`
**Build required:** No (exports TypeScript source directly)

### Entry Points

```json
{
  ".": "./src/index.ts",
  "./design/tokens": "./src/design/tokens.ts",
  "./styles/index.css": "./src/styles/index.css",
  "./styles/theme.css": "./src/styles/theme.css"
}
```

`./design/tokens` exists for consumers that need the palette as **values** rather
than as CSS: `src/design/tokens.ts` is a leaf module — plain `as const` objects,
zero imports — so reaching it does not drag React into the bundle. The itun
Worker's `og:image` renderer is the reason it was added: it rasterises SVG
through resvg with no stylesheet in the process, so `var(--su-*)` cannot resolve
and the colour has to arrive as a string. Import from here rather than from the
barrel, and never copy a token's literal to a call site — `tokens.parity.test.ts`
guards the scale against `theme.css`, and it cannot guard a copy.

Consuming apps' Vite bundlers compile `.ts/.tsx` files directly. No intermediate build step.
(In `srd` this is doubly true: the SSR pass runs the same `.tsx` source under Bun,
with no bundler in the loop at all.)

### Public API (`src/index.ts` is the source of truth)

Do NOT trust any hand-maintained list — including a count. Earlier revisions of
this doc said "64 named exports", then "~100", then "144"; the last of those was
already wrong when written and went wrong again when 28 dead re-exports were
pruned. The number is deliberately not restated here, because a figure nothing
checks is a figure that drifts. Count it when you need it:

```bash
grep -c '^export' packages/component-lib/src/index.ts   # export STATEMENTS
```

The categories below are stable and worth knowing; the membership is not, so
read `src/index.ts` for anything load-bearing:

- **Types** — `ReferenceEntityControl`, `CardFootMeta`, `ChoiceSelections`, `EntityHrefBuilder`, …
- **Constants** — `TECH_LEVEL_STYLES` / `techLevelLabel`
- **Base typography** — `Text`
- **UI primitives** — `Toaster` / `toast`, `ModalShell`
- **Chrome primitives** (`src/components/chrome/`) — `Badge`, `Button`, `Callout`, `EmptyState`, `FieldError`, `Glyph`, `Field`/`Input`/`Select`, `Panel`/`Row`, `Slab`, `CountStepper`, `StatusBadge`, `Sel`, `KvRow`, and friends
- **Stat trackers** (`src/components/stat/`) — `VitalGauge`, `heatDangerFrom` (the running-text `StatLine` was
  absorbed into `Stat` as `orientation="horizontal" surface="plain"`)
- **Entity display system** — `ReferenceEntityCard`, the href/detail-link providers, `ClassAbilityTree`, `entityHostTone`, `navigateControl`, `useDetailModal`, `useChassisPatternConfig`, `Skeleton`
- **Shared components** — `Card`, `AppBar`, `Footer`, `FilterRow`, `EntityGrid`/`EntityRow`, `EntitySearcher`, `SlotGrid`, `Stat`, `CatalogTile`, `StaticEntityContent`, … (the former `FilterChip` is gone: the interactive chip is now `Badge as="button"`, with the call site owning pressed state)
- **Dashboard shell** (`src/components/dashboard/`) — `DashboardCanvas`, `DashboardGrid`, `RailBar`, `Dial`/`DialConfig`, `DisplayPanel`, `ActionsDeck`, `ActiveItemBand`/`StorageBay`
- **Sheet presentation** (`src/components/sheet/`) — `SheetHero`, `CrawlerEconFrame`, `ConditionsEditor`, `SnapshotQr`, …
- **Wizard steps** (`src/components/wizard/`) — `ClassAbilityStep`, `CrawlerTypeSelectStep`, `EquipmentStep`, …
- **Changelog** — `parseChangelog`, `mergeChangelogs`, `Changelog`
- **Utilities** — the single `cn()` (its tailwind-merge config knows the custom utilities; never re-wrap `twMerge` with the default config)

Note: some components are deliberately internal and NOT exported — there is no
`Tooltip` primitive, `EntityTooltip` is used inside the entity card rather than
published, and `ConditionChip` ships only as a sub-part of `Conditions`.

### Dependencies

- **Peer dependencies** (must be provided by consuming apps): `react`, `react-dom`, `@base-ui/react`, `salvageunion-reference`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@randsum/roller`
- **Direct dependency**: `qrcode`
- **No backend/data-source dependency** — fully data-source agnostic

### Design Principles

- Generic slot props pattern: consumers customize via `titleOverride`, `subtitleExtra`, etc. — no schema-specific props
- Hook-based logic extraction: `useChassisPatternConfig` returns slot props to spread
- Data-shape checks over schema-name checks where possible

---

## srd

**Location:** `apps/srd/`
**Framework:** in-house SSG at `apps/srd/ssg` (Vite 8 for the client bundle, React 19
for rendering) + React 19 islands. **Not Astro** — see
[`apps/srd/ssg/DESIGN.md`](../../apps/srd/ssg/DESIGN.md).

### Build surface

- Routes are `src/pages/**/*.page.tsx` (`PageModule`) registered in `ssg/routes.ts`;
  endpoints are `src/endpoints/*.ts` (`EndpointModule`) registered in
  `ssg/endpoints.ts`. Nothing is discovered from the filesystem.
- `bun ssg/build.ts` builds; `bun ssg/dev.ts` serves through the same
  `ssg/render.tsx`; `bun --filter srd gate` (`ssg/snapshot.ts`) diffs the built output
  against a committed snapshot and runs in CI.
- **Hard rule:** no `.css` import may be reachable from an SSR module. All css is
  imported from `src/runtime/styles.entry.ts` (a client-bundle entry); all static
  assets from `src/runtime/assets.entry.ts`, addressed via
  `RouteContext.builtAssets`.

### Consumes

- `salvageunion-reference` (workspace:\*) — game data
- `component-lib` (workspace:\*) — shared components + theme
- `@base-ui/react` — headless UI primitives (dialog, etc.)

### Does Not Use

- Auth, user data, persistence, TanStack Query/Router, Zustand (pure static site)

### Tailwind Source Path

```css
/* apps/srd/src/styles/global.css */
@source "../../../../packages/component-lib/src";
@import 'component-lib/styles/theme.css';
```

---

## itun

**Location:** `apps/itun/`
**Framework:** React 19 + Vite + TanStack Router/Query

### Consumes

- `salvageunion-reference` (workspace:\*) — game data
- `component-lib` (workspace:\*) — shared components + theme
- `idb` — IndexedDB wrapper for local-first persistence (`src/lib/db/`)
- `@tanstack/react-router`, `@tanstack/react-query` — routing + async/derived data
- `zustand` — write-through entity/container stores (`src/stores/`)
- `@base-ui/react` — headless UI primitives
- `@netlify/blobs` — snapshot-sharing Netlify Functions storage

Local-first: there is no auth and no backend other than the
stateless snapshot-sharing Netlify Functions (see
[ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md)). Player data lives in
IndexedDB.

### Tailwind Source Path

```css
/* apps/itun/src/index.css */
@source "../../../packages/component-lib/src";
@import 'component-lib/styles/theme.css';
```

---

## discord-bot

**Location:** `apps/discord-bot/`
**Framework:** Discord.js 14

### Consumes

- `salvageunion-reference` (workspace:\*) — game data for table rolling

### Does Not Use

- React, component-lib, Tailwind

---

## Architectural Patterns & Risk Areas

### Module-Scope ORM Call Risk

**Problem:** Calling any `SalvageUnionReference` model accessor at module scope (i.e. outside a function or React hook) executes before `preload()` has run and throws at import time. This causes the entire module to fail to load, often with a confusing stack trace far removed from the actual call site.

**Examples of the anti-pattern:**

```typescript
// BAD — executes at module load time, before preload()
const ALL_CHASSIS = SalvageUnionReference.Chassis.all()

// BAD — same problem inside a constant declaration
const DEFAULT_OPTION = SalvageUnionReference.Equipment.find((e) => e.id === 'default')
```

**Correct patterns:**

```typescript
// GOOD — inside a React component with useMemo (runs after preload in the render cycle)
function MyComponent() {
  const allChassis = useMemo(() => SalvageUnionReference.Chassis.all(), [])
  // ...
}

// GOOD — inside a function that is called after preload()
function buildOptions() {
  return SalvageUnionReference.Equipment.all().map((e) => ({ value: e.id, label: e.name }))
}
```

If you need a module-level constant derived from reference data, compute it lazily (e.g. via a getter function) or call it from a hook/effect that runs after the app's preload bootstrap.

### One-Way Dependency: Reference Package → Apps

`salvageunion-reference` provides the game-data model that ITUN's local-first
layer builds on (IndexedDB store shapes, slug references, Zod validation, and
TanStack Query keys all derive from the reference schema). The dependency flows
one way:

```
salvageunion-reference (game data schema)
  --> itun (derives store shapes, validation, and refs from game data)
```

The reference package must never import from the apps. If you find yourself
wanting to add app-specific logic (e.g. IndexedDB record types or player state)
to `salvageunion-reference`, that logic belongs in the consuming app instead.

### Test Preload Setup

Consumer packages run `SalvageUnionReference.preload('all')` as a Bun test preload script so all test files have access to reference data without per-file `beforeAll()` calls.

**Setup for a new consumer package:**

1. Create `test/preload-reference.ts`:

```typescript
import { SalvageUnionReference } from 'salvageunion-reference'

await SalvageUnionReference.preload('all')
```

2. Add it to the package's `bunfig.toml` preload list:

```toml
[test]
preload = ["./test/preload-reference.ts"]
```

All existing consumer packages (`component-lib`, `srd`, `itun`) follow this pattern. New packages that test any code touching `SalvageUnionReference` must do the same.

---

## Cross-Package Change Checklist

When modifying shared packages, follow this checklist:

### 1. After changing `salvageunion-reference`

- [ ] Rebuild: `bun run build:package`
- [ ] Run typecheck: `bun run typecheck`
- [ ] Run validation: `bun run validate:all`
- [ ] Run tests: `bun test`
- [ ] If adding a new schema, ALL of these registries must gain an entry together (they are hand-maintained in parallel today): `ModelFactory.ts` `dataLoaders` + `zodSchemaMap` + `schemaDisplayNames`; `index.ts` `LazyModel` instance + `lazyModelMap` + `SchemaToEntityMap` + `SCHEMA_REGISTRY` + static accessor; `tools/generateJsonSchemas.ts` map. Then verify `preload(['new-schema-id'])` resolves without error
- [ ] Data integrity: `bun run validate:all` (includes `validate:slugs` — same-named entities in one file shadow each other's slug URLs and will fail the gate)

### 2. After changing `component-lib`

- [ ] Update `src/index.ts` barrel if adding/removing exports
- [ ] Run typecheck: `bun run typecheck` (checks all consumers)
- [ ] Run component tests: `bun --filter component-lib test`
- [ ] Verify Tailwind `@source` paths in both apps still cover new files
- [ ] If adding peer dependencies: update both `peerDependencies` and `devDependencies`

### 3. After any cross-package change

- [ ] Full CI gate: `bun run check` (lint, format, typecheck, test, validate)
- [ ] Check consuming apps for regressions if shared types or components changed

### Build Order

```
1. bun run build:package          (salvageunion-reference)
2. bun run typecheck              (all packages in parallel, except salvageunion-reference first)
3. bun run build:web / build:itun (app builds, if needed)
```

The `check` script handles this ordering automatically.

---

## Maintenance

When making structural changes (new packages, new exports, dependency changes), update this document and the relevant `.claude/rules/` files. Run `bun run check` to verify nothing broke.
