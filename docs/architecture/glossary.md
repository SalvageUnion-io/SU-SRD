# App glossary

One noun and one verb per concept, in everything a player reads in the app and the bot: labels, dialogs, server refusals.
Code identifiers may differ (`organizer`, `softLinks`, a null `gameId`); copy follows this page. The model is ADR-030 in [ARCHITECTURE.md](../ARCHITECTURE.md).

1. **Game** — the shared container a table plays in: always capital G ("Start a Game", "Not in a Game", "Your Games").
   Lowercase "game" is only Salvage Union itself ("Buy the game"). Not campaign, group or workspace. Its page is Play's, `/play/games/$gameId` (ADR-052).
2. **Shelf** — the per-account container (code name). Players read it as the **Training Bay** (`PRODUCT.build`): "your Training Bay" in a sentence, **Training Bay** the page at `/`, its band pilot orange. Never "Hangar" or "My Stuff".
   The Training Bay lists everything you own, in a Game or not; a unit's Game is a chip and a filter there, never a place (ADR-052).
3. **Assign** — the one verb for an assignment (ADR-037): assign, unassign, assigned; a pilot to a mech, a pilot, mech or NPC to a crawler.
   Never linked, wired, docked or aboard for it; a crawler's assigned pilots are its crew. Code calls the record a soft link.
4. **Move** — the same record changes container ("Move to a Game…", "Move to your Training Bay"). It is never a copy.
5. **Make a copy** — a new, separate record (ADR-030 §2); the one label for copying wherever it is offered.
   The Starter Set's "Copy to…" only picks where the copy lands.
6. **Pick up** and **Offer to the crew** — the roster's verbs for taking an unclaimed build in a Game and handing yours back.
7. **Board** — a pilot taking a mech's seat in Play (ADR-051 §3); "aboard" belongs to this, not to assignment.
   "Dock" is only the Mech Bay's function action.
8. **Player**, **Mediator**, **Organiser** — the roles, capitalised; Organiser in British spelling. "Table runner" in docs is the Mediator, or the Organiser while a Game has none.
9. **Training Bay** and **The Cantina** — the names of Build and Play, the app's two areas (`PRODUCT.build`, `PRODUCT.play` in `game-domain/product`), each a bay of the Union Crawler.
   They name pages (the Training Bay at `/`, "Patterns · Training Bay", the Play hub's band); the header's tabs stay Reference | Build | Play. The whole app is "the app" (the account: a salvageunion.io account), never "the Cantina".
   Both are also SRD crawler bays, with Pilot Bay: the reference pages and search keep them as bays.
   Code still says `cantina` only for the bay (`BAY.cantina`), the old commit scopes, ADR-021's file name and issue ids like CANTINA-CONVEX-9; everything else is `app`, `build` or `play`.
