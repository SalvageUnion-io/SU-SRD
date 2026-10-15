# App glossary

One noun and one verb per concept, in everything a player reads in the Cantina and the bot: labels, dialogs, server refusals.
Code identifiers may differ (`organizer`, `softLinks`, a null `gameId`); copy follows this page. The model is ADR-030 in [ARCHITECTURE.md](../ARCHITECTURE.md).

1. **Game** — the shared container a table plays in: always capital G ("Start a Game", "Not in a Game", "Your Games").
   Lowercase "game" is only Salvage Union itself ("Buy the game"). Not campaign, group or workspace.
2. **Shelf** — the per-account container: "your shelf" in a sentence; **Shelves** is the page at `/`. Never "My Stuff".
3. **Assign** — the one verb for an assignment (ADR-037): assign, unassign, assigned; a pilot to a mech, a pilot, mech or NPC to a crawler.
   Never linked, wired, docked or aboard for it; a crawler's assigned pilots are its crew. Code calls the record a soft link.
4. **Move** — the same record changes container ("Move to a Game…", "Move to your shelf"). It is never a copy.
5. **Make a copy** — a new, separate record (ADR-030 §2); the one label for copying wherever it is offered.
   The Starter Set's "Copy to…" only picks where the copy lands.
6. **Pick up** and **Offer to the crew** — the roster's verbs for taking an unclaimed build in a Game and handing yours back.
7. **Board** — a pilot taking a mech's seat on the Dashboard (ADR-038); "aboard" belongs to this, not to assignment.
   "Dock" is only the Mech Bay's function action.
8. **Player**, **Mediator**, **Organiser** — the roles, capitalised; Organiser in British spelling. "Table runner" in docs is the Mediator, or the Organiser while a Game has none.
