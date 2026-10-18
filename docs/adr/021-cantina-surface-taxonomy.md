# ADR-021: The Cantina Surface Taxonomy — Enforcement Modes & Rule Placement

**A rule's enforcement is a function of the surface's mode, not of the rule
alone.** The border between modes is the **lifecycle transaction**: a state
change the rules gate behind a cost or procedure. Where it conflicts with an
earlier ADR on how hard a rule is enforced where, this one wins. The live
placement table is [surfaces](../ARCHITECTURE.md#surfaces).

| Mode                | Surface(s)                                | Stance                                                               |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| **Guided Creation** | Wizard                                    | Enforce creation rules; a how-to guide for making a legal entity.    |
| **Free Edit**       | Live Sheet                                | No lifecycle enforcement. Edit end-state directly; override caps.    |
| **Guided Play**     | Dashboard (Pilot + Mech + Crawler, live)  | Enforce play; interactive rules layers that teach as they enforce.   |
| **Frozen**          | Public sheet (`/p/`), a crewmate's sheet  | Read-only, live.                                                     |
| **Adjudicate**      | Mediator Dashboard (`/mediator/$gameId`)  | Mediator tooling; surfaces rules, enforces nothing on player sheets. |

**Rule placement:**

- **Lifecycle transactions** (use a system → EP/Heat/uses, Push, Scrap/TP
  costs, Downtime, craft, salvage, repair, upgrade, advancement): enforced and
  interactive in the guided modes, bypassed in Free Edit. Using a system is a
  Dashboard act; the Live Sheet may still hand-edit a uses count.
- **Structural coherence** (refs resolve, type and containment): hard in every
  mode. House-ruled arrangements of existing content are allowed; authoring
  net-new homebrew content is out of scope.
- **Quantitative caps** (slot counts, derived maxima): derived in guided modes,
  overridable in Free Edit with a callout and a retained baseline.
- **Free state** (HP/SP/Heat/EP/AP/Scrap, conditions, uses): freely editable in
  Free Edit; moved only by enforced actions in Guided Play (Mediator-declared
  damage's SP→HP overflow is a Dashboard transaction).
- **Procedural adjudication**: surfaced, never enforced.

Classify both axes (mode and rule class) before building any rules feature.
The Live Sheet is deliberately the least-enforced surface: wanting a hard block
there beyond structural coherence is a proposal to change this ADR, not a bug.
[ADR-007](007-automation-boundary.md) governs Guided Play within it.
