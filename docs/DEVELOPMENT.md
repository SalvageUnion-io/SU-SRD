# Development Guide

This guide covers the development workflow, common tasks, and best practices for contributing to SURef.

## Getting Started

### Prerequisites

- **Bun** >= 1.0.0 (package manager and runtime)
- **Node.js** >= 18.0.0 (required by some tools)

### First Time Setup

```bash
# Clone the repository
git clone <repository-url>
cd SU-SRD

# Install dependencies for all workspaces (sets up workspace links)
# This installs dependencies for both apps/ and packages/
bun install

# Build the reference package (required for types)
bun run build:package

# Start development server
bun run dev
```

### Bun Workspace Structure

This is a Bun workspace monorepo following [Bun workspace best practices](https://bun.com/docs/guides/install/workspaces):

- Root `package.json` is marked `"private": true` to prevent accidental publishing
- Each package/app is self-contained with its own dependencies
- Workspace dependencies use `workspace:*` protocol
- Run `bun install` from root to install dependencies for all workspaces
- Add dependencies to specific workspaces by `cd`ing into the package directory

## Development Workflow

### Daily Development

```bash
# Start dev server (builds package + starts app)
bun run dev

# Or work on a specific package
cd apps/suref-web
bun run dev
```

### Making Changes

1. **Create a branch** from `main`
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes**
   - Edit files as needed
   - Pre-commit hooks will run automatically on commit

3. **Run quality checks**
   ```bash
   bun run sanity        # Run lint, format, typecheck
   bun run test          # Run tests
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Your commit message"
   # Pre-commit hooks run automatically
   ```

### Working with the Reference Package

When modifying `salvageunion-reference`:

1. Edit files in `packages/salvageunion-reference/lib/` or `data/`
2. Rebuild the package:
   ```bash
   bun run build:package:quick  # Quick rebuild (dev)
   # or
   bun run build:package        # Full rebuild (includes tests/lint)
   ```
3. Changes are immediately available to `suref-web` via workspace linking

**Note**: The package must be built for TypeScript types to resolve correctly.

## Code Style

### TypeScript

- Use strict TypeScript settings (enabled in `tsconfig.json`)
- Prefer `type` over `interface` for object types (unless extending)
- Prefer relative imports over path aliases
- Avoid `any` - use `unknown` if type is truly unknown

### Imports

**Prefer relative imports over path aliases:**

```ts
// ✅ Correct - use relative imports
import { useHydratedPilot } from '../../hooks/pilot'
import { supabase } from '../lib/supabase'
import { PilotWizard } from '../components/PilotWizard'
```

**Avoid path aliases:**
```ts
// ❌ Avoid - path aliases hide file structure
import { useHydratedPilot } from '@/hooks/pilot'
import { supabase } from '@/lib/supabase'
import { PilotWizard } from '@/components/PilotWizard'
```

Relative imports make file relationships explicit and clear. This applies to ALL files including route files, components, hooks, utilities, etc.

### React Components

- Use functional components with TypeScript
- Named exports for components (not default exports, except route components)
- Props interfaces at top of file
- Use Chakra UI components from `@chakra-ui/react`

### TanStack Query Hooks

**Query Key Factory:**
```ts
export const pilotsKeys = {
  all: ['pilots'] as const,
  detail: (id: string) => [...pilotsKeys.all, id] as const,
}
```

**Query Hook:**
```ts
export function usePilot(id: string | undefined) {
  return useQuery({
    queryKey: pilotsKeys.detail(id!),
    queryFn: () => fetchPilot(id!),
    enabled: !!id,
  })
}
```

**Mutation Hook:**
```ts
export function useUpdatePilot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePilot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pilotsKeys.all })
    },
  })
}
```

### File Organization

- Components: `src/components/{Feature}/`
- Hooks: `src/hooks/{domain}/`
- API clients: `src/lib/api/`
- Utilities: `src/utils/`
- Types: `src/types/`

## Common Tasks

### Adding a New Component

1. Create component file in appropriate directory
2. Use path aliases for imports
3. Export from component directory's `index.ts` if part of feature

### Adding a New Hook

1. Create hook file in `src/hooks/{domain}/`
2. Export from domain's `index.ts`
3. Follow TanStack Query patterns (query keys, mutations)

### Adding a New Route

1. Create route file in `src/routes/`
2. File name determines route path
3. Use route loaders for data fetching

### Updating Database Schema

1. Create migration in `apps/suref-web/supabase/migrations/`
2. Apply migration to database
3. Regenerate types: `bun run gen:types`

### Adding Reference Data

1. Add JSON file to `packages/salvageunion-reference/data/`
2. Add schema to `packages/salvageunion-reference/schemas/`
3. Run `bun run generate` in reference package
4. Rebuild package: `bun run build:package`

## Quality Checks

### Before Committing

Pre-commit hooks automatically run:
- Lint fix on staged files
- Format fix on staged files
- Type check
- Tests

### Manual Checks

```bash
# Run all checks
bun run sanity

# Individual checks
bun run lint
bun run format:check
bun run typecheck
bun run test

# Test coverage
bun run test:coverage
```

## Debugging

### Type Errors

If TypeScript can't resolve types:
1. Ensure reference package is built: `bun run build:package:quick`
2. Restart TypeScript server in editor
3. Check `tsconfig.json` paths configuration

### Build Errors

If build fails:
1. Clean build artifacts: `bun run clean`
2. Reinstall dependencies: `bun install`
3. Rebuild package: `bun run build:package`

### Runtime Errors

- Check browser console for errors
- Check Error Boundary output
- Verify environment variables are set
- Check Supabase connection

## Environment Variables

Required variables (see `.env.example`):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

Optional variables:
- `VITE_SITE_URL` - Site URL for sitemap
- `VITE_SHOW_DISCORD_SIGNIN` - Enable Discord sign-in
- `VITE_GA_MEASUREMENT_ID` - Google Analytics ID

## Testing

### Running Tests

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Coverage
bun run test:coverage
```

### Writing Tests

- Use `*.test.ts` or `*.test.tsx` naming
- Use Testing Library for component tests
- Mock Supabase client for API tests
- Test user interactions, not implementation details

## Git Workflow

1. Create feature branch from `main`
2. Make changes and commit (pre-commit hooks run)
3. Push branch and create PR
4. CI runs quality checks
5. Review and merge

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

