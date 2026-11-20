# ADR-066: Reference | Training Bay | Games, One Page per Unit

Decided 2026-11-19 by Jrvs, built on #1950's redesign. Build and Play were
gated modes: a pilot had a sheet in Build and a second page in Play, Games
were listed in both, and a Game's page sent players back to Build to manage
units. The site is reorganised around things, with modes as tabs, the way a
character builder or rules manager reads.

- **Amends** [ADR-052](052-build-assets-play-games.md) §1, §4–§6: the Training
  Bay keeps everything you own but no Games list; the Games hub keeps Games and
  invites; a pilot's Cockpit is its own page's Play mode.
- **Amends** ADR-062 §1–§3 (addresses): Play's root `/play` becomes `/games`.
- **Amends** [ADR-051](051-play-mode.md) §1: Play opens from the pilot's page.

What players do, from a week of production aggregates (2026-11-12 to 19): the
reference is the front door (about 52k page views, the chassis index the top
page after home); the app's landings are the Training Bay (~1.1k) far ahead of
the Play hub (~170). Of the 112 people who own units, 37% are in any Game and 23
of 44 Games have one member. Building is the main use; Games are optional.

### 1. The header is nouns

The Union bar's tabs read **Reference | Training Bay | Games**. The second-row
nav goes: each of its items (Training Bay, Patterns, Starter Set; Games, Solo)
repeated a tab or a Training Bay panel. The bar's `data-tool` and `data-mode`
keys stay `build` and `play`, so the stylesheet is unchanged. `PRODUCT.play`
reads Games, so the band, titles and link previews match the tab.

### 2. Addresses

`/build` stays the app's base; the Games live at `/games/`, `/games/:id`,
`/games/:id/mediate` and `/games/invite/:token`. A pilot's Play is
`/build/pilots/:id/play`. Every old address (`/play/…`, and the older
`/build/play/…`, `/build/games…`, `/build/dashboard/:id`) 301s in one hop,
query kept; `/play` stays Worker-first for those 301s only.

### 3. One page per unit: Read | Edit | Play

A unit's page carries its modes as one Segmented control. Play is a pilot's:
Play requires a pilot alone, its mech optional. A mech plays through its
assigned pilot, so its page shows Play only while one is assigned, opening that
pilot's Play. The Cockpit keeps its own Play bar with the site header hidden;
its back button returns to the pilot's page. A pilot in no Game plays solo
there; there is no Solo list anywhere.

### 4. The Training Bay is the anchor

It lists every unit you own, in a Game or not; a unit's Game stays a chip.
Patterns sit first in the right column: planning comes before building
(chassis, then a pattern, then a mech on a pilot). Every pilot line carries its
mech, or "+ Add a mech" (`/mechs/new?pilot=`, assigned on create), and a Play
door beside its ⋯ menu; the Mechs ledger holds only mechs no pilot flies. New
Mech opens on From a pattern, then Guided and Blank. A mech's band always
names its chassis and the pattern it came from, linked. The Games ledger goes.

### 5. Games hold Games

The hub lists your Games and their doors, + New Game and Join with a link. A
Game's page keeps its Crew, its + New Pilot, Mech and Crawler (each starts a
wizard for that Game), proposals, invite, The Game and Safety. "Manage in
Build" goes: moving a unit is its ⋯ menu's in the Training Bay, one tab away.

### 6. Mediator prep stays in the Training Bay

Encounters and NPCs are made and kept there (ADR-059). A Game's page gives its
Mediator one Your prep section counting what is ready, with a link to the
Training Bay; running an encounter stays on Mediate, the band's door.

### 7. The header links its areas by what they do

The Reference | Training Bay | Games toggle becomes three plain links with
descriptive names, **Reference | Builder | Games**, the current one
underlined; each opens its landing page (`/reference/`, the book's Contents;
`/build/`; `/games/`). The logo opens the marketing home, `/`, which marks no
area current. Pages keep their names (the Training Bay at `/build/`).
