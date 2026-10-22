# ADR-052: Build Owns Your Assets; Play Owns Games and the Dashboards

Decided and built: the `build-play-split` milestone (tracker #1666). The area names (Build is the
Training Bay, Play is The Cantina) are [ADR-051](051-play-mode.md) §1.

- **Amends** [ADR-030](030-accounts-games-server-of-record.md) §6 and its
  invites: a Game's page and joining a Game move into Play.
- **Amends** [ADR-051](051-play-mode.md) §1: the Play landing grows into the
  hub (§4 below).

### 1. Build owns your assets

Build manages everything the player owns, in a Game or not. A unit's Game is a
detail it shows, never a place inside Build: Build has no Game page, no
New Game and no Games ▾. On a Hangar Row the Game is a relation chip,
`GAME | name`, linking to that Game's page in Play; a unit in no Game leaves the
lane empty. The Hangar's Showing filter is a Select: Everything, Not in a Game,
then one entry per Game.

### 2. Build lists only what you own

Unassigned units, and a Game's units you do not own, appear only on that Game's
page in Play.

### 3. Asset actions stay in Build

Move to a Game… and Move to your Hangar stay on the Hangar Row and the sheet,
beside the Game chip. Wizards, sheets, Patterns, the Starter Set, Import and
Export stay. Units are made only in Build's wizards: a wizard started from a
Game's page preselects that Game (`?game=<id>`) and returns there; any other
lands the new unit in the Hangar. There is no active container: a unit's Game
comes from the unit, or from `?game=`.

### 4. Play owns Games and the dashboards

Play is the hub for Games and play. The hub (`/build/play`) lists Your Games
and offers New Game, Join, Solo and each Game's Discord channel. Play also
holds each Game's page, the invite screen (joining lands on the Game's page)
and every dashboard: the player Cockpit, the solo Cockpit and the Mediator's.

### 5. A Game's page

At `/build/play/games/$gameId`; `/build/games/$gameId` redirects there. It holds
the roster, crew and seats, proposals, the invite link, the Mediator and the
Game's settings. It stays a management page, separate from the Mediator's live
Cockpit; both Cockpits link to it from ⋯. Add from your Hangar is a
single-choice picker: one unit per add.

### 6. Navigation

The header switch keeps its verbs, Reference | Build | Play; the area names go
on the pages. In Play's nav, Games ▾ is current on the hub and any Game route, and Solo is
an anchor on the hub. The Play bar's back goes to the Game's page (solo: the
hub).

### 7. Manage, not Cockpit

The Play hub, a Game's page, the Hangar and the invite screen are the Manage
context ([ruleset](../design-system/ruleset.md) §1.9): paper under the area's
band. Brand-colour grounds carry the speckle everywhere (ruleset §3.5.1).

### 8. The code follows the areas

`apps/web/src` groups into `reference/`, `build/` and `play/`, the shared
library in `components/`; routes are unchanged, and the shared rules package is
`game-domain`. The `/build` base stays.

## Consequences

- `/build/games/$gameId` redirects to the Game's page in Play.
- A new unit's Game is the unit's or the wizard link's; nothing remembers a
  current container.
- Every Game action lives in Play and every asset action in Build; nothing a
  player can do is lost.
