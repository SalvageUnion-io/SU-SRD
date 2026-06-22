# suref-react

Shared React component library for the SURef monorepo. Consumed by `apps/suref-web` and `apps/in-the-union-now`.

## Design constraints

- **No build step.** Exports TypeScript source directly via `src/index.ts`. Consuming apps compile via their own Vite/Astro setup.
- **No Supabase dependency.** Data-source agnostic. Apps pass data in; the library renders it.
- **Reusable across a static Astro site and a dynamic React SPA.** No framework-specific hooks that assume SSR, routing, or auth.

## Contents

- **Theme** — colors, tech-level tokens, recipes
- **Typography** — `Text`
- **UI primitives** — `Toaster` / `toast`, `ModalShell`, `ReferenceEntityDisplayTooltip`
- **Entity display system** — `DisplayCard`, `ReferenceEntityDisplay` and its slot components, the choice-card layer, and control factories (`addControl`, `deleteControl`, `navigateControl`)
- **Shared components** — `ValueDisplay`, `StatDisplay`, `StatsBar`, `RollTable`, `FilterChip`, skeletons
- **Utilities** — `nameToSlug`, `getEntitySlug`, `parseTraitReferences` helpers, `cn()`

See [package-contracts.md](../../docs/architecture/package-contracts.md) for the
full export list.

## Consuming

Workspace dependency:

```json
"suref-react": "workspace:*"
```

Import from the barrel:

```ts
import { ReferenceEntityDisplay, DisplayCard, Text } from 'suref-react'
```

## Scripts

| Script                           | What it does                        |
| -------------------------------- | ----------------------------------- |
| `bun --filter suref-react test`  | Run component tests (happy-dom)     |
| `bun --filter suref-react ladle` | Launch Ladle for component browsing |
| `bun run typecheck`              | Typecheck (from repo root)          |

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — conventions for this package
- [`/docs/architecture/display-system.md`](../../docs/architecture/display-system.md) — 3-layer render stack
- [`/docs/architecture/package-contracts.md`](../../docs/architecture/package-contracts.md) — package API rules
