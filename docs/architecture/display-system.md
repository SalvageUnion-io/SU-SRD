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
  afterExtraContent?: ReactNode       // After patterns/damagedEffect, before grants
  afterChoicesContent?: ReactNode     // After choices, before footer
  footerOverride?: ReactNode          // Replaces computed footer
  titleSlot?: ReactNode               // Replaces computed title node entirely
  titleAs?: 'span' | 'h1'            // HTML element for title

  // Visibility toggles
  hide?: ReferenceEntityHideConfig
  label?: string                      // Pseudoheader label above card
  headerColor?: string                // Override header background
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

`getSourceStyles(source, disabled, variant, isExpanded)` returns themed styles per expansion book:

| Source | Effect |
|--------|--------|
| We Were Here First! | Beast claw-scratch crosshatch texture |
| False Flag | Windows 95 beveled border |
| Rainmaker | Driving rain-streak diagonal texture |
| Mech Monday | CRT horizontal scanline texture |

`getSourceBorderColor(source)` returns themed border colors.

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
- `choiceInputRenderer` — `LabeledInput` for comrade choices
- `stats` — Interactive stats with +/- via `ENTITY_STATS_CONFIG`
- `afterChoicesContent` — `EntityModificationSlots` for modification tracking

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
