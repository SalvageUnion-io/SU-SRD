# Display System Architecture

> **Why this doc is short.** Its previous version described a three-layer stack
> whose middle layer — `ReferenceEntityDisplay` — no longer exists. It also
> documented `StatsBar`, `StaticChoiceCard`, `useReferenceEntityDisplayState`,
> `ReferenceEntityHideConfig`, three deleted control presets, Card tabs
> and sticky headers, and three ITUN consumer components, none of which are in
> the codebase. Roughly two thirds of its specific claims were false.
>
> This version follows the same philosophy as
> [`.claude/rules/display-system.md`](../../.claude/rules/display-system.md):
> **state the rules, which change slowly, and point at the source for the
> roster, which changes fast.** Do not re-add prop tables or component
> inventories here — they are what rotted last time. Read props off the
> defining file.

## The two card shells

There is no single stack. There are **two card shells**, deliberately separate:

- **`ReferenceEntityCard`** — `packages/component-lib/src/components/referenceEntity/card/ReferenceEntityCard.tsx`.
  THE renderer for game data. Every SRD entity — chassis, ability, equipment,
  action, NPC, pattern, drone — goes through it, in both apps. It implements the
  printed-card spec (frame on the inner clipping element so the seam stamp can
  escape the clip, book-style text sub-header, identity footer) and owns entity
  recursion: nested systems/modules/actions/grants render as nested cards,
  bounded by a `MAX_DEPTH` guard.
- **`Card`** — `packages/component-lib/src/components/shared/Card.tsx`.
  The generic four-band container (header / sub-header / body-plus-expand /
  footer) that non-entity surfaces compose: `ModalShell`, `SheetSection` /
  `SheetSectionCard`, `Callout`, `Skeleton`, and app-side panels such as ITUN's
  encounter cards.

**They are NOT being merged, and `ReferenceEntityCard` does not render through
`Card`** (it imports only the `CardFootMeta` type from it). A full
assessment found the composition impossible without visual deltas across every
SRD page — the frame-element difference alone shifts every absolute overlay by
3px, ghosted sub-header tones are underivable inside Card, and the two
resolve `cardClick` fallback in opposite directions. The entity card's header is
also semantically richer: it distinguishes a stat cluster from flavour prose to
decide which side yields, and Card's header slot is opaque to its
content.

So: **do not add entity-card features to Card**, and do not route the
entity card through it. What the two share is **vocabulary**, not DOM —
`displayMode`, the controls contract, `CardFootMeta`, `foldStatusControl`.

### Which one

| Rendering…                                                  | Use                                        |
| ----------------------------------------------------------- | ------------------------------------------ |
| A reference entity (anything from `salvageunion-reference`) | `ReferenceEntityCard`, always              |
| A non-entity container (modal body, sheet section, panel)   | `Card`                                     |
| A grid of entity cards                                      | `EntityGrid` / `EntityGridRow` around them |

Never hand-assemble entity markup, and never hand-assemble a `label | value`
readout — that is `Stat` (ruleset §3.7, and the most frequently broken rule in
this codebase).

## Sizing vocabulary

Card size is **two orthogonal axes**, defined and documented in
`packages/component-lib/src/components/shared/displayMode.ts`:

- `size`: `large | medium | small` — how big the card renders.
- `extent`: `full | head | catalog` — how much of the entity renders.

Both shells take `size` / `extent` and resolve them through
`resolveCardDisplay`; Card's internal layout then projects them to
`{ compact, listing }` via `displayBooleans`. They are independent — a `small`
card can still show its whole content, which the old conflated enum could not
express.

The old `compact` / `listing` **booleans on the card props are gone**. Do not
reintroduce a boolean that duplicates an axis. (Some lower-level helpers, e.g.
`getReferenceEntitySpacing` / `getReferenceEntityFontSizes` in
`referenceEntityTypes.ts`, still take a plain `compact` boolean — that is the
projection, not the public vocabulary.)

`ReferenceEntityCard` additionally threads `depth` for nesting: depth 0 is the
solo card; each level down renders one step tighter and drops its footer.

## Controls

Every card-level affordance goes through the `controls` API —
`ReferenceEntityControl[]`, defined in
`packages/component-lib/src/components/referenceEntity/referenceEntityControlTypes.ts`.
Both shells accept it and both render it through the shared `CardControlRail`.

The rules that matter:

- A control is a **button by default**, but typed variants (`stepper`, `badge`,
  `status`, `href`) make it render the matching primitive instead — so quantity
  steppers, status pills and nav links are all controls, and **no action renders
  in the footer**. The footer is meta only.
- `cardClick: true` makes the whole card clickable; `hidden: true` keeps a
  control out of the visible rail while still contributing its click.
- The card-level `status` prop is presentational sugar: `foldStatusControl`
  (`shared/foldStatusControl.ts`) folds it into a `status` control so the
  condition badge has exactly one implementation.
- **Only one preset factory survives** — `navigateControl`
  (`referenceEntity/referenceEntityControls.ts`). `addControl`, `deleteControl`
  and `selectControl` were measured to zero production call sites and deleted.
  Build controls directly.

## Customisation is by slot, never by schema

`ReferenceEntityCard` carries no schema-specific props. Customise with the
generic slot overrides and the `hide` guard config (both declared on
`ReferenceEntityCardProps` — read them there, they are deliberately not listed
here). Never add a schema-specific prop to the component: compute overrides in a
hook and spread them.

```tsx
// The canonical shape — a hook computes generic overrides, the consumer spreads
const patternConfig = useChassisPatternConfig(chassis, patternOverride, compact)
<ReferenceEntityCard data={chassis} {...patternConfig} />
```

`useChassisPatternConfig`
(`referenceEntity/pattern/useChassisPatternConfig.tsx`) is the worked example:
it turns a pattern override into `{ titleOverride, subtitleExtra, statsOverride,
primaryStatsOnly, abilitiesSection, afterExtraContent, hide }` and knows nothing
about the card's internals. The rest of the chassis-pattern cluster lives beside
it in `referenceEntity/pattern/`.

Prefer **data-shape checks** (`'coreTrees' in data`) over schema-name
comparisons, so the display layer stays schema-agnostic and new entity types
work without edits. `getClassSelections`
(`referenceEntity/classSelectionUtils.ts`) is the pattern.

## Choices and grants

Choice-bearing entities (e.g. the Custom Sniper Rifle) resolve through two
pieces:

- **`resolveChoiceView`** (`packages/salvageunion-reference/lib/resolveChoiceView.ts`)
  — a pure, deterministic resolver. Given an entity and `ChoiceSelections`
  (`Record<string, string[]>`), it returns `{ datavalues, traits, prompts }`:
  the base stat row with choice effects applied, the resolved traits, and
  prompts for unresolved required choices. `ReferenceEntityCard` calls it, so
  the header stat row updates live as choices toggle.
- **`ChoiceGroups`** (`referenceEntity/choiceCard/ChoiceGroups.tsx`) — the
  interactive renderer, plus `CatalogChoiceModal` for catalog-sourced picks and
  the pure `choiceSelectionHelpers.ts` (source-kind classification, option
  distillation, multi-select cap resolution, the `toggleSelection` reducer).

`ChoiceGroups` is **controlled when `selections` is passed, uncontrolled
otherwise** — the persistence-agnostic split of
[ADR-010](../adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md). srd uses the
ephemeral mode; ITUN passes `selections` / `onSelectionChange` down from
`ReferenceEntityCard` and wires them to its stores via
`apps/itun/src/components/shared/useEntityChoices.ts`. `readOnly` renders the
groups statically (snapshots).

**Grants** resolve via `resolveGrantedEntities` (exported from
`salvageunion-reference`) and render as nested cards carrying a `parentSeal`
stampseal rather than a separator row. When an _ability_ grants entities, the
card suppresses the ability's own body content and actions and renders the
granted cards instead — the ability's description still occupies the header
flavour slot.

## Route-agnostic linking

`referenceEntity/entityHrefContext.ts` keeps the shared library ignorant of app
routes. It exposes three providers, each with a matching hook:
`EntityHrefProvider` (builds a show-page href), `EntityDetailLinkProvider`
(whether "view details" links out in a new tab or opens the in-place modal), and
`EntityExternalLinkProvider` (a cross-app link node, e.g. ITUN's "View in SRD
→"). srd sets the first two; ITUN leaves detail-link off so its detail view
stays an in-app modal, driven by `useDetailModal`
(`referenceEntity/useDetailModal.tsx`), which returns `{ control, modal }` to
spread onto a card.

## Consumer patterns

- **srd** — `apps/srd/src/components/islands/ReferenceEntityIsland.tsx` and
  `SchemaViewerIsland.tsx` render entities inside a `GameDataGate`, wrapped in
  `EntityHrefProvider` / `EntityDetailLinkProvider`. Ephemeral choices, no
  persistence.
- **ITUN** — sheets (`apps/itun/src/components/sheet/`) and wizards
  (`.../pilot/`, `.../mech/`, `.../crawler/`) render the same
  `ReferenceEntityCard` and layer selection, steppers and status cycling on top
  **via `controls`** — never by replacing the card. `MechItemCard.tsx` is the
  reference implementation of the write layer (controls overlay + `footMeta`,
  no footer actions).
- **Picking** — `shared/EntitySearcher.tsx` is the shared add-modal body
  (search + facets + rail); selection state rides the card's own `selected` /
  `count` / `onCountChange` props.

## Cross-references

- [`.claude/rules/display-system.md`](../../.claude/rules/display-system.md) — the
  session-loaded rules for editing display components
- [`docs/design-system/ruleset.md`](../design-system/ruleset.md) — the governing
  design laws
- [ADR-026](../adrs/ADR-026-entity-card-design-rules.md) — entity-card design
  rules settled during the single-renderer reconciliation
- [ADR-010](../adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md) — choices
  ephemeral (srd) vs persisted (ITUN)
- [`.claude/rules/react-components.md`](../../.claude/rules/react-components.md) —
  component structure conventions
