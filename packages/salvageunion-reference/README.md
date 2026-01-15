# Salvage Union Reference

A comprehensive, schema-validated JSON reference and TypeScript ORM for the **Salvage Union** tabletop RPG, published by [Leyline Press](https://leyline.press/).

## Features

✅ **513+ game data items** across 18 categories
✅ **Type-safe TypeScript ORM** with inferred types
✅ **Powerful search API** with relevance scoring
✅ **JSON Schema validation** for all data
✅ **Zero runtime dependencies**
✅ **ESM-only** for modern JavaScript
✅ **Full page references** to source material

## Installation

```bash
npm install salvageunion-data
# or
bun add salvageunion-data
```

## Quick Start

```typescript
import { SalvageUnionReference } from 'salvageunion-data'

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

// Advanced queries
const heavyArmor = Equipment.findAll(
  (e) => e.traits?.some((t) => t.type === 'armor') && (e.techLevel ?? 0) >= 3
)
```

## Available Models

All models are auto-generated from the schema catalog and accessible via the `SalvageUnionReference` export:

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

The package includes a powerful search API for finding entities across all schemas:

```typescript
import { SalvageUnionReference } from 'salvageunion-data'

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

### Examples

```typescript
// Get all items
const allChassis = Chassis.all()

// Find by name
const atlas = Chassis.find((c) => c.name === 'Atlas')

// Find by tech level
const t3Equipment = Equipment.findAll((e) => e.techLevel === 3)

// Find by trait
const armorItems = Equipment.findAll((e) => e.traits?.some((t) => t.type === 'armor'))

// Find weapons
const weapons = Systems.findAll((s) =>
  s.traits?.some((t) => ['melee', 'ballistic', 'energy', 'missile'].includes(t.type))
)

// Find by level
const level1Abilities = Abilities.findAll((a) => a.level === 1)

// Find by tree
const mechanicalAbilities = Abilities.findAll((a) => a.tree === 'Mechanical Knowledge')

// Complex queries
const heavyWeapons = Systems.findAll(
  (s) =>
    s.traits?.some((t) => ['melee', 'ballistic', 'energy', 'missile'].includes(t.type)) &&
    (s.techLevel ?? 0) >= 3
)
```

## Direct Data Access

You can also import raw JSON data and schemas:

```typescript
// Import raw data
import chassisData from 'salvageunion-data/data/chassis.json'
import equipmentData from 'salvageunion-data/data/equipment.json'

// Import schemas
import chassisSchema from 'salvageunion-data/schemas/chassis.schema.json'

// Or use the data maps
import { getDataMaps, getSchemaCatalog, toPascalCase } from 'salvageunion-data'

const { dataMap, schemaMap } = getDataMaps()
const chassisData = dataMap['chassis']
const chassisSchema = schemaMap['chassis']

// Get schema catalog metadata
const catalog = getSchemaCatalog()
console.log(catalog.schemas) // Array of all schema entries

// Convert schema IDs to property names
toPascalCase('ability-tree-requirements') // => 'AbilityTreeRequirements'
toPascalCase('classes.core') // => 'CoreClasses'
```

## TypeScript Support

Full TypeScript support with inferred types from JSON data:

```typescript
import { SalvageUnionReference } from 'salvageunion-data'
import type { SURefChassis, SURefEquipment, SURefSystem } from 'salvageunion-data'

const { Chassis, Equipment } = SalvageUnionReference

// Fully typed
const atlas: SURefChassis | undefined = Chassis.find((c) => c.name === 'Atlas')

// Type-safe queries
const heavyEquipment: SURefEquipment[] = Equipment.findAll((e) => (e.techLevel ?? 0) >= 3)
```

## 🛠️ Development Scripts

### Data Validation

```bash
# Validate all data against JSON schemas
npm run validate

# Validate all IDs are unique UUIDs (including nested objects)
npm run validate:ids

# Generate missing UUIDs and fix invalid ones
npm run fix:ids
```

### Other Scripts

```bash
# Build the package
npm run build

# Run type checking
npm run typecheck

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Ensure all data includes page references
2. Ensure all items have unique UUIDs (run `npm run validate:ids`)
3. Validate changes with `npm run validate`
4. Run type checking with `npm run typecheck`
5. Follow existing data structure patterns

### ID Requirements

All data items must have a unique UUID v4 identifier in the `id` field. This includes:

- Root-level items in all data files
- Nested `choices` objects in NPCs and abilities
- Any other nested objects with an `id` field

Use `npm run fix:ids` to automatically generate missing UUIDs or fix invalid ones.

## 📜 License

Salvage Union Open Game Licence 1.0b

## 🙏 Credits

This data was originally copied from [wfreinhart/salvage-union-tracker](https://github.com/wfreinhart/salvage-union-tracker) and later forked from [sbergot/salvageunion-data](https://github.com/sbergot/salvageunion-data).

Salvage Union is copyrighted by Leyline Press. Salvage Union and the “Powered by Salvage” logo are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b
