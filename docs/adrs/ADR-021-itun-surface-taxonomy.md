# ADR-021: ITUN Surface Taxonomy — Enforcement Modes & Rule Placement

## Status

**Accepted — governing ADR.** This is the top-level decision for how ITUN treats
game rules. **Where it conflicts with any prior ADR, this ADR wins** (scope and
the specific overrides are listed under [Supersession](#supersession--precedence)).

"Accepted" records the **decision**; the code has since largely caught up (the
Wizard enforces Guided Creation hard on the create path, the Dashboard ships at
`/dashboard/$id`, and ADR-022's Change Log is live). The living, authoritative
placement table is the matrix in
[`rules-engine-boundary.md`](../architecture/rules-engine-boundary.md) — keep
placements in sync **there**, not by re-editing the summary below. This ADR
records _why_ the taxonomy exists; the arch doc records _what goes where_.

## Context

ITUN grew a set of distinct surfaces — a roster, build wizards, the live sheet, an
encounter tray, snapshot publish/view. Our rules docs described "the app" as one
actor that enforces "economic" rules and defers "procedural" ones. The code never
matched that flatness: the _same_ constraint is a gentle advisory while you build
a character (`PilotWizard.tsx:96–97`, "never blocking") and a hard block while you
play one (`SheetMech.tsx:71–76`, Push disabled at the Heat Capacity). Enforcement
is not a property of the rule; it is a property of **what the player is doing**.

The design intent, stated by the owner, is sharper than "economic vs procedural":

- The **Live Sheet** is a _free_ surface — the gooey sticky middle for patching
  reality when a human moment at the table needs it. It must **not** enforce
  lifecycle events. Add a system without spending Scrap; add an ability without
  spending TP; set health, Scrap, and conditions freely; override caps and maxima.
  It edits **state**, not **events**.
- The **Wizard** and the **Dashboard** (the live Pilot + Mech + Crawler play
  surface) are the _guided_ surfaces with hardcore rules enforcement — guardrails
  and automatic layers that act _for_ the player and **teach the rules as they
  enforce them** (each Dashboard layer, Downtime being the template, exposes its
  rules inline). Every lifecycle transaction — use a system (take its Action,
  spending EP/Heat), Push, craft, salvage, repair, upgrade, Downtime, spend earned
  TP — belongs to these guided surfaces.

So the Live Sheet is the **least-enforced** surface in the app, and the guided
surfaces are the enforced bookends. A flat "the app enforces X" framing gets this
exactly backwards for the Live Sheet.

## Decision

**ITUN surfaces are classified by enforcement _mode_, and a rule's enforcement is
a function of the mode, not of the rule alone.** The border between modes is the
**lifecycle transaction** — a state change the rules gate behind a cost or
procedure.

**Modes** (a surface _hosts_ a mode; the mode names are ours, not Salvage Union's):

| Mode                | Surface(s)                                   | Stance                                                               |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| **Guided Creation** | Wizard                                       | Enforce creation rules; a how-to guide for making a legal entity.    |
| **Free Edit**       | Live Sheet                                   | No lifecycle enforcement. Edit end-state directly; override caps.    |
| **Guided Play**     | **Dashboard** (Pilot + Mech + Crawler, live) | Enforce play; interactive rules-layers that teach as they enforce.   |
| **Frozen**          | Share / View                                 | Read-only snapshot.                                                  |
| **Adjudicate**      | Encounter (→ future Mediator layer)          | Mediator tooling; surfaces rules, enforces nothing on player sheets. |

**Rule placement** (full matrix in
[`rules-engine-boundary.md`](../architecture/rules-engine-boundary.md)):

- **Lifecycle transactions** (use a system → EP/Heat/uses, Push, Scrap/TP costs,
  Downtime, craft, salvage, repair, upgrade, advancement) — **enforced +
  interactive in the guided modes; bypassed in Free Edit** (edit the end-state, no
  cost). Using a system is a **Dashboard** act, never a Live-Sheet one; the Live
  Sheet may still hand-edit a remaining-uses _count_ (free state).
- **Structural coherence** (refs resolve, type/containment) — **hard in every
  mode**, Free Edit included. House-ruled objects allowed; incoherent ones not.
  (This covers house-ruled arrangements of _existing_ content; authoring net-new
  homebrew content is out of scope — see Consequences.)
- **Quantitative caps** (slot counts, derived maxima) — derived in guided modes,
  **overridable in Free Edit** with a callout and a retained baseline (ADR-022).
- **Free state** (HP/SP/Heat/EP/AP/Scrap, conditions, uses) — **freely editable in
  Free Edit**; moved only via enforced actions in Guided Play. (Applying
  Mediator-declared damage splits: the SP→HP overflow rule runs as a Dashboard
  transaction; raw-setting SP/HP is a Free-Edit edit.)
- **Procedural adjudication** — surfaced, never enforced (unchanged); the
  Adjudicate mode tools it GM-side, player surfaces only apply the outcomes.

**Classify both axes before building.** Any rules feature is placed on a mode (→
enforcement stance) _and_ a rule class (→ what the stance does); the matrix cell is
the behavior.

**The Dashboard is a separate, multi-entity surface — built.** It composes a
player's Pilot + Mech + Crawler into one live play surface (distinct from the
single-entity Live Sheet), shipped at `/dashboard/$id`
(`src/components/dashboard/`). The code rename from the working title "Play
Cockpit" has landed, and the Live Sheet's leftover play control (`QuickRollFab`)
is gone. Detail in the architecture doc.

## Supersession / precedence

This ADR is the top of the stack for **rules enforcement and surface behavior**.
Concretely it overrides:

- The enforcement framing of the former _Rules Engine Boundary_ doc — rewritten as
  [`rules-engine-boundary.md`](../architecture/rules-engine-boundary.md) around
  this model.
- Any assumption that ITUN has a single, app-wide enforcement stance. Enforcement
  is per-mode.
- The **Wizard's** former soft-warn-never-block behavior: the create path is now
  enforced Guided Creation (soft → hard; edit mode keeps the soft regime).
- The **Live Sheet** hosting enforced play controls: Push, Heat Check, and using a
  system ([ADR-008](ADR-008-sequential-mutations.md)'s `activateItem`) relocate to
  the Dashboard; the Live Sheet becomes pure Free Edit plus overrides.

Prior ADRs on **orthogonal concerns remain in force on their own subjects** —
[ADR-001](ADR-001-local-first-no-backend.md) (the local-first foundation this rests
on), [ADR-002](ADR-002-indexeddb-idb-zod.md)/[ADR-003](ADR-003-zustand-hydration.md)
(persistence), [ADR-004](ADR-004-snapshot-netlify-functions.md) (snapshots),
[ADR-005](ADR-005-reference-data-orm.md)/[ADR-006](ADR-006-pure-rules-logic.md)
(data & rules math), [ADR-011](ADR-011-component-lib-source-no-build.md)–[ADR-014](ADR-014-json-api-public-interface-npm-retired.md)
(infra). This ADR only takes precedence where a prior decision speaks to _how hard
a rule is enforced on which surface_:

- [ADR-007](ADR-007-automation-boundary.md) (automation boundary) is **retained and
  scoped under** this ADR: confirm-before-destructive governs **Guided Play**; in
  **Free Edit** the player edits conditions by hand, which ADR-007 already permits
  (it forbids _automatic_ mutation, not deliberate editing).
- [ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md) (persistence-agnostic
  choices) is consistent: Frozen is its read-only end.

## Consequences

- The Live Sheet is intentionally the least-enforced surface. Wanting a Live-Sheet
  _hard block_ (beyond structural coherence) is a proposal to change this ADR, not
  a bug.
- Unwired rules primitives (`salvage`, `crafting`, `downtime`, `scrapMech`,
  `takeDamage`) have a defined destination: Dashboard layers, enforced + interactive.
- When the Dashboard splits out from the Sheet it inherits Guided Play with no
  reclassification — the taxonomy already accounts for it.
- The provenance log and stat-override model that this surface split requires are
  decided separately in [ADR-022](ADR-022-provenance-log-and-overrides.md).
- The **Dashboard** (Guided Play) surface has its own design and sub-decisions:
  [ADR-015](ADR-015-dashboard-distinct-play-surface.md) (it is a distinct surface)
  through [ADR-020](ADR-020-dashboard-fixed-canvas-scale-to-fit.md), with the full
  design in [dashboard.md](../architecture/dashboard.md). Those instantiate this
  taxonomy; they do not compete with it (ADR-015 is the Guided-Play instance;
  ADR-019's play-state obeys the ADR-007 boundary this ADR scopes).
- **Long-tail, out of scope** (all gated on revisiting
  [ADR-001](ADR-001-local-first-no-backend.md), and none alter this taxonomy):
  - **Shared, live Dashboard** — several players on one Dashboard at once,
    synchronized with a Mediator live. The single-player Dashboard is the first step
    toward it.
  - **Workspaces → "Game spaces"** — shared spaces with entities owned by you vs.
    by others; ownership scopes _who_ may edit, not _what_ each mode enforces.
  - **A dedicated Mediator layer** — the Adjudicate mode moves off Encounter into
    a GM-facing surface (the Guided Play → Dashboard move applied to the GM side).
    The mode already exists here, so the move needs no reclassification.
  - **Net-new homebrew content authoring** — a path to author systems/abilities
    absent from the dataset, which Free Edit cannot express (an unresolved ref is
    incoherent). A future authoring surface feeding the dataset, not a Free-Edit
    affordance.
