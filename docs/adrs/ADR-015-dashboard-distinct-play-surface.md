# ADR-015: The Dashboard is a Distinct Actual-Play Surface, Separate from Live Sheets

## Status

Accepted and **built** (`apps/itun/src/components/dashboard/`, routed at
`/dashboard/$id`; architecture in [dashboard.md](../architecture/dashboard.md)).
This is the play-surface instance of the governing surface taxonomy in
[ADR-021](ADR-021-itun-surface-taxonomy.md) — the **Guided Play** surface.

ADRs 016–020 recorded this surface's sub-decisions; they are merged below as
**Dashboard decisions**, and those five files are stubs pointing here.

**Amended by [ADR-038](ADR-038-dashboard-game-surface-shared-play-state.md)** (accepted, not yet built). Decision 1, the rotary
Dial, is replaced by Major and Minor slots and a tabbed display. Decision 4's
ephemeral play state is reversed: play state becomes a per-pilot seat saved on
the Game, and the Dashboard becomes Game-only, needing a Mediator. Decision 4's
other half (mount never on a pilot or mech record) and decisions 2, 3 and 5
stand. Decisions 1 and 4 still describe the code until the plan in
[dashboard-redesign.md](../architecture/dashboard-redesign.md) lands.

## Context

ITUN's live sheet fuses two moments with opposite interaction grammars: editing a
character (inline edit + scroll) and running it at the table (one-screen, no-scroll
instrument buttons). Forcing both into one surface produced clutter. The
[surface taxonomy](ADR-021-itun-surface-taxonomy.md) names these as two modes —
Free Edit and Guided Play — and this ADR gives Guided Play its own surface.

## Decision

The **Dashboard** is a **new surface** at `/dashboard/$id`, not a mode of the live
sheet. It composes a player's **Pilot + Mech + Crawler** into one live play
surface. Sheets edit a character; the Dashboard runs it at the table. Both read and
mutate the **same** persisted entities through the **same** store and rules engine
([ADR-006](ADR-006-pure-rules-logic.md), [ADR-003](ADR-003-zustand-hydration.md)) —
the Dashboard is a second lens, not a second source of truth.

## Rationale

The two moments have opposite interaction grammars (inline edit + scroll vs.
one-screen no-scroll instrument buttons). Sharing state (not chrome) keeps them
consistent via the existing multi-tab broadcast. As the Guided Play surface it is
where enforced lifecycle transactions live (see
[ADR-021](ADR-021-itun-surface-taxonomy.md) and
[rules-engine-boundary.md](../architecture/rules-engine-boundary.md)).

## Alternatives rejected

- **A "play mode" toggle on the sheet** — rejected: the layouts are irreconcilable
  in one component.
- **A separate app** — rejected: duplicates the data layer and breaks
  single-store consistency.

## Consequences

- The single-player Dashboard is the first step toward the long-tail shared, live
  Dashboard (multiple players + Mediator sync) noted in ADR-021.

## Dashboard decisions

### 1. The rotary Dial and the instrument / reference split (was ADR-016)

Entity/view selection is a **rotary Dial** — a 260px right-edge sidebar whose
Active Dial Item overhangs to ~1/3 of the row. The display holds all
interactivity; the dial holds readable stats only. The Dashboard is thereby split
into **bespoke instruments** (rail, bays, dial) and **the reference document**
(the display). Stepping is detented, not free-scroll. Rejected: left tabs, right
drawers, a centre tab bar and bottom selector blocks (each reflowed the frame or
buried entities).

### 2. Reuse the faithful SRD display; instruments are bespoke (was ADR-017)

The display renders the same `component-lib` entity display the rest of the app
shows (`ReferenceEntityCard`, `RollTable`), with entity-level interactivity as
typed `controls`. Only the instruments (gauges, bays, dial, buttons) are new
Dashboard components. One display system means one place to fix reference
rendering. Rejected: a Dashboard-specific action-chip renderer that forks the
display.

### 3. Flat and inset; only the display reads forward (was ADR-018)

Instrument surfaces read **recessed** (mild inset shadow, soft entity-tinted
borders); buttons are flat recessed keys; **the main display is the single
element that reads forward** (solid hard 2.5px border, no inset). Hue encodes
ontology, never identity; state is a treatment overlay (hatch / strike /
redline), never a second hue. Rejected: skeuomorphic 3D dials, a CRT bend, and
per-source colour chips that let hue mean identity.

### 4. Play-state is ephemeral, under the ADR-007 boundary (was ADR-019)

The mount state machine (pilot / mech / downtime, range band, turn flags) and
dial focus live in the non-persisted `playStateStore` — **never** on the
pilot/mech schema and **never** in a snapshot. There is no "pilot in mech" field
(the link is a soft link), so mount state is a play-session concern. Dial
configuration (show/hide, order) is a device preference in `localStorage`,
scoped per container (`cockpitPrefsStore`). Every control obeys
[ADR-007](ADR-007-automation-boundary.md): auto-apply non-destructive bookkeeping
(EP / Heat / uses / SP), player-confirm destructive change (destroy an item,
Eject, meltdown).

### 5. A fixed 1280×800 canvas, scaled to fit (was ADR-020)

The Dashboard is a fixed 1280×800 design canvas scaled with one
`transform: scale(min(vw/1280, vh/800))`, letterboxed. "Always one screen, never
scrolls" is a **landscape-desktop contract**; below the width threshold the canvas
is abandoned rather than shrunk illegibly, for a stacked scrolling phone layout
built from the same instruments (not built yet: today it is a
rotate-to-landscape notice). Rejected: a fluid responsive grid
(cannot guarantee no-scroll) and scaling with no floor (fights browser zoom,
illegible on phones).
