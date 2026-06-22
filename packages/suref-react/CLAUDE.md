# suref-react (Shared Component Library)

Shared React component library consumed by both `suref-web` and `in-the-union-now`.

## Key Facts

- **No build step** - exports TypeScript source directly via `src/index.ts` barrel ([ADR-011](../../docs/adrs/ADR-011-suref-react-source-no-build.md))
- **Data-source agnostic** - no backend/persistence dependency; consumers inject behavior via slot props, and choice components are persistence-agnostic ([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md))
- Vite in consuming apps handles `.ts/.tsx` compilation
- Uses Tailwind + `cn()` utility for styling

## Contents

- **Theme:** Colors, recipes, design tokens
- **Base typography:** `Text` component
- **UI primitives:** `Toaster` / `toast`, `ModalShell`, `ReferenceEntityDisplayTooltip`
- **Entity display system:** ~58 source files for rendering game data entities (plus tests + stories)
- **Shared components:** `DisplayCard`, `ValueDisplay`, `StatDisplay`, `StatsBar`, `RollTable`, `FilterChip`, etc.
- **Skeletons:** Loading state components
- **Utilities:** `slug()`, `parseTraitReferences()`, `cn()`
- **Constants:** Shared constants

## Entity Display System

The entity display uses **generic slot props** (`afterExtraContent`, `abilitiesSection`, `footerOverride`, etc.) so consuming apps can inject app-specific renderers without the shared library knowing about app-specific concerns. Schema-specific logic is extracted into helper hooks (`useChassisPatternConfig`) and utilities (`getClassSelections`) that return generic override props.

## Testing

- Own `bunfig.toml` with happy-dom preload
- No backend env vars needed
- Run: `bun --filter suref-react test`

## Conventions

- Named exports only (via `src/index.ts` barrel)
- Use `cn()` for conditional Tailwind class merging
- Keep components data-source agnostic
- Use `type` over `interface` for props
