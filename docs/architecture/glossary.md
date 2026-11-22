# App glossary

One noun and one verb per concept, in everything a player reads in the app and the bot: labels, dialogs, server refusals.
Code identifiers may differ (`organizer`, `softLinks`, a null `gameId`); copy follows this page. The model is ADR-030 in [ARCHITECTURE.md](../ARCHITECTURE.md).

1. **Game** — the shared container a table plays in: always capital G ("Start a Game", "Not in a Game", "Your Games").
   Lowercase "game" is only Salvage Union itself ("Buy the game"). Not campaign, group or workspace. Its page is under the Games tab, `/games/$gameId` (ADR-066).
2. **Shelf** — the per-account container (code name). Players read it as the **Training Bay** (`PRODUCT.build`): "your Training Bay" in a sentence, **Training Bay** the page at `/`, its band pilot orange, and the account menu's link to it. Never "Hangar", "My Stuff" or "Your Characters". An NPC or encounter in no Game is in your **Mediator's Kit** (on the Games page), never the Training Bay.
   The Training Bay lists everything you own, in a Game or not, and nothing else; a unit's Game is a chip there, never a filter or a place, and no Games are listed there (ADR-052, ADR-066).
3. **Assign** — the one verb for an assignment (ADR-037): assign, unassign, assigned; a pilot to a mech, a pilot, mech or NPC to a crawler.
   Never linked, wired, docked or aboard for it; a crawler's assigned pilots are its crew. Code calls the record a soft link.
   A sheet's **Related units** section lists what it is assigned to, and its companions (R70).
4. **Move** — the same record changes container ("Move to a Game…", "Move to your Training Bay"). It is never a copy.
5. **Make a copy** — a new, separate record (ADR-030 §2); the one label for copying wherever it is offered.
   The Starter Set's says it too: one confirm names where, and a pilot brings their mech.
6. **Assign to** a member, and **Unassign** — who in a Game edits a pilot or mech (ADR-030 §4): the assigned member edits, the crew reads, the table runner reassigns. Never claim, pick up or own for it. A free one is **Assign to me**.
7. **Board** — a pilot taking a mech's seat in Play (ADR-051 §3); "aboard" belongs to this, not to assignment.
   "Dock" is only the Mech Bay's function action.
8. **Player**, **Mediator**, **Organiser** — the roles, capitalised; Organiser in British spelling. "Table runner" in docs is the Mediator, or the Organiser while a Game has none.
9. **Training Bay** and **Games** — the app's two areas (`PRODUCT.build`, `PRODUCT.play` in `game-domain/product`). Nav labels are the names of the pages they open: the header and drawer read Reference | Training Bay | Games (then Buy the game), each linking its landing page (`/reference/`, `/build/`, `/games/`); the logo is the marketing home, `/` (ADR-066 §7, as amended). "Build" and "Play" are never names for a place.
   They name pages (the Training Bay at `/`, "Patterns · Training Bay", the Games hub's band). **Play** is a mode of a pilot's page (Sheet | Edit | Play); no page or tab is titled Play. A door says one thing, wherever it stands (the session strip, a Game's page and its row on the Games list, a pilot's line, a sheet's band): the door into Play is **Join session** while the pilot's Game has a group session live, else **Open table** (a solo pilot's too), and it always opens the seat, the pilot's Play; two side by side add the callsign ("Open table · GHOST"), and its accessible name says who ("Open table as GHOST"), from `sessionDoor`; the Mediator's is **Mediate**. A pilot in a Game is titled with the Game, and its pages sit under the Games tab. The whole app is "the app" (the account: a salvageunion.io account).
   The Training Bay and The Cantina are also SRD crawler bays, with Pilot Bay: the reference pages and search keep them as bays.
   Code still says `cantina` only for the bay (`BAY.cantina`), the old commit scopes, ADR-021's file name and issue ids like CANTINA-CONVEX-9; everything else is `app`, `build` or `play`.
10. **Group session** — a Game's table sitting down to play: the table runner's **Start group session** and **End group session**; while it runs, "Session live" and **Join session**. Never a lock: Play opens without one. Starting one tells the table play has started and keeps a log for the Game's page, and the control says so.
    "Session" alone is always this. A Mediator's hand-kept notes for each time the table meets are **Session plans** (Prep's list, "+ Add a session plan"); starting a group session never adds one.
11. **Crew** — the players' units at one table: a Game's crew, Play's Crew pane. A crawler bay's NPC is its **crew lead**, never "crew"; a crawler's assigned pilots stay its crew (3).
12. **Rolls** and **Rules** — Play's two reference panes: **Rolls** the roll tables (tab, pane head, the Mediator's tab), **Rules** the SRD inside Play (tab, pane head; the Mediator's side pane, its ⋯ on a phone). Never "Tables" or "Reference" there: the Mediator's **Table** is the seats.
13. **Units** — in Play, your own pilot, mech and crawler (the pane, the ⋯ row). A sheet's linked units are its **Related units**.
14. **Pilot names** — a pilot is called by callsign, then name, wherever one is listed or titled: `GHOST · Mara Voss` (one of the two alone when the other is missing or repeats it), from `pilotLabel` (`game-domain/pilotLabel`) and nowhere else; the `noInlinePilotName` lint rule refuses a callsign-or-name fallback written at a call site. A door or a sentence with room for one word takes the callsign (`pilotCallsign`): "Open table · GHOST".
    A boarded pilot keeps that name: the line wears the mech's tone and readings and names the mech in a `MECH` chip (`crewPair`).
