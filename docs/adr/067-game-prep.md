# ADR-067: A Game's Prep and Its Plan

Decided 2026-11-21 by Jrvs, from the Mediator persona review. A Mediator's
prep sat in three places: encounters and NPCs on the Training Bay shelf, the
picker in a Game's Opposition, and nothing at all for the Game's own notes.
NPCs a Mediator designed never reached the picker. A Game could not be renamed
and a member could not leave. Prep gets one home per Game, and the first layer
of a campaign planner: **Game > sessions > scenes > optional encounter**.

- **Amends** [ADR-059](059-mediator-prep-kit.md): an encounter may belong to a
  Game and keep a place in its order; the opposition fields the Mediator's own
  NPCs.

It also builds on ADR-044 (an NPC is designed from any Reference denizen) and
on [ADR-066](066-training-bay-and-games.md) §1 (NPC and encounter sheets stand
under Games, where the Mediator's Kit lists them).

Every stored field below is additive and optional: a record written before
this reads unchanged, and nothing is migrated.

### 1. The Mediator's own NPCs on the field

The Opposition picker leads with kind tabs and searches across every kind; a
"Yours" tab lists the NPCs the Mediator designed. Fielding one stores a
snapshot on the tray row or the encounter's opponent: `built: { npcId, name,
actions, traits }`, beside the usual name, HP or SP. It is a copy, as a
Reference draw is. `refSchema` stays `npcs` with an empty `refSlug`, so readers
that know nothing of `built` still read a valid row.

Amended 2026-11-21 (second persona review):

- **The snapshot keeps its kind.** `built` gains two optional fields, `kind`
  (the template's schema, where the design was built from a denizen that is not
  a plain NPC) and `bioSalvageValue`. A row built from a Bio-Titan is chipped
  and badged a Bio-Titan and leaves a Bio-Titan's Bio-Salvage. A snapshot taken
  before this has neither and reads as an NPC.
- **Prep follows a redesign.** A saved NPC reopens in the designer
  (`/npcs/<id>/design`, its sheet's "Edit design") and is saved in place.
  Saving rewrites the snapshot on every encounter of its maker's that fields
  it: the stat block, HP or SP, and the name where the opponent still went by
  the design's. A fight already on a Game's field keeps the snapshot it was
  run with. A crawler's crew are not redesigned there: their slot sets their
  stats (ADR-044).

Amended 2026-11-22 (third persona review):

- **Prep follows a delete.** Deleting a designed NPC asks once, naming the
  encounters of its maker's that field it, and takes it out of them on
  confirm. A fight already on a Game's field keeps its copy.
- **A copy stays beside its original.** Make a copy of an NPC kept in a Game
  makes the new NPC in that Game, so it is on the Game's Prep at once; pilots,
  mechs and crawlers still copy to the Training Bay (ADR-030 §2).
- **A redesign is not a walk.** A saved NPC's designer opens with every step
  reached, and each step saves.
- **An encounter is fielded as its page lists it**: those alone first, then
  each group by wave, each in the order it was made.

### 2. Any denizen is a template

The designer starts blank or from any kind the Opposition fields (NPCs,
Squads, Creatures, Vehicles, Drones, Meld, Bio-Titans). `templateRef.schema`
widens to those kinds; it stays informational. A denizen with Structure Points
fills the design's track as SP. `/npcs/new?from=<schema>:<slug>` opens the
designer on one, and a denizen's Reference page links there ("Design from
this") and to `/encounters/add?from=…` ("Add to an encounter") for a signed-in
reader.

### 3. A Game's settings, its members, its Prep

- **Settings.** The Organiser renames the Game and writes a description (280
  characters), stored on the Game room's `game` row and published to the
  roster index, so the invite shows it before anyone joins.
- **Leaving.** A member leaves; the Organiser removes a member. Either way
  each unit that member assigned is handed back to its owner's Training Bay
  through the same handoff a withdrawal uses, then the membership ends.
  Nothing is deleted. The Organiser cannot leave their own Game.
  **The Game's own stay** (amended 2026-11-22, fourth persona review). A pilot
  or mech a template Game came with (stamped with the Game's own creation
  time, as `templateUnits` already reads them) is the Game's, not the member's
  who was assigned it: on leaving or removal it is unassigned and stays on the
  roster, with every change made to it; only what the member brought goes
  home. `games.get` names them (`templateUnitIds`, read from what is stored),
  and the dialog lists which is which. The Organiser can take an unassigned
  one, with the mech it came with, off the roster to their own Training Bay
  (`games.takeOffRoster`, undone by `games.putBack`): a move, never a delete.
- **Prep.** `/games/<gameId>/prep`, for the table runner: the Game's
  encounters in order, the NPCs moved to the Game, and the plan (§4). An
  encounter gains `gameId` and `order`. `gameId` is the owner's label on their
  own record, not a grant: the encounter stays its maker's alone, and the
  Run dialog lists this Game's first, then the rest.

### 4. The plan

One row per Game room (`plan`), read and written only by the table runner:

```
GamePlan { schemaVersion: 1, notes, sessions: Session[] }
Session  { id, date?, title?, note, scenes?: Scene[] }
Scene    { id, title, note?, encounterId? }
```

Layer 1 builds the notes and the dated session list with a private note each.
The page calls the list **Session plans** (glossary 10): a "session" alone is the
group session, and starting one never adds a plan.
`scenes` is in the schema and unbuilt: the next layer adds its editor without
a migration. A scene names an encounter by id and never copies it. The plan
is replaced whole on save; one Mediator writes it, so there is no merge.

**Notes are their author's** (amended 2026-11-21, second persona review). A
hand over showed the next Mediator every private note. The sessions (days,
titles, scenes) are the Game's and pass with the table; `notes` and each
session's `note` belong to the member who wrote them and never pass with the
role. The stored row gains two optional fields, and nothing is migrated:

```
StoredGamePlan = GamePlan & { author?, byAuthor?: { [discordId]: { notes, sessions: { [sessionId]: note } } } }
```

`plan.get` answers a `GamePlan` holding only the caller's notes, so no client
ever receives another author's. A save files the caller's notes under
`byAuthor` and leaves everyone else's alone; a removed session takes its notes
with it. A row written before this keeps its notes in place: they are
`author`'s, and the room stamps `author` with whoever runs the table the first
time a Mediator is appointed or stood down, so existing notes belong to
whoever is Mediator now. Prepared encounters and NPCs were never the Game's
(§3) and stay their maker's. The hand over dialog says what goes and what
stays, and the new Mediator is told by a `role` event on the table's stream.

**A former Mediator reads their notes back** (amended 2026-11-22, fourth persona
review). The dialog promised the notes stay theirs, and no screen reached them
once Prep left their Game page. `plan.mine` answers any member their own notes
(`ownNotesFor`): the Game notes and each session's note with its day, never a
title, never another author's, and null when they wrote none. It is a read of
what is already stored; nothing is added to the row. The Game page shows it
read-only as "Your notes from when you ran it"; taking the table back makes
them editable in Prep again, and that dialog says so.

**The session days are every member's.** A Game's read (`games.get`) carries
`sessionDays`: the coming sessions' days, soonest first, and nothing else of
the plan (never a title or a note). The Game's page shows the next one.

### 5. The Kit stands under Games

The Mediator's Kit is a section of the Games hub (`/games/#mediators-kit`),
listing every encounter and NPC across Games. NPC and encounter sheets
highlight Games in the Union bar and lead back to the Game's Prep, or to the
Kit when they belong to none. Their addresses do not change.

### Not decided

Scenes and their editor; an encounter shared between two Mediators, or handed
on with the table.
