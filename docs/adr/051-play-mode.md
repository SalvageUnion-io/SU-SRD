# ADR-051: Play Is the Third Mode, Laid Out as a Cockpit

Built: the `dashboard-cockpit` milestone (tracker #1633); Play as built is
[play.md](../architecture/play.md).

- **Supersedes** [ADR-038](038-dashboard-game-surface.md) §1 (Game-only; Play
  also runs solo, §4), §3's Major and Minor slots (one Units column, §2, §5),
  §4's tabbed display (one Actions list, §6), §5's layout sentence and §6's
  route (Play replaces `/dashboard/$pilotId` and `/mediator/$gameId`), and
  amends its §2: a seat's Game is optional, a solo seat holds the solo
  Downtime, and every seat carries a presence heartbeat (§4, §7). ADR-038's
  seat (§2), boarding menu (§3), server-derived crew data (§4), crawler and
  boarding rules (§5), one store and rules engine under the ADR-007 boundary
  (§6), reused SRD display (§7) and materials (§8) stand. Its fixed scaled
  canvas (§9) stood until 4.5.0, when §2 and §10 replaced it.
- **Supersedes** ADR-045 (the phone form; retired, text in git): §10 replaced
  its decisions 3, 4 and 5, and in 4.5.0 (#1792) §2 and §10 its floor (1) and
  zoom (7). Its decision 2 is §10's last sentence; its 6 (no masthead) is §2's.
- **Amends** [ADR-030](030-accounts-games-server-of-record.md) (§4, §7, §8 below).
- **Amended by** [ADR-052](052-build-assets-play-games.md): the landing is the
  hub for Games (§1).

### 1. Play is a mode

The site header offers Reference, Build and Play. Play lands on `/build/play`,
the hub for Games ([ADR-052](052-build-assets-play-games.md) §4): the player's
Games (play or mediate) and New Game and Join, their pilots to play solo, and
each Game's Discord channel; each Game's page is Play's too. Players know Play
as **The Cantina**, the crawler's social hub, and Build as the **Training
Bay**: the tabs keep the verbs, the names go on the pages, and the bar wears the page's
band, or, with none, its area's (Build pilot orange, Play the deep crawler pink). "The Cantina" names Play alone, never the whole app.

### 2. The Cockpit frame

One layout at every width, phone first (4.5.0, #1792: phone page views are
about equal to desktop's), filling the window and never scrolling as a page; a
pane scrolls inside itself. A Play bar (back, the Game or "Solo", connection,
the Situation switch, the channel) in place of the site's masthead, then the
panes: from the `lg` rung three columns, Units, Actions, and Crew, Tables and
Feed; below it the same panes as tabs (§10). Container queries arrange them,
never a second component tree, so crossing the rung re-lays the panes without
remounting them. The Situation changes what the Actions pane holds, never the
frame.

### 3. Situation

On foot, Boarded (choosing among the pilot's mechs) or Downtime. On foot and
Boarded are the seat's mount. Downtime in a Game is the Game's `downtime` row,
Mediator-only; solo, the player runs it.

### 4. Solo play has a seat

Play opens for any pilot its owner holds. A Shelf pilot gets a solo seat keyed
by the pilot (`seats.gameId` optional), with the same mount, range, effects and
resolve, plus its own Downtime step.

### 5. Live and reference units

A live unit shows − / + on every vital; a reference unit is read-only, dashed,
with the one control that makes it live (Board). The pilot is always live, a
mech only while Boarded, the crawler in solo Downtime and always for the
Mediator. Sheets open as an overlay; Build stays where loadouts are edited.

### 6. One Actions list

Every action from pilot, mech and crawler is one list of Minis, sorted and
filtered by action type. What the Situation allows is On hand; the rest is a
collapsed Not on hand group naming what each needs. Boarded keeps the pilot's
own abilities and equipment on hand. An action resolves inline in its Mini
(Activate, Roll, Push, Apply) on the seat's `resolving`.

### 7. Crew and presence

In a Game the right column lists the other seats: presence, mount and the vital
needing attention, each opening its sheet read-only. Presence was a heartbeat on
the seat (`lastSeenAt`); from 4.5.0 it is who holds a socket open to the Game
room (ADR-064), and nothing is written. Disconnected and Outdated stay read-only.

### 8. Tables post to Discord

`/su bind` binds a channel to a Game (by its Mediator or Organizer) or to the
caller for solo play, in `channelBindings`.
Rolls made in Play post there as the bot's table card: one toggle per screen, a
per-roll override, the Mediator private by default.

### 9. The Mediator uses the same frame

Seats left; Opposition and the chosen NPC's actions centre (the Downtime step
track in Downtime); Tables, Feed and the propose dock right; a Scene / Downtime
switch in the Play bar.

### 9a. The Mediator's rolls are on the Game's log; a private one is theirs (5.x)

Amends §8's "the Mediator private by default". A Mediator's roll is written to
the Game's log as a player's is, so it survives a reload and reaches every
Feed. The Mediator's Rolls pane has a Private rolls switch, off by default and
remembered per Game in the browser (r2 B2). A roll
made with it on carries `private: true` in its `change_log` row's `after`: the
room serves that row only to Mediators and to its roller, drops the flag from
any row a non-Mediator appends, and the client never posts it to Discord.

Up now is a marker the Mediator puts on one seat: one `change_log` row (field
`upNow`, `after: { pilotId }`, replaced on each change), read back as the
optional `upNow` of `scenes.current` and set by `scenes.setUpNow`. It orders
nothing and gates nothing.

**The player who is up ends their own turn (r4 B1).** `scenes.endTurn`, sent
by the member the marked pilot is assigned to, writes that same row back to
nobody and one `turn` event ("Pickle ended their turn"), which the Feed lists
and a Mediator's screen toasts. Nobody is up after it: there is still no turn
order, no rounds and no record of who has acted. The seat's button reads
**Give the turn**.

**An alert can be withdrawn (r4 B4).** `changeLog.withdrawAlert` (a
Mediator's) deletes the alert's `change_log` row, so it leaves every strip and
Feed, and writes one `withdrawn` event ("Mediator withdrew an alert"). What
was posted to the bound channel stays there, followed by that line.

**A wreck keeps its salvage roll (r5 B1, B2).** A downed Mech's tray record
may carry `salvageRoll` (`{ roll, rolledAt }`), set by `mediator.updateNpc`
while it is down and unsalvaged, so its band outlasts leaving Mediate. A
Mediator's roll row may carry `slot` (`wreck:<npc id>`): appending one deletes
the slot's earlier `roll` row, so a re-roll, and the line that says what was
taken and where, stay one Feed line. A haul to a crew Mech is a proposal on
`cargoLots` holding the lots it adds; accepting adds them to the hold as it
is then. Discord keeps what it was posted.

All of it is additive and optional: no table or column is added, and a room with
neither reads as before.

### 9b. An Opposition roll reaches players without its names (r2 B1)

Supersedes §9a for rolls made from the Opposition pane (an NPC's action,
Morale, Reaction, a Critical table, a Heat Check, a wreck's salvage, a fielded
count): players read that the Mediator rolled and what it came to ("Mediator
rolled · 9 · Tough Choice"), never the NPC's or the weapon's name. Table rolls
and the Core Mechanic stay public, and Private rolls still keeps a roll from
the players whole.

Such a roll's `change_log` row keeps the whole line in `description` and
carries `veiled`, the line a player reads in its place. The room serves a
non-Mediator `veiled` as the roll's line (`rollLineFor`, on `changeLog.events`
and `changeLog.rolls`, so the Feed, the toast and "Last session" all get it),
so the names never leave the room for a player's screen; a Mediator is served
the whole line with `veiled: true`. `changeLog.reveal` (a Mediator's) sets
`revealed: true` on the row, after which everyone is served the whole line.
The room drops both fields from any row a non-Mediator appends. The Discord
card of a Mediator's roll names its table and never the NPC.

Additive and optional: two optional keys in a roll row's `after`; a row with
neither reads as before.

**Reveal is the way out of private too (r3 A1).** `changeLog.reveal` takes a
`private` roll as well as a veiled one. A row with `revealed: true` is
neither private nor veiled for anyone: the room serves it whole to every
member on `changeLog.events` and `changeLog.rolls`, marked `revealed`, so the
players' Feed, their toast and "Last session" get it, and the room mirrors
its line to the bound channel once, since a private roll never posted a card
and a veiled one posted without its names. Until then a private roll's line
on the Mediator's Feed says only the Mediator sees it. No key is added.

**A hand over (r3 A2).** The new Mediator reads the earlier private and
veiled rolls in the Mediate Feed, because they now run the Game. A roll
signed "Mediator" whose roller no longer mediates is served to everyone else
under the roller's name ("Previous Mediator" for one with none), never as the
reader's own. A Mediator's own copy of a roll (`private` or `veiled`) is
never toasted, so nothing replays when the role moves. The Hand over dialog
says private rolls go across.

### 10. Phones get tabs, not a second layout

Below `lg` the panes are four tabs at the foot (Act, Units, Tables, Crew; the
Mediator's Table, Opposition, Tables, Propose) under pinned live vitals and
the Situation switch, every control on the 44px touch floor. Only the open
pane scrolls; the closed ones stay mounted. Text is drawn at its own size at
every width, so browser zoom simply narrows the window. Every control at every
width calls the same handler under the same rules.

### 11. Play follows the nesting rules

Play sits in the canon's nesting rules N1–N8 (the entity display
language's E6, with E3 and C5) and their gates. Its own frames place as follows:

1. **Level 0 is the Play canvas**, a dialog or an overlay (N1). What sits
   directly in a column is level 1: a Compact or contentful card, or a unit
   `TitledBox`; what is inside one of those is level 2 (Minis, N4, or
   plain content).
2. **Column headings are plain titles or Slabs** (stamp and leader rule), not
   TitledBoxes, so what a column holds stays at level 1.
3. **A section inside an entity box is a Slab over plain content** (N5): a
   step's "Will apply" list, the resolve steps inside an action's Mini.

## Consequences

- `/build/dashboard/$pilotId` and `/build/mediator/$gameId` redirect into Play.
- A seat has an optional `gameId`, solo Downtime and `lastSeenAt`; the bot has a
  write path to Discord channels.
- Downtime has one surface for players and Mediators.
