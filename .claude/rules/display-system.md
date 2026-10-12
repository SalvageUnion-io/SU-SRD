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

**They are NOT being merged** (and their `cardClick` fallback resolves
first-wins vs last-wins); the assessment is `docs/ARCHITECTURE.md#display`.

So: **do not add entity-card features to Card**, and do not route the
entity card through it. Share the VOCABULARY (`displayMode`, the controls
contract, `CardFootMeta`, `foldStatusControl`) — not the DOM.

## Sizing vocabulary

Card size is TWO orthogonal axes, defined in `containers/displayMode.ts`:

- `size`: `large | medium | small` — how big it renders.
- `extent`: `full | head | catalog` — how much of it renders.

They are independent: a `small` card can still show its whole content. The old
`compact` / `listing` booleans are gone; don't reintroduce a boolean that
duplicates an axis.

## When to use which

Choose the entity's FORM by the job and the room
([`entity-display-language.md`](../../docs/design-system/entity-display-language.md), E1–E17):

- An entity in a list (listing, search, picker, slot, deck)? **`<Entity form="row">`.**
  Three or more on a line, or a slot under 12rem? **`form="token"`.**
- An entity named in prose? **`<Mention>`** — it links and Peeks; never a chip or raw `[[` markup.
- The whole entity, in place or as its page? **`ReferenceEntityCard`** (`presentation="page"` for a page).
- Never hand-assemble entity markup.
- Rendering a non-entity container (a modal body, a sheet section, a poster
  panel)? **`Card`.**

## Customisation is by slot, never by schema

Customise with generic slot props and the `hide` config. Never add a
schema-specific prop to the component — compute overrides in a hook and spread
them. Read the current props off the component; they are deliberately not
listed here.

```tsx
// Good: a hook computes generic overrides, the consumer spreads them
const config = useChassisPatternConfig(data, pattern)
<ReferenceEntityCard data={data} {...config} />
```

Prefer data-shape checks (`'coreTrees' in data`) over schema-name checks, so the
display layer stays schema-agnostic.

## Controls

Card-level actions go through the `controls` API. The one preset factory is
`navigateControl`; build any other control directly.

A control with `cardClick: true` makes the whole card clickable; `hidden: true`
keeps it out of the button rail. `status` is presentational sugar that folds into
a status control via `foldStatusControl`, so the condition badge has exactly one
implementation.

## Stats

Any `label | value` — a stat, cap, vital, tech level, range, cost — renders
through **`Stat`**, in the anatomy its context calls for. Never hand-assemble one
in a `<span>`. This is ruleset §3.7, and it is the most frequently broken rule in
this codebase. When a surface seems to need its own, the cause is almost always
that `Stat` is missing a rung, not that the surface is special — a readout that
IS the thing being read, rather than an annotation on it, is `Stat`'s `full`
rung (`size="full"`, the canonical ladder's top step).
