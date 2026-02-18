# suref-react (Shared Component Library)

Shared React component library consumed by both `suref-web` and `in-the-union-now`.

## Key Facts

- **No build step** - exports TypeScript source directly via `src/index.ts` barrel
- **No Supabase dependency** - agnostic to data source
- Vite in consuming apps handles `.ts/.tsx` compilation
- Uses Tailwind + `cn()` utility for styling

## Contents

- **Theme:** Colors, recipes, design tokens
- **Base typography:** `Text` component
- **UI primitives:** `Tooltip`, `Toaster`, `Modal`
- **Entity display system:** ~30 files for rendering game data entities
- **Shared components:** `Card`, `ValueDisplay`, `SheetDisplay`, `RollTable`, etc.
- **Skeletons:** Loading state components
- **Utilities:** `slug()`, `parseTraitReferences()`, `cn()`
- **Constants:** Shared constants

## Entity Display System

The entity display uses a **render prop pattern** (`classAbilitiesRenderer`) so consuming apps can inject app-specific renderers without the shared library knowing about app-specific concerns.

## Testing

- Own `bunfig.toml` with happy-dom preload
- No Supabase env vars needed
- Run: `bun --filter suref-react test`

## Conventions

- Named exports only (via `src/index.ts` barrel)
- Use `cn()` for conditional Tailwind class merging
- Keep components data-source agnostic
- Use `type` over `interface` for props
