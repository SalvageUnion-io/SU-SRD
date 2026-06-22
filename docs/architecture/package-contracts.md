# Package Contracts & Dependency Rules

This document defines what each package exposes, what it consumes, and the rules for making cross-package changes.

## Dependency Graph

```
salvageunion-reference (game data ORM, built)
  |
  +---> suref-react (shared UI components, no build step)
  |       |
  |       +---> suref-web (static reference site, Astro 5)
  |       |
  |       +---> in-the-union-now (character builder, React 19 + Vite)
  |
  +---> discord-bot (standalone, Discord.js)
```

All workspace dependencies use `workspace:*` protocol. React 19.2.0+ is aligned across all packages.

---

## salvageunion-reference

**Location:** `packages/salvageunion-reference/`
**Build required:** Yes (`bun run build:package`)

### Entry Points

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "development": "./lib/index.ts",
    "import": "./dist/index.js"
  },
  "./data/*": { "import": "./data/*.json" },
  "./schemas/*": { "import": "./schemas/*.json" }
}
```

In development, consuming apps resolve `lib/index.ts` directly (via the `development` condition). In production builds, they use `dist/index.js`.

### Public API

**Static model accessors** (27 models):
`SalvageUnionReference.Chassis`, `.Classes`, `.Abilities`, `.Equipment`, `.Systems`, `.Modules`, `.Drones`, `.Vehicles`, `.Crawlers`, `.CrawlerBays`, `.Creatures`, `.BioTitans`, `.Squads`, `.NPCs`, `.Factions`, `.Keywords`, `.Traits`, `.Distances`, `.RollTables`, `.Meld`, `.Guides`, `.Sources`, `.TechLevels`, `.CatalogCategories`, `.Actions`, `.AbilityTreeRequirements`, `.CrawlerTechLevels`

**Generic accessors:**
`.get(schemaName, id)`, `.exists()`, `.getMany()`, `.findIn()`, `.findAllIn()`

**Reference strings:**
`.parseRef()`, `.getByRef()`

**Metadata:**
`.getTechLevel()`, `.getTechLevelNumber()`, `.getSalvageValue()`

**Search:**
`.search()`, `.searchIn()`, `.getSuggestions()`

**Type exports:**
All entity types (`SURef*`), enum types (`SURefEnum*`), common types (`SURefCommon*`), object types (`SURefObject*`), `SchemaToEntityMap`, `EntitySchemaNames` (runtime Set).

**Utility exports:**
`nameToSlug`, `getEntitySlug`, `findEntityBySlug`, `getParagraphString`, `replaceChassisPlaceholder`, `parseContentBlockString`, `resultForTable`, `BaseModel`, `getDataMaps`, `getSchemaCatalog`, `resolveGrantedEntities`, `resolveChoiceView`

**Choice-resolver types:**
`ChoiceSelections` (`Record<string, string[]>`), `ResolvedChoiceView` (`{ datavalues, traits, prompts }`), `ChoicePrompt`

### Dependencies

- **Runtime:** `zod` (^4.3.6)
- **Dev only:** `ajv`, `ajv-formats`, `json-schema-to-typescript`, `jsonschema`

### Generated Files (do not edit)

- `dist/` — Compiled JS + type declarations
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

Reference strings are the cross-schema pointer format used in JSON data and throughout the codebase. The format is `"schemaId::entityId"` (e.g. `"chassis::iron-mongrel"`).

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

## suref-react

**Location:** `packages/suref-react/`
**Build required:** No (exports TypeScript source directly)

### Entry Points

```json
{
  ".": "./src/index.ts",
  "./styles/theme.css": "./src/styles/theme.css"
}
```

Consuming apps' Vite/Astro bundlers compile `.ts/.tsx` files directly. No intermediate build step.

### Public API (64 named exports from `src/index.ts`)

**Types:**
`DataValue`, `PatternOverrideData`, `ReferenceEntityControl`, `DisplayCardTab`, `StatItem`, `StatConfig`, `GuideStepsInteractiveConfig`, `GuideStepRollState`, `ChoiceSelections`, `ChoiceCardOption`

**Constants:**
`ENTITY_STATS_CONFIG`, `TECH_LEVEL_STYLES`, `TECH_LEVEL_BG`, `techLevelLabel`

**Base Typography:**
`Text`

**UI Primitives:**
`Toaster`

**Entity Display System:**
`ReferenceEntityDisplay`, `ReferenceEntityDisplayTooltip`, `SectionSeparator`, `ReferenceEntityChassisAbilitiesContent`, `ClassAbilityTreeDisplay`, `NestedActionDisplay`, `ActionCard`, `getReferenceEntitySpacing`

**Controls & Interactions:**
`addControl`, `deleteControl`, `navigateControl`, `useDetailModal`, `useChassisPatternConfig`, `getClassSelections`

**Interactive Choice Cards (granted-equipment):**
`ChoiceGroups`, `ChoiceGroup`, `ChoiceCard`, `FreeTextChoiceCard`, `getChoiceCardOptions`, `isFreeTextChoice`, `isMultiSelectChoice`, `resolveMultiSelectCap`, `toggleSelection`

**Shared Components:**
`DisplayCard`, `CardHeader`, `CardImage`, `DualColumnLayout`, `ValueDisplay`, `StatDisplay`, `StatControl`, `StatsBar`, `ControlButtons`, `RollTable`, `FilterChip`, `FilterRow`, `Footer`, `ModalShell`

**Skeletons:**
`ReferenceEntityCardSkeleton`

**Utilities:**
`borderColorFromHeaderBg`, `calculateBackgroundColor`, `getSourceBorderColor`, `extractReferenceEntityDetails`, `getActivationCurrency`, `matchesFilter`, `enrichForFiltering`

**Content Rendering:**
`BlockContentRendererView`, `DataValueDisplayView`

### Dependencies

- **Peer dependencies** (must be provided by consuming apps): `react`, `react-dom`, `@radix-ui/react-dialog`, `@radix-ui/react-hover-card`, `@radix-ui/react-tooltip`, `salvageunion-reference`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@randsum/roller`
- **No backend/data-source dependency** — fully data-source agnostic

### Design Principles

- Generic slot props pattern: consumers customize via `titleOverride`, `subtitleExtra`, etc. — no schema-specific props
- Hook-based logic extraction: `useChassisPatternConfig` returns slot props to spread
- Data-shape checks over schema-name checks where possible

---

## suref-web

**Location:** `apps/suref-web/`
**Framework:** Astro 5 + React 19 islands

### Consumes

- `salvageunion-reference` (workspace:\*) — game data
- `suref-react` (workspace:\*) — shared components + theme
- `@radix-ui/react-dialog` — search modal

### Does Not Use

- Auth, user data, persistence, TanStack Query/Router, Zustand (pure static site)

### Tailwind Source Path

```css
/* apps/suref-web/src/styles/global.css */
@source "../../../../packages/suref-react/src";
@import 'suref-react/styles/theme.css';
```

---

## in-the-union-now

**Location:** `apps/in-the-union-now/`
**Framework:** React 19 + Vite + TanStack Router/Query

### Consumes

- `salvageunion-reference` (workspace:\*) — game data
- `suref-react` (workspace:\*) — shared components + theme
- `idb` — IndexedDB wrapper for local-first persistence (`src/lib/db/`)
- `@tanstack/react-router`, `@tanstack/react-query` — routing + async/derived data
- `zustand` — write-through entity/workspace stores (`src/stores/`)
- `zod` — schema validation for player records + input
- Radix UI (dialog, dropdown-menu, separator, slot, tabs, tooltip)

Local-first: there is no auth and no backend other than the
stateless snapshot-sharing Netlify Functions (see
[ADR-010](../adrs/ADR-010-snapshot-backend.md)). Player data lives in IndexedDB.

### Tailwind Source Path

```css
/* apps/in-the-union-now/src/index.css */
@source "../../../packages/suref-react/src";
@import 'suref-react/styles/theme.css';
```

---

## discord-bot

**Location:** `apps/discord-bot/`
**Framework:** Discord.js 14

### Consumes

- `salvageunion-reference` (workspace:\*) — game data for table rolling

### Does Not Use

- React, suref-react, Tailwind

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
  --> in-the-union-now (derives store shapes, validation, and refs from game data)
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

All existing consumer packages (`suref-react`, `suref-web`, `in-the-union-now`) follow this pattern. New packages that test any code touching `SalvageUnionReference` must do the same.

---

## Cross-Package Change Checklist

When modifying shared packages, follow this checklist:

### 1. After changing `salvageunion-reference`

- [ ] Rebuild: `bun run build:package`
- [ ] Run typecheck: `bun run typecheck`
- [ ] Run validation: `bun run validate:all`
- [ ] Run tests: `bun test`
- [ ] If adding a new schema: add data loader to `ModelFactory.ts`, add `LazyModel` instance to `index.ts`, add entry to `SchemaToEntityMap`, and verify `preload(['new-schema-id'])` resolves without error

### 2. After changing `suref-react`

- [ ] Update `src/index.ts` barrel if adding/removing exports
- [ ] Run typecheck: `bun run typecheck` (checks all consumers)
- [ ] Run component tests: `bun --filter suref-react test`
- [ ] Verify Tailwind `@source` paths in both apps still cover new files
- [ ] If adding peer dependencies: update both `peerDependencies` and `devDependencies`

### 3. After any cross-package change

- [ ] Full CI gate: `bun run check:all` (lint, format, typecheck, test, validate)
- [ ] Check consuming apps for regressions if shared types or components changed

### Build Order

```
1. bun run build:package          (salvageunion-reference)
2. bun run typecheck              (all packages in parallel, except salvageunion-reference first)
3. bun run build:web / build:itun (app builds, if needed)
```

The `check:all` script handles this ordering automatically.

---

## Maintenance

When making structural changes (new packages, new exports, dependency changes), update this document and the relevant `.claude/rules/` files. Run `bun run check:all` to verify nothing broke.
