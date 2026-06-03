# Display System Architecture

The entity rendering system is a three-layer stack: **DisplayCard** (flexible card primitive) -> **ReferenceEntityDisplay** (entity renderer with slot props) -> **Consumer patterns** (app-specific customization via hooks and overrides).

## Layer 1: DisplayCard

**File:** `packages/suref-react/src/components/shared/DisplayCard.tsx`

DisplayCard is the low-level card UI component used by both apps. It handles layout, controls, stats, tabs, and sticky headers.

### Display Modes

Two independent boolean props control display density:

| Prop | Purpose | Effect |
|------|---------|--------|
| (default) | Standard card with all sections | Header + Body + Footer, full spacing |
| `compact` | Reduced spacing for grids/inline use | Header + Body + Footer, smaller text and tighter gaps |
| `listing` | Header-only rendering for entity lists | Body, footer, and tabs hidden |

`compact` and `listing` are orthogonal — a listing card can be compact (tight header) or full-size (spacious header).

```tsx
<DisplayCard compact listing controls={[navigateControl(onClick)]} stats={headerStats}>
  {/* body hidden in listing mode */}
</DisplayCard>
```

### Controls Architecture

Controls are interactive buttons rendered in the card header. Type: `ReferenceEntityControl[]`.

```typescript
type ReferenceEntityControl = {
  key: string
  icon: (props: { className?: string }) => ReactNode
  onClick: () => void
  ariaLabel: string
  variant?: 'primary' | 'danger' | 'ghost'    // Visual style
  hidden?: boolean       // Not rendered, but participates in card click
  cardClick?: boolean    // Makes entire card clickable (hover enlarge effect)
  hoverContent?: ReactNode
  label?: string
  className?: string
}
```

**Preset factories** (`referenceEntityControls.ts`):

| Factory | Icon | Variant | Behavior |
|---------|------|---------|----------|
| `addControl(onClick)` | Plus | primary | `hidden: true`, `cardClick: true` |
| `selectControl(onClick, selected?)` | Circle/CheckCircle | ghost | Visible toggle button |
| `deleteControl(onClick)` | Trash | danger | Visible delete button |
| `navigateControl(onClick)` | DetailIcon | ghost | `hidden: true`, `cardClick: true` |

Hidden controls with `cardClick: true` make the whole card a click target without showing a visible button.

### Stats System

Stats render in the header via `StatsBar`. Type: `StatItem[]`.

```typescript
type StatItem = {
  key: string
  label: string
  value: number | string | undefined
  outOfMax?: number           // Renders as "value / max"
  bottomLabel?: string
  // Visual
  inverse?: boolean; bg?: string; valueColor?: string; borderColor?: string
  isOverMax?: boolean; flash?: boolean; disabled?: boolean
  // Interactivity
  onChange?: (newValue: number) => void   // Renders +/- buttons (StatControl)
  onClick?: () => void                     // Makes stat box itself a button
}
```

When `onChange` is present, `StatsBar` renders `StatControl` (interactive with +/- buttons). Otherwise, it renders `StatDisplay` (read-only).

### Tabs

```typescript
type DisplayCardTab = {
  key: string
  label: string
  content: ReactNode
  activeColor?: string   // CSS color override for active tab background
}
```

- Hidden in listing mode
- Default tab uses `defaultTabLabel` prop (default: `"Info"`)
- Active tabs get a pale tinted background (35% color mix with white)
- Tab bar: monospace, uppercase, `text-xs`

### Sticky Headers

When `stickyHeader: true`, the header sticks to the top of the scroll container. Measures height via ResizeObserver and provides `StickyOffsetContext` so nested section separators can stack below.

### Accessibility

- `role="button"` + `tabIndex={0}` when card is clickable
- `onKeyDown` handles Enter + Space
- `role="tablist"` / `role="tab"` / `aria-selected` for tab panels

---

## Layer 2: ReferenceEntityDisplay

**Files:** `packages/suref-react/src/components/referenceEntity/ReferenceEntityDisplay/`

ReferenceEntityDisplay wraps DisplayCard with entity-aware rendering. It computes header colors, spacing, typography, and section visibility from entity data, then delegates layout to DisplayCard.

### Generic Slot Props

No entity-specific props exist on ReferenceEntityDisplay. Consumers customize rendering via generic slot props:

```typescript
type ReferenceEntityDisplayStateInput = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  compact: boolean

  // Display modes
  listing?: boolean
  damaged?: boolean
  disabled?: boolean
  dimHeader?: boolean

  // Slot overrides (no schema-specific knowledge)
  titleOverride?: string              // Overrides computed title
  subtitleExtra?: ReactNode           // Appended after standard subtitle
  statsOverride?: { value: number; bottomLabel: string }  // Overrides SV stat
  primaryStatsOnly?: boolean          // Show only primary stat (SV)
  abilitiesSection?: ReactNode        // Replaces built-in chassis abilities
  afterExtraContent?: ReactNode       // After patterns/damagedEffect, before grants/choices
  afterChoicesContent?: ReactNode     // After choices, before footer
  footerOverride?: ReactNode          // Replaces computed footer
  titleSlot?: ReactNode               // Replaces computed title node entirely
  titleAs?: 'span' | 'h1'            // HTML element for title

  // Visibility toggles
  hide?: ReferenceEntityHideConfig
  label?: string                      // Pseudoheader label above card
  headerColor?: string                // Override header background (Tailwind class)
  headerBgColor?: string              // Override header background (raw CSS color)
}
```

### ReferenceEntityHideConfig

```typescript
type ReferenceEntityHideConfig = {
  actions?: boolean
  patterns?: boolean
  damagedEffect?: boolean
  choices?: boolean
  stats?: boolean
  content?: boolean
  rollTable?: boolean
  footer?: boolean
}
```

### useReferenceEntityDisplayState Hook

Computes display state from input props + entity data. Returns `ReferenceEntityDisplayState` which extends the input with:

- `title` — From `titleOverride` or `data.name`
- `techLevel` — Via `getTechLevel(data)`
- `headerBg` — Schema-driven color, or `bg-su-grey` when `damaged: true`
- `spacing` — Tailwind class strings for gaps/padding at current compact level
- `fontSize` — Tailwind class strings for text sizes at current compact level
- `chassisAbilities`, `effects`, `table`, `assetUrl` — Memoized data-shape extractions
- `visibleActions`, `actionsToDisplay`, `matchingAction` — Filtered action lists

### Data-Shape Driven Logic

The system detects entity capabilities by checking for properties rather than comparing schema names:

```typescript
// Example: getClassSelections checks for 'coreTrees' and 'hybrid' properties
if ('coreTrees' in data && Array.isArray(data.coreTrees)) {
  selectedClass = data as SURefClass
}
```

This keeps the display layer schema-agnostic and enables reuse across entity types.

### Damage Overlay

The `damageOverlayText` prop renders a semi-translucent overlay with a red danger box on top of the card body:

```tsx
<div className="pointer-events-none absolute inset-0 z-10 ... bg-black/50">
  <div className="border-2 border-red-500/60 bg-red-800/90 ...">
    <Text variant="pseudoheader">Damaged</Text>
    <Text>{damageOverlayText}</Text>
  </div>
</div>
```

When `damaged: true`, the header switches to `bg-su-grey`.

### Source/Expansion Theming

`getSourceBorderColor(source)` returns themed border colors. Expansion-specific texture styles (crosshatch, bevel, scan-lines) are applied internally by `ReferenceEntityDisplayContent` and are not part of the public API.

---

## Layer 2.5: Choice-Card / Grants Layer

This layer sits between ReferenceEntityDisplay (the card frame) and the consumers. It handles granted-equipment choices — entities like the Custom Sniper Rifle that carry selectable options that modify their stat row.

### Choice-Card Components (`choiceCard/`)

**File:** `packages/suref-react/src/components/referenceEntity/choiceCard/`

Three exported variants, all sharing a coloured-header + white-inset-body visual language matching entity cards:

| Component | Purpose |
|-----------|---------|
| `ChoiceCard` | Selectable option (`aria-pressed`, toggles chosen/not-chosen status stamp) |
| `FreeTextChoiceCard` | Editable free-text field (Name / Appearance / A.I. Personality) — always renders as "chosen" |
| `StaticChoiceCard` | Display-only list items (NPC motivations, bullet options); borrowed choice-card chrome, no interactivity |

`BlockContentRendererView` renders `list-item` content blocks as `StaticChoiceCard` (the bordered frame replaces plain bullets).

### ChoiceGroup / ChoiceGroups

`ChoiceGroups` is the top-level interactive renderer for a set of choices. It accepts `choices: SURefObjectChoice[]` and owns the selection state, with two modes:

- **Uncontrolled** (no `selections` / `onSelectionChange` props): self-manages ephemeral React state. Used by `suref-web` — no persistence, lost on refresh.
- **Controlled** (`selections` + `onSelectionChange` props): caller owns state. Used by ITUN, which wires through its persistence stores.

`ChoiceGroup` (singular) renders one choice — its heading + either option cards or a free-text card.

### choiceSelectionHelpers

`packages/suref-react/src/components/referenceEntity/choiceCard/choiceSelectionHelpers.ts`

Pure helpers (no React), all exported from `suref-react`:

| Export | Purpose |
|--------|---------|
| `ChoiceSelections` | Type: `Record<string, string[]>` — selections keyed by choice id |
| `ChoiceCardOption` | Distilled option shape (value, label, description, optional schema link) |
| `getChoiceCardOptions(choice)` | Distils `choiceOptions` or `schemaEntities` into a flat `ChoiceCardOption[]` |
| `isFreeTextChoice(choice)` | Returns true for `choiceType: 'freeform'` or choices with no option source |
| `isMultiSelectChoice(choice)` | Returns true when `choice.multiSelect === true` |
| `resolveMultiSelectCap(choice, parent)` | Resolves `constraints.max` or `constraints.scalesWithField` to a numeric cap |
| `toggleSelection(current, value, multiSelect, cap?)` | Pure selection-set reducer; enforces exclusive/multi-select rules |

### ReferenceEntityResolvedChoices

Renders the interactive choice-group cards for a choice-bearing entity. Receives `selections` + `onSelectionChange` from the parent display so the header data row and the body cards share one source of truth.

### ReferenceEntityResolvedDataRow

Renders the live resolved data tags in the subtitle/header area. Given `selections`, calls `resolveChoiceView` from `salvageunion-reference` and returns a fragment of `DataValueDisplayView` tags showing: base datavalues with applied effects, resolved traits, and segmented "Choose: …" prompts for unresolved required choices. Updates live as choices are toggled.

### ReferenceEntityGrants

Renders the `Grants` section separator + compact nested `ReferenceEntityDisplay` cards for each entity resolved by `resolveGrantedEntities`. When the parent is compact (listing mode), the nested cards collapse to header-only (`listing: true`). Actions are suppressed on nested cards (the same-named action lives on the ability itself).

**`resolveGrantedEntities` (salvageunion-reference):** the shared helper that walks `entity.grants`, skips `schema: 'choice'` entries, and resolves each remaining grant to a live entity via the ORM. Single source of truth for both the display layer and tooling.

### resolveChoiceView (salvageunion-reference)

`packages/salvageunion-reference/lib/resolveChoiceView.ts`

Pure, deterministic resolver (no I/O). Given an entity and `ChoiceSelections`, returns a `ResolvedChoiceView`:

```typescript
type ResolvedChoiceView = {
  datavalues: SURefObjectDataValue[]   // base row + applied effects
  traits:     SURefObjectTrait[]       // base traits + addTrait effects
  prompts:    ChoicePrompt[]           // unresolved required choices
}
```

Effects: `addDamage` bumps a Damage datavalue, `setRange` replaces Range, `addTrait` appends a trait. `unit` on a DataValue produces a 3-segment tag `[LABEL][value][unit]` (e.g. "Damage 2 SP"). Exported from `salvageunion-reference` alongside `type ChoiceSelections` and `type ResolvedChoiceView`.

### Entity href injection (route-agnostic)

`packages/suref-react/src/components/referenceEntity/ReferenceEntityDisplay/entityHrefContext.ts`

The shared library does not know app routes. `EntityHrefProvider` supplies an `EntityHrefBuilder` (`(entity) => string | undefined`); `ReferenceEntityGrants`'s nested "View Details" control reads it via `useEntityHref(entity)`. suref-web provides `srdEntityHref` (`/schema/<schema>/item/<slug>/`) at the island level; with no provider there is no link (correct for consumers like ITUN with different routing).

### isGrantingAbility — Ability → Grants Collapse Pattern

When a class ability grants equipment (e.g. "Custom Sniper Rifle"), the entity display re-skins its body:

1. `resolveGrantedEntities(data)` is called; if the result is non-empty **and** the entity is an ability (`isAbility(data)`), `isGrantingAbility` is set to `true`.
2. **Body substitution:** the ability's own `content` blocks and `Actions` section are suppressed. The body renders the `ReferenceEntityGrants` block — the `Grants` divider plus the nested granted-equipment card (its non-lead content + resolved data row + choice cards).
3. **Header flavor preserved:** the ability's own `description` still renders in the right-header flavor slot — it does not conflict with the Grants block.
4. **Compact collapse:** in compact/listing contexts the nested granted-equipment card collapses to header-only (`listing: true` on the inner `ReferenceEntityDisplay`).

The `lead` field on `ContentBlock` marks a granted entity's intro sentence. It renders on the entity's **own page**, but `ReferenceEntityGrants` passes `hideLeadContent` to the nested card so the `lead` block is **hidden when nested in a grant** — there it would duplicate the granting ability's own `description`. Every other content block renders in both places.

---

## Layer 3: Consumer Patterns

### useChassisPatternConfig Hook

**File:** `packages/suref-react/src/components/referenceEntity/ReferenceEntityDisplay/useChassisPatternConfig.tsx`

Encapsulates all pattern-override display logic. Returns generic slot props to spread onto ReferenceEntityDisplay:

```typescript
function useChassisPatternConfig(
  data: SURefEntity,
  patternOverride: PatternOverrideData | undefined,
  compact: boolean
): ChassisPatternConfig | null
```

Returns: `{ titleOverride, subtitleExtra, statsOverride, primaryStatsOnly, abilitiesSection, afterExtraContent, hide }`.

Consumer usage (spread pattern):

```tsx
const patternConfig = useChassisPatternConfig(mechChassis, pattern, compact)
<ReferenceEntityDisplay data={mechChassis} {...patternConfig} />
```

### SubEntityCard (ITUN)

**File:** `apps/in-the-union-now/src/components/shared/SubEntityCard.tsx`

Renders equipment, abilities, and comrades with interactive stats and condition tracking. Uses slot props:

- `titleSlot` — `ComradeNameInput` for dynamic comrade naming
- `subtitleExtra` — `ValueDisplay` showing schema display name
- `stats` — Interactive stats with +/- via `ENTITY_STATS_CONFIG`
- `afterChoicesContent` — `EntityModificationSlots` for modification tracking

For granted-equipment choices (e.g. Custom Sniper Rifle), the new `ChoiceGroups` path is used instead: `ReferenceEntityResolvedChoices` (body) + `ReferenceEntityResolvedDataRow` (header subtitle) work together via controlled `selections` / `onSelectionChange` state. ITUN wires these to its persistence stores; suref-web uses the uncontrolled (ephemeral) mode.

### ReferenceEntityPickerModal (ITUN)

**File:** `apps/in-the-union-now/src/components/shared/ReferenceEntityPickerModal.tsx`

Selection UI rendering entities in compact listing mode. Splits entities into selectable, over-capacity (greyed, red outline), and over-budget groups. Uses `addControl()` preset.

### PlayerPilotDisplay (ITUN)

**File:** `apps/in-the-union-now/src/components/pilots/PlayerPilotDisplay.tsx`

Uses DisplayCard directly (not ReferenceEntityDisplay) because pilots aren't reference entities. Demonstrates direct DisplayCard usage with:

- Dynamic controls (navigate, settings, board/unboard, downtime)
- Context-sensitive stats (boarded: SP/EP/Heat; unboarded: HP/AP)
- Tabs (Abilities, Mech, Comrades, Actions)
- Custom header background patterns for boarded/downtime states

---

## When to Use Which Layer

| Scenario | Layer |
|----------|-------|
| Rendering game data entities (chassis, abilities, equipment, etc.) | ReferenceEntityDisplay |
| Rendering player-created entities (pilots) that aren't in reference data | DisplayCard directly |
| Customizing how a reference entity renders (pattern overrides, interactive stats) | Slot props on ReferenceEntityDisplay |
| Building a reusable entity selection UI | ReferenceEntityPickerModal (listing mode + addControl) |
| Adding new entity-type-specific display logic | Create a hook returning slot props, spread onto ReferenceEntityDisplay |

---

## Cross-References

- `.claude/rules/react-components.md` — Component structure conventions, prop type patterns
- `.claude/rules/display-system.md` — Quick-reference rule for editing display components
