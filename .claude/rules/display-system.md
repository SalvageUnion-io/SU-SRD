---
paths:
  - apps/web/src/components/referenceEntity/**
  - apps/web/src/components/entity/**
  - apps/web/src/{build,play,reference}/**/*.tsx
  - apps/web/src/styles/partials/entity-*.css
---

# Display System Rules

Architecture: `docs/ARCHITECTURE.md#display`; laws: the ruleset and the
[EDL](../../docs/design-system/entity-display-language.md), whose words win.

- **Forms (EDL E1–E5, E15):** Mention `<Mention>`; Mini `<Entity
  size="mini">`; Compact `<Entity size="compact">` (header-only unless a lead,
  stamp or linked units give it a body), index `layout="index"`; Compact or
  Full contentful `ReferenceEntityCard` (`size`), a Page with
  `presentation="page"`. Never hand-assembled markup.
- **Extent:** the EDL's header-only / contentful is the card's `extent`
  (`containers/displayMode.ts`): `head` is header-only (always a Mini),
  `full` contentful, `catalog` the class picker's art and text; Mini `body`
  and Compact `bodyless` say the same.
- **One card shell:** every other frame is `Box` (`containers/`): titled,
  `TitledBox`; a note, `Callout`. Never route the entity card through `Box`.
- **Customise by slot, never by schema:** generic slot props and `hide`;
  data-shape checks (`'coreTrees' in data`) over schema names.
- **Controls** go through the card's `controls` (`navigateControl` is the one
  preset), its head's chip group (C8); `cardClick: true` makes the card
  clickable, `hidden: true` keeps it out, `status` draws as `StatusBadge`.
- **Every `label | value` is a `Stat`** (ruleset §3.7), never a hand-built
  `<span>`.
- **Sheets:** the sidebar holds what is carried; panels `TitledBox`, values
  `Field`.
