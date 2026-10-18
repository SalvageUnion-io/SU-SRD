# ADR-021: The App Surface Taxonomy — Enforcement Modes & Rule Placement

**A rule's enforcement is a function of the surface's mode, not of the rule
alone.** The border between modes is the **lifecycle transaction**: a state
change the rules gate behind a cost or procedure. Where it conflicts with an
earlier ADR on how hard a rule is enforced where, this one wins. The live
placement table is [surfaces](../ARCHITECTURE.md#surfaces). Amended by
[ADR-051](051-play-mode.md): Play is the surface of Guided Play and Adjudicate.

| Mode                | Surface(s)                                    | Stance                                                               |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| **Guided Creation** | Wizard                                        | Enforce creation rules; a how-to guide for making a legal entity.    |
| **Free Edit**       | Live Sheet                                    | No lifecycle enforcement. Edit end-state directly; override caps.    |
| **Guided Play**     | Play (Pilot + Mech + Crawler, live)           | Enforce play; interactive rules layers that teach as they enforce.   |
| **Frozen**          | Public sheet (`/p/`), a crewmate's sheet      | Read-only, live.                                                     |
| **Adjudicate**      | Play's Mediator screen (`/play/game/$gameId`) | Mediator tooling; surfaces rules, enforces nothing on player sheets. |

**Rule placement:**

- **Lifecycle transactions** (use a system → EP/Heat/uses, Push, Scrap/TP
  costs, Downtime, craft, salvage, repair, upgrade, advancement): enforced and
  interactive in the guided modes, bypassed in Free Edit. Using a system is a
  Play act; the Live Sheet may still hand-edit a uses count.
- **Structural coherence** (refs resolve, type and containment): hard in every
  mode. House-ruled arrangements of existing content are allowed; authoring
  net-new homebrew content is out of scope.
- **Quantitative caps** (slot counts, derived maxima): derived in guided modes,
  overridable in Free Edit with a callout and a retained baseline.
- **Free state** (HP/SP/Heat/EP/AP/Scrap, conditions, uses): freely editable in
  Free Edit; moved only by enforced actions in Guided Play (Mediator-declared
  damage's SP→HP overflow is a Play transaction).
- **Procedural adjudication**: surfaced, never enforced.

Play composes a player's Pilot + Mech + Crawler into one live surface at
`/play/$pilotId`, and the Mediator's at `/play/game/$gameId`
(`src/play/`; [play.md](../architecture/play.md)).

Classify both axes (mode and rule class) before building any rules feature.
The Live Sheet is deliberately the least-enforced surface: wanting a hard block
there beyond structural coherence is a proposal to change this ADR, not a bug.
[ADR-007](007-automation-boundary.md) governs Guided Play within it.
