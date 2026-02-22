---
paths:
  - packages/suref-react/src/components/shared/DisplayCard*
  - packages/suref-react/src/components/referenceEntity/**
---

# Display System Rules

See `docs/architecture/display-system.md` for the full architecture.

## Three Layers

1. **DisplayCard** — Low-level card primitive. Two boolean props: `compact` (reduced spacing) and `listing` (header-only). Use directly only for non-reference entities (e.g., PlayerPilotDisplay).
2. **ReferenceEntityDisplay** — Entity renderer wrapping DisplayCard. Use for all game data entities (chassis, abilities, equipment, etc.).
3. **Consumer hooks** — Return generic slot props to spread onto ReferenceEntityDisplay (e.g., `useChassisPatternConfig`).

## When to Use Which

- Rendering a reference entity? Use `ReferenceEntityDisplay`.
- Rendering a player-created entity (pilot)? Use `DisplayCard` directly.
- Need entity-type-specific customization? Create a hook returning slot props, spread onto `ReferenceEntityDisplay`. Do NOT add schema-specific props to the component.

## Slot Props Pattern

Customize rendering via generic overrides, never schema-specific props:

```tsx
// Good: hook computes overrides, consumer spreads them
const config = useChassisPatternConfig(data, pattern, compact)
<ReferenceEntityDisplay data={data} {...config} />

// Bad: schema-specific prop on the component
<ReferenceEntityDisplay data={data} patternOverride={pattern} />
```

Available slot props: `titleOverride`, `subtitleExtra`, `statsOverride`, `primaryStatsOnly`, `abilitiesSection`, `afterExtraContent`, `afterChoicesContent`, `footerOverride`, `titleSlot`, `titleAs`.

Visibility toggles: `hide?: { actions, patterns, damagedEffect, choices, stats, content, rollTable, footer }`.

## Controls

Use preset factories from `referenceEntityControls.ts`:
- `addControl(onClick)` — hidden + cardClick (whole card clickable)
- `navigateControl(onClick)` — hidden + cardClick
- `selectControl(onClick, selected?)` — visible toggle
- `deleteControl(onClick)` — visible danger button

## Data-Shape Logic

Prefer data-shape checks (`'coreTrees' in data`) over schema-name checks (`schemaName === 'classes'`). This keeps the display layer schema-agnostic.

## Stats

Interactive stats use `onChange` on `StatItem` (renders +/- buttons). Read-only stats omit `onChange`. Both go through `StatsBar`.
