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
Reference draw is: editing or deleting the design later changes no fight
already prepared. `refSchema` stays `npcs` with an empty `refSlug`, so readers
that know nothing of `built` still read a valid row.

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
`scenes` is in the schema and unbuilt: the next layer adds its editor without
a migration. A scene names an encounter by id and never copies it. The plan
is replaced whole on save; one Mediator writes it, so there is no merge.

### 5. The Kit stands under Games

The Mediator's Kit is a section of the Games hub (`/games/#mediators-kit`),
listing every encounter and NPC across Games. NPC and encounter sheets
highlight Games in the Union bar and lead back to the Game's Prep, or to the
Kit when they belong to none. Their addresses do not change.

### Not decided

Whether players ever see a session's date; scenes and their editor; an
encounter shared between two Mediators.
