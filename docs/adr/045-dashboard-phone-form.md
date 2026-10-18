# ADR-045: The Dashboard Has a Phone Form

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 45, which summarises it.

## Status

**Accepted; built.** Amends
[ADR-038](038-dashboard-game-surface.md) §3, §4 and §9. It adds no mode to [ADR-021](021-cantina-surface-taxonomy.md).
The phone form is Guided Play, with the same enforcement, seat and Change Log
as the canvas, so the taxonomy and the
[rules and the Cantina surfaces](../ARCHITECTURE.md#surfaces) matrix do not change.

**Partly superseded by [ADR-051](051-play-mode.md):** Play's four phone tabs
replace decisions 3 (unit tabs), 4 (the resolve screen) and 5 (the bar's
menu). Decisions 1 (two forms, one surface), 2 (same enforcement), 6 (its
own bar) and 7 (browser zoom raises the floor) stand.

## Context

ADR-038 §9 made the Dashboard a fixed 1280×800 canvas. A host whose width
would draw the canvas below 0.62 scale got a rotate-to-landscape notice
instead. In practice:

- Portrait phones got no Dashboard at all.
- Landscape phones passed the width test and got the canvas at about 0.49
  scale. Its 9px labels shrank to about 4.4px and its 44px targets to about
  22px.

Players run their sheets on phones at the table. The brand refresh drew a
phone form (boards D4 and D5).

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
7. **Browser zoom raises the floor.** *(Amended.)*
   - Scaling the canvas to fit cancels zoom: an 11px label painted at 12.7,
     12.5 and 12.4 device px at 100%, 150% and 175% zoom (WCAG 1.4.4).
   - The canvas holds only while its fitted scale is at least 0.62 × the
     page zoom, so a zoomed reader reaches the phone form sooner, and the
     phone form's type grows with zoom. A 1920×1080 desktop keeps the canvas
     at 125% and gets the phone form at 150%. A caller's own floor (the
     Mediator Dashboard's 0.8) rises the same way.
   - The zoom is `devicePixelRatio` normalised against the display's own
     density (`pageZoom`). `devicePixelRatio` alone cannot tell them apart:
     a Retina screen at 100% and a 1x screen at 200% both report 2. The
     window's width in screen px over the viewport's in CSS px is the zoom
     in Chromium, but a side panel, docked devtools or vertical tabs widen
     the window the same way, and on a high-density screen
     `devicePixelRatio` does not cap them. So a reading counts only when it
     snaps to a browser zoom step (110% to 300%, up to 3% over for a window
     frame) and `devicePixelRatio` over that step is a
     density a screen ships with (a quarter step from 1, to within 0.2%:
     a real zoom divides exactly). A 14-inch MacBook Pro with a 400px side
     panel reads 1.36, between steps, so the Mediator Dashboard keeps its
     0.87 canvas.
   - Every doubtful reading is 1, which is the old behaviour. A panel
     reads as zoom only by landing on a step and a density at once. On a
     Retina screen only the 200% step leaves a quarter density, so only a
     panel as wide as the page itself. The known false positive is a
     125% Windows display: a panel that puts the ratio near 1.25 (300 to
     340px on a 1536px window) reads as 125% zoom, because 1.25 / 1.25 = 1
     is a density. Firefox scales `outerWidth` with the page, so it reads
     1 there; a zoom on a density that is not a quarter step (a custom
     Windows scale) also reads 1. Zooming out never lowers the floor.
   - The viewport's width counts the page's scrollbar (`layoutWidth`), so
     both forms read the same zoom. Only the phone form scrolls; measured
     without its scrollbar, switching to it raised the reading by the
     scrollbar's width, which near a step's edge dropped the zoom to 1 and
     switched back, forever. A pinch-zoom, which shrinks `innerWidth`, does
     not move the reading.

## Alternatives rejected

- **Keep the notice, or lower the scale floor.** Both stay illegible, and
  scaling fights browser zoom.
- **A fluid canvas that reflows its grid.** ADR-038 rejected this because
  no-scroll cannot hold. The phone form scrolls, and says so.
- **Two Minors stacked above the Major** (an earlier sketch). At 812px the
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
- Browser zoom reaches the phone form, and sooner than the CSS viewport
  alone would (decision 7), which closes
  [dashboard.md](../architecture/dashboard.md) §10.3.
- The px type scale still ignores the browser's default font size; only
  page zoom moves the floor.
- A desktop window under about 496px tall gets the phone form instead of a
  squashed canvas.
- Both forms must render every view-model field. A test renders a
  `MajorModel` through both (`phoneForm.test.tsx`).
- The masthead's ⌘K search is not on the Dashboard; its own search is the
  SRD panel (the canvas's SRD tab, the phone's search key).
- Undo stays unbuilt in both forms (see [combat loop](../ARCHITECTURE.md#combat)). A
  follow-up decides it.
