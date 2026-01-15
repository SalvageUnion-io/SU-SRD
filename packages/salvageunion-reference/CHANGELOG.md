# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2025-01-13

### Fixed

- **Action Property Extraction Bug**: Fixed utility functions that incorrectly extracted properties from `actions[0]` for multi-action entities
  - Updated `getActivationCost()`, `getActionType()`, `getRange()`, `getDamage()`, and `getTraits()` to only extract from `actions[0]` when entity has **exactly 1 action**
  - Previously, these functions would extract from the first action even when entities had multiple actions (e.g., Chassis with 4 actions)
  - Now correctly returns `undefined` for multi-action entities, ensuring properties are only "promoted" for single-action entities
  - Fixed `getEffects()` to only check base-level properties (effects don't exist in action schema)
  - Added comprehensive test coverage for single-action, multi-action, and base-level property precedence scenarios

## [2.0.0] - 2025-01-13

### 🚨 BREAKING CHANGES

This is a major version release with significant breaking changes to the data structure and schema definitions.

#### Content Block Migration

All entities have been migrated from separate text fields to a unified **content block system**. This affects all data files and schemas.

**Removed Fields (on actions and nested objects):**

- `description` (string) - Replaced by `content` array
- `effect` (string) - Replaced by `content` array
- `effects` (array) - Replaced by `content` array
- `notes` (string) - Replaced by `content` array
- `options` (array) - Replaced by `content` array

**Added Fields:**

- `content` (array of ContentBlock) - Unified structured content system

**Migration Guide:**

```javascript
// Before (v1.x)
const ability = {
  name: 'Power Strike',
  effect: 'Deal 2 SP damage',
  notes: 'Can only be used once per turn',
}

// After (v2.x)
const ability = {
  name: 'Power Strike',
  content: [
    { type: 'paragraph', value: 'Deal 2 SP damage' },
    { type: 'paragraph', value: 'Can only be used once per turn' },
  ],
}
```

#### Schema Definition Changes

**Removed Definitions (schemas/shared/objects.schema.json):**

- `grantable` - Replaced by enhanced `grant` definition
- `damage` - Now defined inline within `action` definition
- `effect` - Replaced by content blocks
- `effects` - Replaced by content blocks
- `baseEntry` - Redundant with `baseEntity`

**Modified Definitions:**

- `action` - Now uses `content` array instead of separate text fields (`description`, `effect`, `notes`)
- `baseEntity` - Added `content` property
- `npc` - Changed `description` field to `content` array
- `grant` - Enhanced to support both schema references and choice types
- `pattern` - Changed `description` field to `content` array
- `techLevelEffect` - Changed `effects` from reference to inline array definition

**Added Definitions:**

- `content` - Array of content blocks
- `contentBlock` - Individual structured content block with type, value, label, level, and nested items
- `combatEntity` - Entity that can perform actions and has traits
- `mechanicalEntity` - Mechanical entity with structure points and equipment stats

### ✨ Added

#### New Schemas & Data

- **distances.schema.json** - New schema for range/distance definitions
- **data/distances.json** - 34 distance/range entries with structured data

#### New Enums (schemas/shared/enums.schema.json)

- `contentType` - Content block types: `paragraph`, `heading`, `list-item`, `list-item-naked`, `label`

#### Schema-Specific Additions

- **abilities.schema.json** - Added top-level `description` field (summary text, distinct from action-level content)

### 🔧 Changed

#### Data Files (All Migrated to Content Blocks)

- **abilities.json** - 2,609 line changes
- **systems.json** - 3,298 line changes
- **modules.json** - 1,552 line changes
- **equipment.json** - 1,566 line changes
- **chassis.json** - Complete migration to content blocks
- **bio-titans.json** - Complete migration to content blocks
- **creatures.json** - Complete migration to content blocks
- **NPCs.json** - Complete migration to content blocks
- **squads.json** - Complete migration to content blocks
- **meld.json** - Complete migration to content blocks
- **drones.json** - Complete migration to content blocks
- **vehicles.json** - Complete migration to content blocks
- **crawlers.json** - Complete migration to content blocks
- **crawler-bays.json** - Complete migration to content blocks
- **classes/core.json** - Complete migration to content blocks
- **classes/advanced.json** - Complete migration to content blocks
- **keywords.json** - Complete migration to content blocks
- **traits.json** - Complete migration to content blocks
- **roll-tables.json** - Complete migration to content blocks

**Total:** 20 data files, 6,241 insertions, 2,720 deletions

#### Type System Updates

- **lib/types/objects.ts** - Simplified and cleaned (304 line reduction)
- **lib/types/schemas.ts** - Enhanced type inference for content blocks
- **lib/types/enums.ts** - Added `ContentType` enum
- **lib/types/index.ts** - Better organization and exports

#### Search & Utilities

- **lib/search.ts** - Enhanced full-text search with content block support (95 line changes)
- **lib/utilities.ts** - Added content block helper functions
- Improved search result relevance scoring
- Better handling of structured content in search

### 🔧 Utilities

#### Generated Utilities

- **tools/generateUtilities.ts** - Auto-generates type guards and property extractors from schemas (277 lines)
- **lib/utilities.ts** - Utility functions including type guards and property extractors
- **npm script `generate:utilities`** - Generate utility functions from schemas

### 📚 Documentation

#### New Documentation System

- **tools/generateSchemaDocs.ts** - Auto-generates markdown docs from schemas (173 lines)
- **docs/schemas/** - 25 auto-generated schema documentation files:
  - abilities.md, ability-tree-requirements.md, bio-titans.md, chassis.md
  - classes.advanced.md, classes.core.md
  - crawler-bays.md, crawler-tech-levels.md, crawlers.md
  - creatures.md, distances.md, drones.md, equipment.md
  - keywords.md, meld.md, modules.md, NPCs.md
  - roll-tables.md, squads.md, systems.md, traits.md, vehicles.md

#### New npm Scripts

- `docs:schemas` - Generate schema documentation
- `validate:references` - Validate cross-references in data files

### 🛠️ Development Tools

#### New Validation & Migration Tools

- **tools/validateGenerated.ts** - Validates generated code is current (130 lines)
- **tools/validateReferences.ts** - Validates data cross-references (172 lines)
- **tools/updateSchemaRefs.ts** - Updates schema references (101 lines)
- **tools/migrateToContentBlocks.ts** - General content block migration (231 lines)
- **tools/migrateAbilities.ts** - Ability-specific migration (155 lines)

#### Build Improvements

- **Parallel type generation** - Using `npm-run-all` for faster builds
- Updated `generate` script to run type generation in parallel, then index generation, then utilities generation
- Enhanced GitHub Actions CI workflow

### 📊 Statistics

**Total Changes:**

- 68 files changed
- 14,330 insertions
- 3,230 deletions
- 25+ schemas updated
- 20 data files completely restructured

### 🔄 Migration Path from 1.x to 2.x

#### For Library Consumers

1. **Update data access patterns:**

   ```javascript
   // Old (1.x)
   const description = ability.actions[0].description
   const effect = ability.actions[0].effect

   // New (2.x)
   const content = ability.actions[0].content
   // content is an array of ContentBlock objects
   ```

2. **Handle content blocks:**

   ```javascript
   // ContentBlock structure
   {
     type: 'paragraph' | 'heading' | 'list-item' | 'list-item-naked' | 'label',
     value: string,
     label?: string,
     level?: number,
     items?: ContentBlock[]  // for nested content
   }
   ```

3. **Update TypeScript types:**
   - Import new `ContentBlock` type
   - Remove references to old `effect`, `effects`, `notes`, `options` fields
   - Use `content: ContentBlock[]` instead

#### For Schema Validators

1. **Update schema references:**
   - Replace `objects.schema.json#/definitions/effect` with `objects.schema.json#/definitions/content`
   - Replace `objects.schema.json#/definitions/grantable` with `objects.schema.json#/definitions/grant`
   - Remove references to `baseEntry` (use `baseEntity` instead)

2. **Validate content blocks:**
   - Ensure `content` arrays contain valid `ContentBlock` objects
   - Validate `type` field against `contentType` enum

### ⚠️ Known Issues

None at this time.

### 🙏 Notes

This major version represents a significant architectural improvement to the data structure. The unified content block system provides:

- **Consistency** - All text content uses the same structure
- **Flexibility** - Support for rich formatting (headings, lists, labels)
- **Extensibility** - Easy to add new content types in the future
- **Type Safety** - Better TypeScript inference and validation

The migration tools used to perform this transformation are included in the repository for reference.

---

## [1.59.2] - Previous Release

Last version before the content block migration.
