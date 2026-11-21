# App glossary

One noun and one verb per concept, in everything a player reads in the app and the bot: labels, dialogs, server refusals.
Code identifiers may differ (`organizer`, `softLinks`, a null `gameId`); copy follows this page. The model is ADR-030 in [ARCHITECTURE.md](../ARCHITECTURE.md).

1. **Game** — the shared container a table plays in: always capital G ("Start a Game", "Not in a Game", "Your Games").
   Lowercase "game" is only Salvage Union itself ("Buy the game"). Not campaign, group or workspace. Its page is under the Games tab, `/games/$gameId` (ADR-066).
2. **Shelf** — the per-account container (code name). Players read it as the **Training Bay** (`PRODUCT.build`): "your Training Bay" in a sentence, **Training Bay** the page at `/`, its band pilot orange. Never "Hangar" or "My Stuff".
   The Training Bay lists everything you own, in a Game or not, and nothing else; a unit's Game is a chip there, never a filter or a place, and no Games are listed there (ADR-052, ADR-066).
3. **Assign** — the one verb for an assignment (ADR-037): assign, unassign, assigned; a pilot to a mech, a pilot, mech or NPC to a crawler.
   Never linked, wired, docked or aboard for it; a crawler's assigned pilots are its crew. Code calls the record a soft link.
   A sheet's **Related units** section lists what it is assigned to, and its companions (R70).
4. **Move** — the same record changes container ("Move to a Game…", "Move to your Training Bay"). It is never a copy.
5. **Make a copy** — a new, separate record (ADR-030 §2); the one label for copying wherever it is offered.
   The Starter Set's "Copy to…" only picks where the copy lands.
6. **Assign to** a member, and **Unassign** — who in a Game edits a pilot or mech (ADR-030 §4): the assigned member edits, the crew reads, the table runner reassigns. Never claim, pick up or own for it. A free one is **Assign to me**.
7. **Board** — a pilot taking a mech's seat in Play (ADR-051 §3); "aboard" belongs to this, not to assignment.
   "Dock" is only the Mech Bay's function action.
8. **Player**, **Mediator**, **Organiser** — the roles, capitalised; Organiser in British spelling. "Table runner" in docs is the Mediator, or the Organiser while a Game has none.
9. **Training Bay** and **Games** — the app's two areas (`PRODUCT.build`, `PRODUCT.play` in `game-domain/product`). Nav labels are verbs: the header and drawer read Reference | Build | Play (then Buy the game), each linking its landing page (`/reference/`, `/build/`, `/games/`); the logo is the marketing home, `/` (ADR-066 §7).
   They name pages (the Training Bay at `/`, "Patterns · Training Bay", the Games hub's band). **Play** is the header's word for the Games area and a mode of a pilot’s page (Sheet | Edit | Play); no page is titled Play. The whole app is "the app" (the account: a salvageunion.io account).
   The Training Bay and The Cantina are also SRD crawler bays, with Pilot Bay: the reference pages and search keep them as bays.
   Code still says `cantina` only for the bay (`BAY.cantina`), the old commit scopes, ADR-021's file name and issue ids like CANTINA-CONVEX-9; everything else is `app`, `build` or `play`.
10. **Group session** — a Game's table sitting down to play: the table runner's **Start group session** and **End group session**; while it runs, "Session live" and **Join session**. Never a lock: Play opens without one.
11. **Crew** — the players' units at one table: a Game's crew, Play's Crew pane. A crawler bay's NPC is its **crew lead**, never "crew"; a crawler's assigned pilots stay its crew (3).
12. **Rolls** and **Rules** — Play's two reference panes: **Rolls** the roll tables (tab, pane head, the Mediator's tab), **Rules** the SRD inside Play (tab, pane head, the Mediator's ⋯). Never "Tables" or "Reference" there: the Mediator's **Table** is the seats.
13. **Units** — in Play, your own pilot, mech and crawler (the pane, the ⋯ row). A sheet's linked units are its **Related units**.
