# SURef

A Bun application containing the SURef web application with integrated Salvage Union Reference data.

> **Note**: For detailed documentation, see [docs/README.md](docs/README.md)

## Quick Start

### First Time Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

### Daily Development

```bash
# Start development server
bun run dev
```

## Structure

```
.
├── src/
│   ├── components/          # React components
│   ├── hooks/              # TanStack Query hooks
│   ├── lib/                # Utilities and API clients
│   ├── routes/             # TanStack Router routes
│   ├── types/              # TypeScript types
│   ├── reference/          # Reference data module (formerly package)
│   │   ├── data/           # JSON data files
│   │   ├── schemas/        # JSON schemas
│   │   └── ...             # TypeScript ORM and utilities
│   └── ...
├── tools/                  # Code generation scripts
├── package.json            # Root configuration
├── .prettierrc.json        # Prettier config
├── eslint.config.js        # ESLint config
└── tsconfig.json           # TypeScript config
```

## Common Commands

### Development

```bash
# Start dev server
bun run dev

# Type check
bun run typecheck

# Build for production
bun run build
```

### Quality Checks

```bash
# Run all checks
bun run check:all

# Individual checks
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run validate:all
```

### Code Generation

```bash
# Generate JSON schemas
bun run generate:json-schemas

# Generate database types
bun run gen:types

# Generate Zod schemas
bun run gen:zod

# Generate all types
bun run gen:all
```

## Making Changes to Reference Data

1. Edit files in `src/reference/data/` or `src/reference/schemas/`
2. Run code generation if needed:
   ```bash
   bun run generate:json-schemas
   ```
3. Changes are immediately available in the application

**Note**: TypeScript types are generated automatically from schemas.

## Troubleshooting

### TypeScript can't find types

**Solution**: Run type generation:

```bash
bun run gen:all
```

### Build fails with lint errors

**Solution**: Fix lint errors:

```bash
bun run lint -- --fix
```

### Dependencies not found

**Solution**: Reinstall dependencies:

```bash
bun install
```

## Application

### suref-web

The main web application for viewing and exploring Salvage Union game data.

- **Dynamic Schema Loading**: Automatically reads all schemas from the reference module
- **Search**: Search items by name or description
- **Filtering**: Filter data by any field with multiple values
- **Sorting**: Click column headers to sort data
- **Detail View**: Click "View Details" to see all fields for any item

## Reference Module

The reference module (`src/reference/`) provides:

- Comprehensive, schema-validated JSON dataset for the Salvage Union tabletop RPG
- TypeScript ORM for type-safe data access
- Code generation from schemas
- Search and filtering utilities

Access via: `import { SalvageUnionReference } from './reference'`

## Documentation

For more detailed documentation, see:

- [docs/README.md](docs/README.md) - Full documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Architecture overview
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development guide
