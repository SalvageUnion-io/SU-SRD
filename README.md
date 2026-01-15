# SURef Monorepo

A Bun monorepo containing the SURef web application and the Salvage Union Reference package.

> **Note**: For detailed documentation, see [docs/README.md](docs/README.md)

## Quick Start

### First Time Setup

```bash
# Install all dependencies (sets up workspace links)
bun install

# Build the reference package (required for types)
bun run build:package
```

### Daily Development

```bash
# Start development server (builds package and starts app)
bun run dev

# Or work on a specific package
cd apps/suref-web
bun run dev
```

## Structure

```
.
├── apps/
│   └── suref-web/              # Main web application
├── packages/
│   └── salvageunion-reference/ # Salvage Union game data package
├── package.json                # Root workspace configuration
├── .prettierrc.json            # Shared Prettier config
├── eslint.config.base.js      # Shared ESLint base config
└── tsconfig.base.json          # Shared TypeScript base config
```

## Common Commands

### Development

```bash
# Start dev server (builds package + starts app)
bun run dev

# Build package only (quick, skips tests/lint)
bun run build:package:quick

# Build package (full, includes tests/lint)
bun run build:package
```

### Quality Checks

```bash
# Run all checks on all packages
bun run lint:all
bun run format:check:all
bun run test:all
bun run sanity:all

# Run checks on specific package
bun --filter suref-web lint
bun --filter salvageunion-reference test
```

### Building

```bash
# Build everything (package + app)
bun run build

# Build specific package
bun --filter salvageunion-reference build
bun --filter suref-web build
```

## Workspace Scripts

All root scripts use `bun --filter` to target specific packages. You can also run scripts directly:

```bash
# Run scripts in suref-web app
bun --filter suref-web <script>

# Run scripts in salvageunion-reference package
bun --filter salvageunion-reference <script>

# Run scripts in all packages
bun --filter "*" <script>
```

### Available Root Scripts

- `dev` - Start development server
- `build` - Build package and app
- `build:package` - Build reference package (full)
- `build:package:quick` - Build reference package (quick, dev mode)
- `lint` / `lint:all` - Lint suref-web / all packages
- `format` / `format:all` - Format suref-web / all packages
- `format:check` / `format:check:all` - Check formatting
- `test` / `test:all` - Test suref-web / all packages
- `typecheck` - Type check suref-web
- `sanity` / `sanity:all` - Run lint, format, and typecheck
- `publish:package` - Publish salvageunion-reference to npm

## Making Changes to salvageunion-reference

1. Edit files in `packages/salvageunion-reference/lib/` or `data/`
2. Rebuild the package:
   ```bash
   bun run build:package:quick  # Quick rebuild (dev)
   # or
   bun run build:package        # Full rebuild (includes tests/lint)
   ```
3. Changes are immediately available to `suref-web` via workspace linking

**Note**: The package must be built for TypeScript types to resolve correctly.

## Troubleshooting

### TypeScript can't find salvageunion-reference

**Solution**: Build the package first:
```bash
bun run build:package:quick
```

### Workspace not linking correctly

**Solution**: Reinstall dependencies:
```bash
bun install
```

### Build fails with lint errors

The package build includes linting. Fix lint errors or run quick build:
```bash
bun run build:package:quick  # Skips lint
```

### Dependencies not found

**Solution**: Ensure you've run `bun install` from the root directory. Workspace dependencies are hoisted to root.

## Apps

### suref-web

The main web application for viewing and exploring Salvage Union game data.

- **Dynamic Schema Loading**: Automatically reads all schemas from the reference package
- **Search**: Search items by name or description
- **Filtering**: Filter data by any field with multiple values
- **Sorting**: Click column headers to sort data
- **Detail View**: Click "View Details" to see all fields for any item

## Packages

### salvageunion-reference

Comprehensive, schema-validated JSON dataset and TypeScript ORM for the Salvage Union tabletop RPG.

See [packages/salvageunion-reference/README.md](packages/salvageunion-reference/README.md) for details.

## Monorepo Best Practices

- **Shared Configs**: Prettier, ESLint base, and TypeScript base configs are at root
- **Hoisted Dependencies**: Shared dev dependencies (prettier, eslint, typescript) are in root `package.json`
- **Workspace Protocol**: Packages use `workspace:*` to reference each other
- **Filter Commands**: Use `bun --filter` instead of `cd` for better monorepo support
- **Single Lockfile**: Only `bun.lock` at root (no package-lock.json files)

## Documentation

For more detailed documentation, see:
- [docs/README.md](docs/README.md) - Full documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Architecture overview
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development guide
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Troubleshooting guide

