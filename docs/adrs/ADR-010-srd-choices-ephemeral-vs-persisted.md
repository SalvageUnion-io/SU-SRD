# ADR-010: Choices in the Shared Display — Ephemeral in the SRD, Persisted in ITUN

## Status

Accepted

## Context

Some reference entities carry **choices**: a class ability that grants a "Custom
Sniper Rifle" with options to pick, or free-text fields like a pilot's Name /
Appearance / A.I. Personality. The same entity-display components in
`component-lib` render in two very different surfaces:

- **`srd` (the SRD reference)** — a static, read-only catalog
  ([ADR-012](ADR-012-srd-astro-static.md)) with no user data and nowhere to
  save a selection.
- **ITUN (the live builder)** — where a player's selections are part of their
  character and must persist ([ADR-002](ADR-002-indexeddb-idb-zod.md),
  [ADR-003](ADR-003-zustand-hydration.md)).

If the shared components owned persistence, they'd drag ITUN's storage concerns
into the static site; if they hard-coded read-only behavior, ITUN couldn't make
choices editable. Published snapshots add a third, read-only-but-has-a-value
case.

## Decision

The shared choice components are **agnostic to persistence**, and the consuming
surface decides the behavior:

- `ChoiceGroups` (selectable options) is **uncontrolled / ephemeral** in
  `srd` and **controlled / persistence-wired** in ITUN — both via the same
  `selections` / `onSelectionChange` pair, owned by the parent display.
- `FreeTextChoiceCard` takes a **`readOnly`** flag. The SRD reference and
  read-only snapshots pass `readOnly` so the card renders the prompt (or a saved
  value) as **static text instead of an editable input**; ITUN's live builder
  leaves it editable. This is the "keep editable inputs out of the SRD
  reference" rule.
- `StaticChoiceCard` is the display-only variant (e.g. NPC motivations, "choose
  one of the following" lists) that borrows the choice-card chrome with no
  toggle, status, or input.

## Consequences

- One set of components serves the static catalog, the live builder, and
  read-only snapshots; the SRD never ships editable inputs or persistence code.
- Adding a new choice-bearing entity works in all three surfaces for free,
  provided the component stays persistence-agnostic.
- The contract to preserve: **the shared library never persists.** Selection
  ownership and storage live in the consumer (ITUN), passed down through the
  `selections` / `onSelectionChange` props. Don't push storage into `component-lib`.
- See `docs/architecture/display-system.md` for the full choice-card layer and
  resolved-data-row rendering.
