---
paths:
  - apps/web/src/components/*/Card*
  - apps/web/src/components/referenceEntity/**
  - apps/web/src/components/entity/**
---

# Display System Rules

Architecture: `docs/ARCHITECTURE.md#display`; laws: `docs/design-system/ruleset.md`.
State rules here, never prop tables or rosters: read props off the component.

- **Two card shells, never merged:** `ReferenceEntityCard`
  (`referenceEntity/card/`) is the Card and Page for game data; `Card`
  (`containers/`) is the generic four-band container. Never add entity-card
  features to `Card` or route the entity card through it; share the vocabulary
  (`displayMode`, the controls contract, `CardControlRail`), not the DOM.
- **Size is two axes** (`containers/displayMode.ts`): `size` (`full | compact |
  mini`, how big) × `extent` (`full | head | catalog`, how much).
- **Form by [EDL](../../docs/design-system/entity-display-language.md) E1–E5,
  E15:** Row `<Entity form="row">`, Token `form="token"`, `<Mention>`, whole
  entity `ReferenceEntityCard` (`presentation="page"` for a Page); never
  hand-assembled markup. A titled container is `TitledBox`; untitled, `Box`/`Card`.
- **Customise by slot, never by schema:** the caller computes overrides and
  passes generic slot props (`afterExtraContent`, …) and `hide`; prefer
  data-shape checks (`'coreTrees' in data`) over schema names.
- **Controls** go through `ReferenceEntityCard`'s `controls` (`navigateControl`
  is the one preset); `cardClick: true` makes the card clickable, `hidden: true`
  keeps it off the rail, `status` draws in `StatusRail`.
- **Every `label | value` is a `Stat`** (ruleset §3.7, the most-broken rule):
  never a hand-built `<span>`. A surface that seems to need its own is missing a
  `Stat` rung, usually `size="full"`.
