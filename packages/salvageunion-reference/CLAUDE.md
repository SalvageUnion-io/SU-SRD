# salvageunion-reference (Game Data Package)

TypeScript ORM + schema-validated JSON dataset for Salvage Union game data.

## Code Generation

Code generation is central to this package. Run after any schema/data changes:

```bash
bun run generate
```

### Auto-Generated Files (DO NOT EDIT)

- `lib/index.ts` (generated from `lib/index.template.ts`)
- `lib/utilities-generated.ts`
- `lib/types/schemas.ts`
- `lib/types/enums.ts`
- `lib/types/common.ts`
- `lib/types/objects.ts`
- `lib/types/index.ts`

To change generated output, edit scripts in `tools/` or templates like `lib/index.template.ts`.

### Manually Editable Files

- `lib/utilities.ts`
- `lib/ModelFactory.ts`
- `lib/BaseModel.ts`
- `lib/search.ts`

## Package Structure

- `lib/` - TypeScript source
- `data/` - JSON data files
- `schemas/` - JSON Schema definitions
- `tools/` - Code generation scripts
- `dist/` - Compiled output (don't edit)

## Model Access Pattern

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

// All models extend BaseModel<T>, created via ModelFactory
const chassis = SalvageUnionReference.Chassis.find((c) => c.id === 'some-id')
const allWeapons = SalvageUnionReference.Equipment.all()
```

## Adding New Data

1. Add JSON file to `data/`
2. Add corresponding schema to `schemas/`
3. Update `tools/schemaNameMap.ts` if needed
4. Run `bun run generate`
5. Run `bun test` to verify

## Validation

- `bun run validate:all` - Check IDs, cross-references, action references
- `bun run validate:ids` - Unique ID check only
