---
paths:
  - packages/component-lib/src/components/shared/DisplayCard*
  - packages/component-lib/src/components/referenceEntity/**
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

## Choice-Card Layer (Granted Equipment)

For entities with `choices` (e.g. Custom Sniper Rifle granted by a class ability):

- `ReferenceEntityResolvedChoices` renders the interactive `ChoiceGroups` in the card body.
- `ReferenceEntityResolvedDataRow` renders live resolved stat tags in the header (base datavalues + applied choice effects + trait list + unresolved "Choose: …" prompts), via `resolveChoiceView` from `salvageunion-reference`.
- Both components share a single `selections: ChoiceSelections` / `onSelectionChange` pair owned by the parent display.
- `ChoiceGroups` is uncontrolled (ephemeral state) in srd; controlled (persistence-wired) in ITUN.
- `StaticChoiceCard` is the display-only variant used by `BlockContentRendererView` to render `list-item` content blocks with the same bordered frame (no toggle/status).
- `ReferenceEntityGrants` renders a `Grants` section + compact nested `ReferenceEntityDisplay` cards, resolved by `resolveGrantedEntities` from `salvageunion-reference`.

## isGrantingAbility — Ability → Grants Collapse

When an ability entity has `grants` that resolve to equipment (`resolveGrantedEntities` returns non-empty), `isGrantingAbility` is `true`. This collapses the ability's body:

- **Suppresses** the ability's own `content` blocks and `Actions` section.
- **Shows** the `Grants` block (nested compact equipment cards with resolved data row + choice cards).
- The ability's `description` still renders in the right-header flavor slot.
- In compact/listing contexts the nested equipment card collapses further to header-only (`listing: true` on the inner `ReferenceEntityDisplay`).

The `lead: true` field on a `ContentBlock` marks a granted entity's intro sentence: it renders on the entity's own page, but `ReferenceEntityGrants` passes `hideLeadContent` to the nested card so the `lead` block is hidden when nested in a grant (there it would duplicate the granting ability's own description). All other content renders in both places.

## Stats

Interactive stats use `onChange` on `StatItem` (renders +/- buttons). Read-only stats omit `onChange`. Both go through `StatsBar`.
