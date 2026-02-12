---
paths:
  - "packages/salvageunion-reference/**"
---

# Package Development

Patterns for developing the salvageunion-reference package with code generation.

## Package Structure

- `lib/` - TypeScript files
- `data/` - JSON data files
- `schemas/` - JSON Schema files
- `tools/` - Code generation scripts
- `dist/` - Compiled output (generated, don't edit)

## Code Generation

Always run generation after schema/data changes:

```bash
bun run generate
```

**NEVER manually edit auto-generated files:**

- `lib/utilities-generated.ts`
- `lib/types/schemas.ts`
- `lib/types/enums.ts`
- `lib/types/common.ts`
- `lib/types/objects.ts`
- `lib/types/index.ts`
- `lib/index.ts` (generated from `lib/index.template.ts`)

To modify generated code:

1. Edit generator scripts in `tools/` directory or template files (e.g., `lib/index.template.ts`)
2. Run `bun run generate`

## Manual Override Files

These files are NOT generated and can be edited directly:

- `lib/utilities.ts`
- `lib/ModelFactory.ts`
- `lib/BaseModel.ts`
- `lib/search.ts`

## Model Structure

- All models extend `BaseModel<T>`
- Created via `ModelFactory`
- Use `SalvageUnionReference` static properties to access models
- Models provide: `all()`, `find()`, `findAll()` methods

## Testing

- Tests use Bun's built-in test runner
- Test files: `*.test.ts`
- Run tests with `bun test`
- Tests validate schema compliance and data integrity

## Adding New Data

1. Add JSON file to `data/` directory
2. Add corresponding schema to `schemas/` directory
3. Update `tools/schemaNameMap.ts` if needed
4. Run `bun run generate`
5. Run `bun test` to verify

## Usage

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

const chassis = SalvageUnionReference.Chassis.find((c) => c.id === 'some-id')
```
