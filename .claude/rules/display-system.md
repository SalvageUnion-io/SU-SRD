---
paths:
  - packages/component-lib/src/components/*/Card*
  - packages/component-lib/src/components/referenceEntity/**
  - packages/component-lib/src/entity/**
---

# Display System Rules

See `docs/ARCHITECTURE.md#display` for the architecture, and
`docs/design-system/ruleset.md` for the governing design laws.

Do not re-add prop tables or component lists here: state the rule, point at the
source for the roster.

## The two card shells — deliberately separate

There are two, and the separation is a decision, not an accident:

- **`ReferenceEntityCard`** (`referenceEntity/card/`) — the Card and Page for
  game data. The printed-card spec: the frame on the inner
  clipping element so the control rail escapes the clip, the facets row (E17),
  an identity footer.
- **`Card`** (`containers/`) — the generic four-band container (header /
  sub-header / body / footer) that the poster, sheet and modal surfaces compose.
  `ModalShell` is built on it.

**They are NOT being merged**.

So: **do not add entity-card features to Card**, and do not route the
entity card through it. Share the VOCABULARY (`displayMode`, the controls
contract, `CardControlRail`) — not the DOM.

## Sizing vocabulary

Card size is TWO orthogonal axes, defined in `containers/displayMode.ts`:

- `size`: `large | medium | small` — how big it renders.
- `extent`: `full | head | catalog` — how much of it renders.

They are independent: a `small` card can still show its whole content.

## When to use which

- Choose the form by
  [EDL](../../docs/design-system/entity-display-language.md) E1–E5 and E15; in
  code: Row `<Entity form="row">`, Token `form="token"`, Mention `<Mention>`,
  whole entity `ReferenceEntityCard` (`presentation="page"` for a Page), never
  hand-assembled markup.
- A non-entity container (modal body, sheet section, poster panel) is `Card`.

## Customisation is by slot, never by schema

Customise with generic slot props and the `hide` config. Never add a
schema-specific prop to the component — compute overrides in a hook and spread
them. Read the current props off the component; they are deliberately not
listed here.

```tsx
// Good: a hook computes generic overrides, the consumer spreads them
const config = useClassTreeConfig(data)
<ReferenceEntityCard data={data} {...config} />
```

Prefer data-shape checks (`'coreTrees' in data`) over schema-name checks, so the
display layer stays schema-agnostic.

## Controls

Card-level actions go through `ReferenceEntityCard`'s `controls` API (the
generic `Card` takes no controls, `cardClick` or `status`). The one preset
factory is `navigateControl`; build any other control directly.

A control with `cardClick: true` makes the whole card clickable; `hidden: true`
keeps it out of the button rail. `status` is presentational sugar that folds into
a status control in `CardTopRail`, so the condition badge has exactly one
implementation.

## Stats

Any `label | value` — a stat, cap, vital, tech level, range, cost — renders
through **`Stat`**, in the anatomy its context calls for. Never hand-assemble one
in a `<span>`. This is ruleset §3.7, and it is the most frequently broken rule in
this codebase. When a surface seems to need its own, the cause is almost always
that `Stat` is missing a rung, not that the surface is special — a readout that
IS the thing being read, rather than an annotation on it, is `Stat`'s `full`
rung (`size="full"`, the canonical ladder's top step).
