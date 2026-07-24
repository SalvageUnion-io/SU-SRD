# Salvage Union Reference

> **npm deprecation notice:** This package is no longer published to npm. The
> same data and JSON Schemas are served publicly (CORS-enabled) — the dataset
> at `https://salvageunion.io/schema/{schemaId}.json` and the JSON Schema at
> `https://salvageunion.io/schema/{schemaId}.schema.json` — see
> https://salvageunion.io/llms.txt for the full endpoint list. Within this
> monorepo the package is consumed via `workspace:*` and is unaffected.

A comprehensive, schema-validated JSON reference and TypeScript ORM for the **Salvage Union** tabletop RPG, published by [Leyline Press](https://leyline.press/).

## Status

**This package is private and workspace-internal.** It is not published to npm and cannot be installed via `npm install` or `bun add`. It is consumed only by other packages in this monorepo via the `workspace:*` protocol.

**External consumers** should use the public JSON API at `https://salvageunion.io/api/` instead. Every schema is available as a CORS-enabled JSON endpoint — see [salvageunion.io/api](https://salvageunion.io/api/) for endpoint documentation and [salvageunion.io/llms.txt](https://salvageunion.io/llms.txt) for the full index.

## Features

- **513+ game data items** across 18 categories
- **Type-safe TypeScript ORM** with inferred types
- **Powerful search API** with relevance scoring
- **JSON Schema validation** for all data
- **Zero runtime dependencies**
- **ESM-only** for modern JavaScript
- **Full page references** to source material

## Monorepo Usage

Within this monorepo the package is imported directly from its workspace path — no install step required:

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

// All models extend BaseModel<T>, created via ModelFactory
const { Abilities, Chassis, Equipment, Systems, Modules } = SalvageUnionReference

// Get all chassis
const allChassis = Chassis.all()
console.log(`Total chassis: ${allChassis.length}`)

// Find by predicate (same as Array.find)
const atlas = Chassis.find((c) => c.name === 'Atlas')
if (atlas) {
  console.log(`${atlas.name}: ${atlas.structurePoints} SP`)
}

// Find all matching items (same as Array.filter)
const t3Equipment = Equipment.findAll((e) => e.techLevel === 3)

// Get weapons
const weapons = Systems.findAll((s) =>
  s.traits?.some((t) => ['melee', 'ballistic', 'energy', 'missile'].includes(t.type))
)
```

## Available Models

All models are accessible via the `SalvageUnionReference` export:

| Model                     | Count | Description                      |
| ------------------------- | ----- | -------------------------------- |
| `Abilities`               | 95    | Pilot abilities and skills       |
| `AbilityTreeRequirements` | 20    | Ability tree prerequisites       |
| `BioTitans`               | 6     | Massive bio-engineered creatures |
| `Chassis`                 | 30    | Mech chassis                     |
| `Classes`                 | 11    | Pilot classes                    |
| `Crawlers`                | 5     | Union crawler types              |
| `Creatures`               | 6     | Wasteland creatures              |
| `Drones`                  | 9     | Autonomous drones                |
| `Equipment`               | 44    | Pilot equipment                  |
| `Keywords`                | 73    | Game keywords                    |
| `Meld`                    | 5     | Meld-infected creatures          |
| `Modules`                 | 61    | Mech modules                     |
| `NPCs`                    | 6     | Non-player characters            |
| `Squads`                  | 9     | NPC squads                       |
| `Systems`                 | 99    | Mech weapon systems              |
| `RollTables`              | 14    | Game tables                      |
| `Traits`                  | 43    | Special traits                   |
| `Vehicles`                | 7     | Wasteland vehicles               |

## API Reference

### Search API

```typescript
import { SalvageUnionReference } from 'salvageunion-reference'

// Search across all schemas
const results = SalvageUnionReference.search({ query: 'laser' })

// Search within specific schemas
const systems = SalvageUnionReference.searchIn('systems', 'laser')

// Get search suggestions
const suggestions = SalvageUnionReference.getSuggestions('las')
```

**Features:**

- Full-text search across name, description, and effect fields
- Relevance scoring with automatic result sorting
- Schema filtering for targeted searches
- Case-sensitive/insensitive options
- Result limiting for performance

See [Search API Documentation](docs/SEARCH_API.md) for complete details and examples.

### Model API

All models provide a simple, consistent API with just three methods:

```typescript
// Get all items
.all(): T[]

// Find first matching item (same interface as Array.find)
.find(predicate: (item: T) => boolean): T | undefined

// Find all matching items (same interface as Array.filter)
.findAll(predicate: (item: T) => boolean): T[]
```

## Direct Data Access

```typescript
// Import raw data
import chassisData from 'salvageunion-reference/data/chassis.json'
import equipmentData from 'salvageunion-reference/data/equipment.json'

// Import schemas
import chassisSchema from 'salvageunion-reference/schemas/chassis.schema.json'

// Or use the data maps
import { getDataMaps, getSchemaCatalog, toPascalCase } from 'salvageunion-reference'

const { dataMap } = getDataMaps()
const chassisData = dataMap['chassis']

// JSON Schema definitions come from their own accessor, not getDataMaps()
import { getJsonSchemaDefinition } from 'salvageunion-reference'
const chassisSchema = getJsonSchemaDefinition('chassis')

// Get schema catalog metadata
const catalog = getSchemaCatalog()
console.log(catalog.schemas) // Array of all schema entries

// Convert schema IDs to property names
toPascalCase('ability-tree-requirements') // => 'AbilityTreeRequirements'
toPascalCase('classes.core') // => 'CoreClasses'
```

## TypeScript Support

```typescript
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis, SURefEquipment, SURefSystem } from 'salvageunion-reference'

const { Chassis, Equipment } = SalvageUnionReference

// Fully typed
const atlas: SURefChassis | undefined = Chassis.find((c) => c.name === 'Atlas')

// Type-safe queries
const heavyEquipment: SURefEquipment[] = Equipment.findAll((e) => (e.techLevel ?? 0) >= 3)
```

## Development Scripts

### Data Validation

```bash
# Validate all data against JSON schemas
bun run validate

# Validate all IDs are unique UUIDs (including nested objects)
bun run validate:ids
```

### Other Scripts

```bash
# Build the package (from repo root)
bun run build:package

# Run type checking
bun run typecheck

# Run tests
bun test

# Lint code
bun run lint

# Format code
bun run format
```

## Contributing

Contributions are welcome! Please:

1. Ensure all data includes page references
2. Ensure all items have unique UUIDs (run `bun run validate:ids`)
3. Validate changes with `bun run validate`
4. Run type checking with `bun run typecheck`
5. Follow existing data structure patterns

### ID Requirements

All data items must have a unique UUID v4 identifier in the `id` field. This includes:

- Root-level items in all data files
- Nested `choices` objects in NPCs and abilities
- Any other nested objects with an `id` field

Use `bun run validate:ids` to check for invalid or missing UUIDs.

## License

Salvage Union Open Game Licence 1.0b

## Credits

This data was originally copied from [wfreinhart/salvage-union-tracker](https://github.com/wfreinhart/salvage-union-tracker) and later forked from [sbergot/salvageunion-data](https://github.com/sbergot/salvageunion-data).

Salvage Union is copyrighted by Leyline Press. Salvage Union and the "Powered by Salvage" logo are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b
