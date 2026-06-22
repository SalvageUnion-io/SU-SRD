# TTRPG UX Designer - Agent Memory

## Project Structure

- Monorepo at `/Users/jarvis/Code/su-io/SU-SRD/`
- Architecture docs: `docs/architecture/` (display-system, data-flow, seo-accessibility, package-contracts)
- Shared theme: `packages/suref-react/src/styles/theme.css` (CSS custom properties, Fira Code font)
- Game data: `packages/salvageunion-reference/` (ORM-like API, `SalvageUnionReference.get(schemaName, id)`)
- ITUN app: `apps/in-the-union-now/` (React 19 + TanStack Router/Query + ShadCN + Tailwind v4)

## Three-Layer Display System

1. **DisplayCard** (`packages/suref-react/src/components/shared/DisplayCard.tsx`): Low-level card with two boolean props (`compact` for reduced spacing, `listing` for header-only), controls architecture, stats system (StatsBar), tabs, sticky headers
2. **ReferenceEntityDisplay** (`packages/suref-react/src/components/referenceEntity/`): Entity renderer with generic slot props (titleOverride, subtitleExtra, statsOverride, abilitiesSection, afterExtraContent, footerOverride). Uses data-shape detection, not schema-name checks.
3. **Consumer hooks**: Return slot props to spread onto ReferenceEntityDisplay (e.g., `useChassisPatternConfig`)

## Key Shared Components

- `DisplayCard` — Card primitive (replaces old Card component)
- `ReferenceEntityDisplay` — Entity renderer (replaces old EntityDisplay)
- `FilterChip` — Toggle chip with `aria-pressed`
- `StatsBar` / `StatDisplay` / `StatControl` — Stats rendering (read-only or interactive)
- `ValueDisplay` — Labeled value display
- `Text` — Base typography component
- `ControlButtons` — Renders `ReferenceEntityControl[]` array
- Control presets: `addControl`, `deleteControl`, `navigateControl`, `selectControl`

## UI Framework (ITUN)

- **ShadCN + Tailwind v4 + Radix** (NOT Chakra)
- ShadCN primitives in `src/components/ui/`
- Custom theme via CSS variables in `src/index.css` `@theme` block
- State: Zustand (auth only) + TanStack Query (all entity data)

## Theme & Color Notes

- Entity colors: orange=pilot, green=mech, pink=crawler
- GREEN (122,151,138) and PINK (206,88,152) used as accents/borders only, not for text (WCAG AA)
- `su-orange-dark` (168, 82, 34) provides 5.5:1 contrast ratio for text
- Heat colors need NEW tokens: critical red (200,50,50), atCap red (180,30,30)
- Expansion source theming: claw-scratch, beveled border, rain-streak, CRT scanlines

## ITUN UX Review (Feb 2025)

- Key issues: sticky header too tall on mobile (needs auto-collapse), actions tab should filter by action type not source, 3-col grids need responsive breakpoints, needs FAB for d20 roll, condition cycling needs undo protection
- Recommended: collapsible sticky header, action-type filter chips, responsive 1/2/3-col grid, floating d20 FAB, segmented control for conditions

## Accessibility Patterns

- `eslint-plugin-jsx-a11y` in all ESLint configs
- `tools/a11y-scan.ts` (puppeteer + axe-core) for runtime scanning
- DisplayCard: `role="button"` + `tabIndex={0}` when clickable, Enter/Space keydown
- Tab panels: `role="tablist"` / `role="tab"` / `aria-selected`
- Search: ARIA combobox with `aria-activedescendant`
- Mobile touch targets: 44x44px min via `@media (pointer: coarse)`

## Data Flow (ITUN)

- `entity_refs` table bridges player data to game data (schema_name + schema_ref_id)
- Hydration: `SalvageUnionReference.get(ref.schema_name, ref.schema_ref_id)` at query time
- TanStack Query: 5min staleTime, hierarchical query key factories, optimistic updates
- Realtime: `useRealtimeSubscription` invalidates TanStack Query caches on DB changes
