# ADR-045: The Dashboard Has a Phone Form

Amends [ADR-038](038-dashboard-game-surface.md) §3, §4 and §9. The phone form
is Guided Play: same enforcement, seat and Change Log as the canvas.

1. **Two forms, one surface.**
   - `/dashboard/$pilotId` renders the canvas when it fits at a scale of 0.62
     or more on **both** axes, and the phone form otherwise.
   - Both forms read the same seat, store, rules and view models
     (`MajorModel`, `MinorModel`, `DeckListModel`, `ResolveModel`). A form is a
     renderer, never a second home for play state; both render every
     view-model field (`phoneForm.test.tsx`).
   - Changing form keeps the seat and the device state.
2. **Same mode, same enforcement.** Every phone control calls its canvas twin's
   handler under the same rules; the phone form adds no transaction and drops
   nothing a turn needs.
3. **Unit tabs replace the slot row.**
   - Three tabs in a fixed order: Pilot · Mech · Crawler.
   - The selected tab is the Major on open and follows the Major when the mount
     changes; otherwise only the player moves it.
   - A tab shows that unit's full controls (the canvas's ⤢), carries its
     `MinorModel` warning, and only the Major's tab holds the deck.
4. **Resolving is a screen.** Opening an action replaces the tab body: the
   action card and rolled row (the full table one tap away), the Major's spend
   vitals pinned in its header, the next step's buttons pinned at the bottom.
5. **The display's other tabs go behind the bar's menu.** ≡ opens Reference,
   Tables, SRD, Log and Crew as full-screen panels, plus the Game link with the
   latest alert and proposal count, the saved state and the Mediator's Downtime
   control. The bar's search opens the SRD panel.
6. **The Dashboard has no masthead.** At every width `/dashboard` renders its
   own bar in place of the app masthead; the offline banner stays.
7. **Browser zoom raises the floor.**
   - The canvas holds only while its fitted scale is at least 0.62 × the page
     zoom (a caller's own floor, the Mediator Dashboard's 0.8, rises the same
     way); the phone form's type grows with zoom.
   - The zoom is `pageZoom`: `devicePixelRatio` normalised against the
     display's density. A reading counts only when the window-to-viewport ratio
     snaps to a browser zoom step (110–300%, up to 3% over) and
     `devicePixelRatio` over that step is a shipping density (a quarter step
     from 1, within 0.2%); every doubtful reading is 1. Side panels, docked
     devtools and vertical tabs widen the window like zoom does, which is why.
   - The viewport width counts the scrollbar (`layoutWidth`), so both forms read
     the same zoom and switching cannot oscillate. Pinch-zoom does not move it.

## Consequences

- No-scroll stays a landscape-desktop contract; the phone form scrolls inside a tab.
- The px type scale ignores the browser's default font size; only page zoom
  moves the floor.
- The masthead's ⌘K search is not on the Dashboard; its search is the SRD panel.
