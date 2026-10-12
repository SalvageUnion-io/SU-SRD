---
status: proposed
---

# ADR-045: The Dashboard Has a Phone Form

## Status

**Proposed** (2026-10-09; design lead, owner to confirm). Amends
[ADR-038](038-dashboard-game-surface.md) §3, §4 and §9. It adds no mode to [ADR-021](021-itun-surface-taxonomy.md).
The phone form is Guided Play, with the same enforcement, seat and Change Log
as the canvas, so the taxonomy and the
[rules and ITUN surfaces](../ARCHITECTURE.md#rules-and-itun-surfaces) matrix do not change.
Built in issue #1256 (boards D4 and D5).

## Context

ADR-038 §9 made the Dashboard a fixed 1280×800 canvas. A host whose width
would draw the canvas below 0.62 scale got a rotate-to-landscape notice
instead. In practice:

- Portrait phones got no Dashboard at all.
- Landscape phones passed the width test and got the canvas at about 0.49
  scale. Its 9px labels shrank to about 4.4px and its 44px targets to about
  22px.

Players run their sheets on phones at the table. The brand refresh drew a
phone form (origin boards D4 and D5, issue #1256).

## Decision

1. **Two forms, one surface.**
   - `/dashboard/$pilotId` renders the canvas when it fits at a scale of 0.62
     or more on **both** axes, and the phone form otherwise. The rotate notice
     is retired.
   - Both forms read the same seat, store, rules and view models
     (`MajorModel`, `MinorModel`, `DeckListModel`, `ResolveModel`). A form is
     a renderer, never a second home for play state.
   - Changing form (rotating or resizing) keeps the seat and the device state.
2. **Same mode, same enforcement.**
   - Every phone control calls the handler its canvas twin calls, and the
     same rules gate it.
   - The phone form adds no transaction the canvas lacks.
   - It drops nothing a turn needs.
3. **Unit tabs replace the slot row.**
   - The Major and Minor slots become three unit tabs in a fixed order:
     Pilot · Mech · Crawler.
   - The selected tab is the Major when the Dashboard opens, and it follows
     the Major when the mount changes. Otherwise only the player moves it.
   - A tab shows that unit's full controls, which is what ⤢ opens on the
     canvas.
   - A tab whose `MinorModel` reports a problem carries the Minor's warning.
   - The deck sits on the Major's tab only.
4. **Resolving is a screen.**
   - Opening an action replaces the tab body with the resolve screen (board
     D5).
   - The screen shows the action card and the rolled row. The full table is
     one tap away.
   - The Major's spend vitals are pinned in its header, and the next step's
     buttons are pinned at the bottom.
5. **The display's other tabs go behind the bar's menu.**
   - The bar's ≡ opens these as full-screen panels: Reference, Tables, SRD,
     Log and Crew, the Game link with the latest alert and proposal count,
     the saved state, and the Mediator's Downtime control.
   - The bar's search opens the SRD panel.
6. **The Dashboard has no masthead.** At every width, `/dashboard` renders
   its own bar in place of the app masthead. The offline banner stays.

## Alternatives rejected

- **Keep the notice, or lower the scale floor.** Both stay illegible, and
  scaling fights browser zoom.
- **A fluid canvas that reflows its grid.** ADR-038 rejected this because
  no-scroll cannot hold. The phone form scrolls, and says so.
- **Two Minors stacked above the Major** (the #1063 sketch). At 812px the
  Major's controls would start below the fold, and the deck would sit under
  all three units.
- **A separate phone route.** It gives one seat two URLs, and every link
  would have to pick a form.
- **Unit tabs at the bottom of the screen.** They would compete with the
  resolve screen's bottom action bar and the phone's home indicator. The
  boards put the units at the top.

## Consequences

- No-scroll remains a landscape-desktop contract (ADR-038 §9). The phone form
  scrolls inside a unit tab.
- Large browser zoom now reaches the phone form, which closes
  [dashboard.md](../architecture/dashboard.md) §10.3.
- A desktop window under about 496px tall gets the phone form instead of a
  squashed canvas.
- Both forms must render every view-model field. A test renders a
  `MajorModel` through both (`phoneForm.test.tsx`).
- The masthead's ⌘K search is not on the Dashboard; its own search is the
  SRD panel (the canvas's SRD tab, the phone's search key).
- Undo stays unbuilt in both forms (see [combat loop](../ARCHITECTURE.md#combat-loop)). A
  follow-up decides it.
