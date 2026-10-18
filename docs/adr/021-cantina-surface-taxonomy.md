# ADR-021: The Cantina Surface Taxonomy — Enforcement Modes & Rule Placement

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 21, which summarises it.

## Status

**Accepted — governing ADR.** This is the top-level decision for how the Cantina treats
game rules. **Where it conflicts with any prior ADR, this ADR wins** (scope and
the specific overrides are listed under [Supersession](#supersession--precedence)).

Built: Guided Creation on the Wizard's create path, Play and ADR-022's
Change Log. **Amended by [ADR-051](051-play-mode.md):** Play replaced the
Dashboard and the Mediator Dashboard as Guided Play's and Adjudicate's surface. The living, authoritative placement table is
[rules and the Cantina surfaces](../ARCHITECTURE.md#surfaces) — keep
placements in sync **there**, not by re-editing the summary below. This ADR
records _why_ the taxonomy exists; the arch doc records _what goes where_.

## Context

The Cantina grew a set of distinct surfaces — a roster, build wizards, the live sheet, an
encounter tray, snapshot publish/view. Our rules docs described "the app" as one
actor that enforces "economic" rules and defers "procedural" ones. The code never
matched that flatness: the _same_ constraint is a gentle advisory while you build
a character (`PilotWizard.tsx`, "never blocking") and a hard block while you
play one (`SheetMech.tsx`, Push disabled at the Heat Capacity). Enforcement
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

**The Cantina surfaces are classified by enforcement _mode_, and a rule's enforcement is
a function of the mode, not of the rule alone.** The border between modes is the
**lifecycle transaction** — a state change the rules gate behind a cost or
procedure.

**Modes** (a surface _hosts_ a mode; the mode names are ours, not Salvage Union's):

| Mode                | Surface(s)                                   | Stance                                                               |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| **Guided Creation** | Wizard                                       | Enforce creation rules; a how-to guide for making a legal entity.    |
| **Free Edit**       | Live Sheet                                   | No lifecycle enforcement. Edit end-state directly; override caps.    |
| **Guided Play**     | **Play** (Pilot + Mech + Crawler, live)      | Enforce play; interactive rules-layers that teach as they enforce.   |
| **Frozen**          | Public sheet (`/p/`), a crewmate's sheet     | Read-only, live (snapshots retired by ADR-036).                      |
| **Adjudicate**      | Play's Mediator screen (`/play/game/$gameId`) | Mediator tooling; surfaces rules, enforces nothing on player sheets. |

**Rule placement** (summary in
[rules and the Cantina surfaces](../ARCHITECTURE.md#surfaces)):

- **Lifecycle transactions** (use a system → EP/Heat/uses, Push, Scrap/TP costs,
  Downtime, craft, salvage, repair, upgrade, advancement) — **enforced +
  interactive in the guided modes; bypassed in Free Edit** (edit the end-state, no
  cost). Using a system is a **Play** act, never a Live-Sheet one; the Live
  Sheet may still hand-edit a remaining-uses _count_ (free state).
- **Structural coherence** (refs resolve, type/containment) — **hard in every
  mode**, Free Edit included. House-ruled objects allowed; incoherent ones not.
  (This covers house-ruled arrangements of _existing_ content; authoring net-new
  homebrew content is out of scope — see Consequences.)
- **Quantitative caps** (slot counts, derived maxima) — derived in guided modes,
  **overridable in Free Edit** with a callout and a retained baseline (ADR-022).
- **Free state** (HP/SP/Heat/EP/AP/Scrap, conditions, uses) — **freely editable in
  Free Edit**; moved only via enforced actions in Guided Play. (Applying
  Mediator-declared damage splits: the SP→HP overflow rule runs as a Play
  transaction; raw-setting SP/HP is a Free-Edit edit.)
- **Procedural adjudication** — surfaced, never enforced (unchanged); the
  Adjudicate mode tools it GM-side, player surfaces only apply the outcomes.

**Classify both axes before building.** Any rules feature is placed on a mode (→
enforcement stance) _and_ a rule class (→ what the stance does); the matrix cell is
the behavior.

**Play is a separate, multi-entity surface — built.** It composes a
player's Pilot + Mech + Crawler into one live play surface (distinct from the
single-entity Live Sheet), at `/play/$pilotId` and the Mediator's
`/play/game/$gameId` (`src/components/play/`). Detail in
[play.md](../architecture/play.md).

## Supersession / precedence

This ADR is the top of the stack for **rules enforcement and surface behavior**:
The Cantina has no app-wide enforcement stance; enforcement is per-mode.

Prior ADRs on **orthogonal concerns remain in force on their own subjects**:
[ADR-005](../ARCHITECTURE.md#decisions)/[ADR-006](../ARCHITECTURE.md#decisions)
(data & rules math), [ADR-011](../ARCHITECTURE.md#decisions),
[ADR-013](../ARCHITECTURE.md#decisions), [ADR-014](../ARCHITECTURE.md#decisions)
and [ADR-031](../ARCHITECTURE.md#decisions) (infra). This ADR only takes
precedence where a prior decision speaks to _how hard a rule is enforced on
which surface_:

- [ADR-007](007-automation-boundary.md) (automation boundary) is **retained and
  scoped under** this ADR: confirm-before-destructive governs **Guided Play**; in
  **Free Edit** the player edits conditions by hand, which ADR-007 already permits
  (it forbids _automatic_ mutation, not deliberate editing).
- [ADR-010](../ARCHITECTURE.md#decisions) (persistence-agnostic
  choices) is consistent: Frozen is its read-only end.

## Consequences

- The Live Sheet is intentionally the least-enforced surface. Wanting a Live-Sheet
  _hard block_ (beyond structural coherence) is a proposal to change this ADR, not
  a bug.
- Lifecycle rules primitives (`salvage`, `downtime`, `scrapMech`, `takeDamage`)
  land as Dashboard layers, enforced + interactive.
- The Dashboard's phone form ([ADR-045](045-dashboard-phone-form.md)) is Guided Play; no
  reclassification.
- The provenance log and stat-override model that this surface split requires are
  decided separately in [ADR-022](../ARCHITECTURE.md#decisions).
- The **Dashboard** (Guided Play) surface has its own design in
  [ADR-038](038-dashboard-game-surface.md), with the full design in
  [dashboard.md](../architecture/dashboard.md). It instantiates this taxonomy; it
  does not compete with it (ADR-038 §6 is the Guided-Play surface and obeys the
  ADR-007 boundary this ADR scopes; §2 is its play state).
- **Net-new homebrew content authoring** is out of scope — a path to author
  systems/abilities absent from the dataset, which Free Edit cannot express (an
  unresolved ref is incoherent). A future authoring surface feeding the dataset,
  not a Free-Edit affordance.
