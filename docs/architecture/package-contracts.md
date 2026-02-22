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
`.composeRef()`, `.parseRef()`, `.getByRef()`, `.getManyByRef()`

**Metadata:**
`.getTechLevel()`, `.getTechLevelNumber()`, `.getSalvageValue()`

**Search:**
`.search()`, `.searchIn()`, `.getSuggestions()`

**Type exports:**
All entity types (`SURef*`), enum types (`SURefEnum*`), common types (`SURefCommon*`), object types (`SURefObject*`), `SchemaToEntityMap`, `EntitySchemaNames` (runtime Set).

**Utility exports:**
`nameToSlug`, `getEntitySlug`, `findEntityBySlug`, `getParagraphString`, `replaceChassisPlaceholder`, `parseContentBlockString`, `resultForTable`, `BaseModel`, `getDataMaps`, `getSchemaCatalog`

### Dependencies

- **Runtime:** `zod` (^4.3.6)
- **Dev only:** `ajv`, `ajv-formats`, `json-schema-to-typescript`, `jsonschema`

### Generated Files (do not edit)

- `dist/` — Compiled JS + type declarations
- `schemas/*.schema.json` — Generated from Zod schemas

To change output: edit Zod schemas in `lib/schemas/`, then `bun run build:package`.

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

### Public API (77 exports from `src/index.ts`)

**Types:**
`DataValue`, `PatternOverrideData`, `ReferenceEntityControl`, `ChoiceInputRenderer`, `DisplayCardTab`, `StatItem`, `StatConfig`, `GuideStepsInteractiveConfig`, `GuideStepRollState`

**Constants:**
`ENTITY_STATS_CONFIG`, `TECH_LEVEL_STYLES`, `TECH_LEVEL_BG`, `techLevelLabel`, `techLevelColors`

**Base Typography:**
`Text`

**UI Primitives:**
`Toaster`

**Entity Display System:**
`ReferenceEntityDisplay`, `ReferenceEntityDisplayTooltip`, `SectionSeparator`, `ReferenceEntityChassisAbilitiesContent`, `ClassAbilityTreeDisplay`, `NestedActionDisplay`, `getReferenceEntitySpacing`

**Controls & Interactions:**
`addControl`, `deleteControl`, `navigateControl`, `DetailIcon`, `useDetailModal`, `useChassisPatternConfig`, `getClassSelections`

**Shared Components:**
`DisplayCard`, `CardHeader`, `CardImage`, `DualColumnLayout`, `ValueDisplay`, `StatDisplay`, `StatControl`, `StatsBar`, `ControlButtons`, `RollTable`, `FilterChip`, `Footer`

**Skeletons:**
`ReferenceEntityCardSkeleton`

**Utilities:**
`borderColorFromHeaderBg`, `calculateBackgroundColor`, `getSourceBorderColor`, `extractReferenceEntityDetails`, `getActivationCurrency`, `matchesFilter`, `enrichForFiltering`

**Content Rendering:**
`BlockContentRendererView`, `DataValueDisplayView`

### Dependencies

- **Peer dependencies** (must be provided by consuming apps): `react`, `react-dom`, `@radix-ui/react-dialog`, `@radix-ui/react-hover-card`, `@radix-ui/react-tooltip`, `salvageunion-reference`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@randsum/roller`
- **No Supabase dependency** — data-source agnostic

### Design Principles

- Generic slot props pattern: consumers customize via `titleOverride`, `subtitleExtra`, etc. — no schema-specific props
- Hook-based logic extraction: `useChassisPatternConfig` returns slot props to spread
- Data-shape checks over schema-name checks where possible

---

## suref-web

**Location:** `apps/suref-web/`
**Framework:** Astro 5 + React 19 islands

### Consumes

- `salvageunion-reference` (workspace:*) — game data
- `suref-react` (workspace:*) — shared components + theme
- `@radix-ui/react-dialog` — search modal

### Does Not Use

- Supabase, auth, user data, TanStack Query/Router, Zustand

### Tailwind Source Path

```css
/* apps/suref-web/src/styles/global.css */
@source "../../../../packages/suref-react/src";
@import "suref-react/styles/theme.css";
```

---

## in-the-union-now

**Location:** `apps/in-the-union-now/`
**Framework:** React 19 + Vite + TanStack Router/Query

### Consumes

- `salvageunion-reference` (workspace:*) — game data
- `suref-react` (workspace:*) — shared components + theme
- `@supabase/supabase-js` — database + auth
- `@tanstack/react-router`, `@tanstack/react-query` — routing + data fetching
- `zustand` — auth state
- `zod` — input validation
- Radix UI (dialog, dropdown-menu, separator, slot, tabs, tooltip)

### Tailwind Source Path

```css
/* apps/in-the-union-now/src/index.css */
@source "../../../packages/suref-react/src";
@import "suref-react/styles/theme.css";
```

---

## discord-bot

**Location:** `apps/discord-bot/`
**Framework:** Discord.js 14

### Consumes

- `salvageunion-reference` (workspace:*) — game data for table rolling

### Does Not Use

- React, suref-react, Supabase, Tailwind

---

## Cross-Package Change Checklist

When modifying shared packages, follow this checklist:

### 1. After changing `salvageunion-reference`

- [ ] Rebuild: `bun run build:package`
- [ ] Run typecheck: `bun run typecheck`
- [ ] Run validation: `bun run validate:all`
- [ ] Run tests: `bun test`

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
