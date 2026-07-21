---
paths:
  - packages/component-lib/src/components/shared/DisplayCard*
  - packages/component-lib/src/components/referenceEntity/**
---

# Display System Rules

See `docs/architecture/display-system.md` for the architecture, and
`docs/design-system/ruleset.md` for the governing design laws.

> **Why this file is short.** Its previous version enumerated components, props
> and control presets — and every one of those enumerations went stale as the
> design-system pass landed. It still described `ReferenceEntityDisplay`
> (deleted), `StatsBar` (deleted), `BlockContentRendererView` /
> `StaticChoiceCard` (deleted), three control presets that no longer exist, and
> `DisplayCard`'s `compact` / `listing` booleans (replaced). An agent following
> it would have reached for half a dozen things that aren't there.
>
> A rules file is loaded into every session that touches this area, so a stale
> one does active harm. This version states the **rules**, which change slowly,
> and points at the **source** for the roster, which changes fast. Do not
> re-add prop tables or component lists here.

## The two card shells — deliberately separate

There are two, and the separation is a decision, not an accident:

- **`ReferenceEntityCard`** (`referenceEntity/card/`) — THE renderer for game
  data. Every SRD entity goes through it. It implements the printed-card spec:
  the frame lives on the inner clipping element so the seam stamp can escape the
  clip, plus a book-style text sub-header and an identity footer.
- **`DisplayCard`** (`shared/`) — the generic four-band container (header /
  sub-header / body / footer) that the poster, sheet and modal surfaces compose.
  `ModalShell` is built on it.

**They are NOT being merged.** A full assessment found the composition impossible
without visual deltas across every SRD page — the frame-element difference alone
shifts every absolute overlay by 3px, ghosted sub-header tones are underivable
inside DisplayCard, and the two resolve `cardClick` fallback in opposite
directions (first-wins vs last-wins). The entity card's header is also
semantically richer: it distinguishes a stat cluster from flavour prose to decide
which side yields, and DisplayCard's header slot is opaque to its content, so
that rule cannot live there.

So: **do not add entity-card features to DisplayCard**, and do not route the
entity card through it. Share the VOCABULARY (`displayMode`, the controls
contract, `CardFootMeta`, `foldStatusControl`) — not the DOM.

## Sizing vocabulary

Card size is TWO orthogonal axes, defined in `shared/displayMode.ts`:

- `size`: `large | medium | small` — how big it renders.
- `extent`: `full | head | catalog` — how much of it renders.

They are independent: a `small` card can still show its whole content. The old
`compact` / `listing` booleans are gone; don't reintroduce a boolean that
duplicates an axis.

## When to use which

- Rendering a reference entity (chassis, ability, equipment, action, NPC…)?
  **`ReferenceEntityCard`.** Always. Never hand-assemble entity markup.
- Rendering a non-entity container (a modal body, a sheet section, a poster
  panel)? **`DisplayCard`.**

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

Card-level actions go through the `controls` API. Only ONE preset factory still
exists — `navigateControl`; `addControl`, `deleteControl` and `selectControl`
were measured to zero production call sites and deleted. Build controls directly.

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
