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

## Stories (Ladle)

Component stories live beside their components (`*.stories.tsx`) and are served by Ladle (`bun run ladle` from the repo root).

- **Every story MUST render with real SRD data or real game terms — never lorem/placeholder/invented content.** Drive stories from `SalvageUnionReference.*` fixtures (e.g. `SalvageUnionReference.Chassis.all()[0]`, `SalvageUnionReference.Actions.all()[0]`), and when a prop needs a literal (a label, a stat name, a condition), use the real game term, not a stand-in. A story is a preview of what ships; fake data hides real rendering bugs (overflow, wrapping, tone, empty-state) that only surface with production content.
- **Render entities the way we actually render them.** Feed props exactly as consuming apps do — real values in the real shapes, through the real components (e.g. entities via `ReferenceEntityDisplay`, stats via `StatDisplay`). Don't hand-assemble simplified markup that no app produces; the story must exercise the same path production does.
- Reference data is preloaded by `.ladle/components.tsx` (a `use()` + `Suspense` gate calling `SalvageUnionReference.preload('all')`) — mirror how ITUN's `GameDataReady` and suref-web's `useGameData` gate. Reading a `SalvageUnionReference.*` model at story-module top level before that gate throws "Schema not loaded" and renders silently blank, so keep new stories consistent with the existing preload pattern.
- **Coverage is enforced in lockstep** by `src/story-coverage.test.ts`: every barrel-exported visual component must be referenced by at least one `*.stories.tsx`. When you add a public component to `src/index.ts`, add a story in the same change — the guard fails otherwise. The only escape is its `ALLOWLIST`, reserved for genuine internal sub-parts demonstrated through their parent (each needs a one-line rationale). The guard also fails on **stale** allowlist entries (a name that gained a story, or no longer exists), so prune the allowlist when you story a component or delete one.
- **The story's group title encodes refresh status.** A story lands under `Legacy/*` when its component **has not yet gotten the canonical-primitive refresh** — i.e. it still uses pre-canon tokens (`su-grey*`, `su-white`, `su-black`, `tracking-wider`, arbitrary `text-[Npx]` / `rounded-[Npx]`) or is an un-refreshed referenceEntity composition. Once a component is refreshed onto the canon (paper/ink/chrome tokens, Stamp/Slab, the shared radius/tracking scales), **move its story out of `Legacy/`** into the right group (`Atoms` / `Compositions` / `Containers` / `Foundations`). Legacy is a staging area to be drained, not a permanent home — new stories for already-canonical components skip it.

## Testing

- Own `bunfig.toml` with happy-dom preload
- No backend env vars needed
- Run: `bun --filter suref-react test`

## Conventions

- Named exports only (via `src/index.ts` barrel)
- Use `cn()` for conditional Tailwind class merging
- Keep components data-source agnostic
- Use `type` over `interface` for props
