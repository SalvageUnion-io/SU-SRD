# Rules & the ITUN Surfaces

> **This document supersedes and absorbs the former "Rules Engine Boundary" doc.**
> The old economic / procedural / hybrid classification is retained below (as the
> _rule-class_ axis) but reorganized under a **mode** axis: a rule's enforcement
> is a function of the **mode** a surface is in, not of the rule alone. The
> filename is unchanged so existing cross-links keep resolving. Formalized in
> [ADR-015](../adrs/ADR-015-itun-surface-taxonomy.md) (surface/mode taxonomy) and
> [ADR-016](../adrs/ADR-016-provenance-log-and-overrides.md) (provenance & overrides).
>
> **Status: target model.** Parts of this describe where we are going, not only
> where the code is today. The gap is tracked explicitly in
> [Implementation status](#implementation-status--target-vs-current).

ITUN is a shared living character sheet, not a game engine. But "the app" is not
one actor — it is a set of surfaces the player moves through, and each surface is
in one of a few **enforcement modes**. How hard the app holds you to a rule
depends on **which mode you are in**, not only on **which rule it is**.

The organizing idea is a border, and the border is **lifecycle transactions** —
the rules _events_ that gate a change behind a cost or a procedure (spend EP/heat,
spend scrap/TP, activate a system, Push, craft, salvage, repair, upgrade, run
downtime, advance). Two modes **own and enforce** those transactions and teach
their rules while doing so; one mode deliberately **bypasses** them so a human at
the table can patch reality.

---

## The enforcement modes

| Mode                | Surface(s)                                           | Ethos                                                                                           |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Guided Creation** | Wizard (`/*/new`)                                    | A "how-to guide" for _making_ a legal entity. Enforces creation rules.                          |
| **Free Edit**       | Live Sheet (`/sheet/:kind/:id`)                      | The manual-override console. Edits _state_, never runs _transactions_.                          |
| **Guided Play**     | Cockpit (in the Sheet today)                         | Every asset in-hand + enforced play. Interactive rules-layers that _teach as they enforce_.     |
| **Frozen**          | Share / View (`/share`, `/s/:id`)                    | Read-only published snapshot.                                                                   |
| **Adjudicate**      | Encounter (`/encounter`) → future **Mediator** layer | GM tray — Mediator tables + NPCs. Surfaces rules as tooling; enforces nothing on player sheets. |

A **surface hosts a mode.** The distinction matters because one page can carry
more than one: the live sheet is a **Free Edit** surface today, but it still holds
leftover **Guided Play** controls (Push, activation) that belong in a Cockpit. The
mode names the stance; the surface is just where it currently lives.

**Which modes the rest of this document is about.** _Guided Creation_, _Free
Edit_, and _Guided Play_ act on a player's **own** entity; _Frozen_ is the
read-only view of that same entity. Those four are the columns of the matrix
below. **Adjudicate** (Encounter) is the odd one out on purpose: it operates on
_NPC instances and Mediator tables_, not the player's pilot/mech/crawler, so it
enforces nothing on a player sheet and sits **outside** the player-entity matrix
entirely (its concern is procedural adjudication — see that rule class). Just as
Guided Play is destined to leave the Sheet for a Cockpit, the **Adjudicate** mode
is destined to leave the Encounter surface for a dedicated **Mediator layer** —
the eventual GM-facing home for encounters, Mediator tables, and NPCs. A future
direction, not a priority yet (see [Long-tail vision](#long-tail-vision-not-in-scope)).

Two ethos pairings are load-bearing:

1. **Enforcement and pedagogy travel together.** The Wizard teaches creation _by_
   enforcing it; the Cockpit's interactive layers teach play/downtime _by_
   enforcing them ("each layer exposes its rules in the display"). Free Edit does
   neither — it is raw manual control, on purpose.
2. **Free Edit edits _state_; the guided modes run _events_.** "Add a system
   without spending scrap" on the Live Sheet writes the end-state (the system is
   installed) and skips the transaction. The _same_ change done as a transaction
   (pay the scrap, follow the swap procedure) is a **Cockpit** act. Same
   destination, different door — only the guided door charges admission.

A consequence worth stating up front: because Guided Creation hard-enforces,
building a deliberately **homebrew or off-rules** entity is itself a **Free Edit**
act — create the nearest legal entity in the Wizard, then break it on the Live
Sheet. The guided door stays honest; the free door absorbs the exceptions. (There
is no "illegal build" path _inside_ the Wizard; that is the point of the split.)

The root of all of it is [ADR-001](../adrs/ADR-001-local-first-no-backend.md):
local-first, no server game state, so no turn enforcement and an honor system.
The app owns the math; the table owns adjudication.

---

## The rule classes (the WHAT axis)

The former economic / procedural / hybrid boundary is retained, but split into
sharper classes so each can be placed against the modes. (Mapping for continuity:
old **economic** → _lifecycle transactions_ + _quantitative caps_ + _structural
coherence_; old **procedural** → _procedural adjudication_; old **hybrid** → a
_lifecycle transaction with a confirmed destructive consequence_.)

1. **Lifecycle transaction** — a state change the rules gate behind a **cost or
   procedure**. Activate a system (spend EP/heat, decrement uses); Push (spend
   heat); the Heat Check **trigger** (its Reactor-Overload _consequence_ is
   handled separately as a confirmed-destructive case —
   see [below](#confirmed-destructive-consequences-the-old-hybrid)); craft /
   salvage / repair / upgrade / trade (spend scrap, tech-level gated); downtime
   steps; Restore (`_used` resets); advancement (spend earned TP for an ability).
   **Owned by the guided modes; bypassed in Free Edit.**

2. **Structural coherence** — references must resolve; type/containment must hold
   (a system cannot occupy a **module slot type**; a slug must point at a real
   entity). **Hard in every mode, Free Edit included.** You may house-rule an
   object; you may not make an incoherent one. Note the word "slot" cuts two ways:
   slot **type** is coherence and is hard everywhere; slot **count** is a
   quantitative cap (next class) and is overridable. Same word, opposite fidelity.

3. **Quantitative cap** — slot **counts** (how many, not what type) and derived
   maxima (max HP / SP / EP / Heat / Cargo). Derived in the guided modes.
   **Overridable in Free Edit**, with a visible callout and a retained derived
   baseline (see [ADR-016](../adrs/ADR-016-provenance-log-and-overrides.md)).

4. **Free state** — current pools (HP / SP / heat / EP / scrap), conditions, and
   remaining-uses counts. **Freely editable in Free Edit.** In Guided Play these
   move only _through_ enforced transactions (activation spends EP/heat/uses).

5. **Procedural adjudication** — turn order, initiative, range bands, narrative
   consequences, Death Blow declarations, exploration supply. **Surfaced, never
   enforced** (unchanged). This is the rule class the **Adjudicate** mode
   (Encounter) is built for, and the Cockpit surfaces it as tooling too.

---

## The matrix — rule class × mode

The utility payload: where any feature lands, and how it behaves. This is the
authoritative placement table for a player's own entity (pilot / mech / crawler);
resolve gray zones _here_.

| Rule class                                         | Guided Creation (Wizard)  | Free Edit (Live Sheet)                     | Guided Play (Cockpit)                                          | Frozen (Share) |
| -------------------------------------------------- | ------------------------- | ------------------------------------------ | -------------------------------------------------------------- | -------------- |
| **Lifecycle transaction**                          | Enforced (creation costs) | **Bypassed** — edit end-state, no cost     | **Enforced + interactive** (EP/heat/scrap/TP; Downtime layers) | frozen         |
| **Structural coherence** (refs, slot _type_)       | Enforced                  | **Hard** — refs resolve, slot-type holds   | Enforced                                                       | frozen         |
| **Quantitative cap** (slot _counts_, maxes)        | Derived / enforced        | **Override w/ callout** (retains baseline) | Derived / enforced                                             | frozen         |
| **Free state** (HP, heat, scrap, uses, conditions) | Set by creation           | **Freely editable**                        | Changed _via_ enforced actions                                 | frozen         |
| **Procedural adjudication**                        | —                         | Manual (player edits by hand)              | Surfaced as tooling                                            | frozen         |

Two notes on the columns. The **Frozen** column is uniform by definition — a
published snapshot evaluates nothing. **Adjudicate / Encounter has no column
here** on purpose: it acts on NPC instances, not the player's own entities (see
"[The enforcement modes](#the-enforcement-modes)"); procedural adjudication is its
whole job and it enforces nothing on a player sheet.

Reading examples:

- **Activate a system** (spend EP/heat, decrement uses) → _lifecycle transaction_
  → **Cockpit only.** The Live Sheet has no Activate button; it can still
  hand-edit the item's remaining-uses count (that is _free state_, a number you
  set — not an activation).
- **Push / Heat Check** → _lifecycle transaction_ → **Cockpit.** They leave the
  Live Sheet; the heat-cap hard-block belongs to Guided Play.
- **Set current heat to 0, add a Condition, add 50 scrap** → _free state_ →
  **Free Edit**, no questions asked.
- **Raise max SP above its derived value** → _quantitative cap_ → **Free Edit
  override**, shown with an "overridden from N" callout and revertible.
- **Install a Tech 4 system on a Tech 2 crawler** → as a _transaction_ it is
  tech-level-gated in the **Cockpit**; as a _free edit_ you may just place it
  (bypassing the cost) — but the system must still be a real, correctly-typed
  entity (structural coherence holds).
- **Spend earned TP for a new ability** → the legit, enforced path is a **Cockpit**
  downtime/advancement layer; "add the ability without spending TP" on the Live
  Sheet is that transaction's Free-Edit override.

---

## Confirmed destructive consequences (the old "hybrid")

Within Guided Play, a lifecycle transaction whose consequence is _destructive and
irreversible_ still splits per [ADR-007](../adrs/ADR-007-automation-boundary.md):
the trigger auto-fires (deterministic threshold), the non-destructive bookkeeping
auto-applies, and any condition change or equipment destruction requires explicit
player **confirmation** before it is written. Reactor Overload, the Critical Damage
table at 0 SP, and catastrophic meltdown are the canonical cases. On the **Free
Edit** surface these same states are reached by hand (the player simply sets a
Condition) — which ADR-007 permits, because it forbids _automatic_ mutation, not
deliberate player editing.

Procedural adjudication is unchanged from the prior boundary and remains
Mediator-owned: action economy, initiative, range bands, narrative consequences,
Death Blow, and exploration supply are surfaced (Encounter/Cockpit tooling) but
never enforced.

---

## Provenance

Every surface writes to a per-entity, append-only **provenance log** — enforced
Cockpit transactions _and_ free Live-Sheet edits alike, each tagged with its
provenance (`spent 3 scrap to install X` vs. `manual override: heat → 0`). The
free edits are exactly where provenance matters most.

To make "every mutation is logged" a **structural guarantee** rather than a
per-call-site discipline, the log entry is emitted at the **single write-through
chokepoint** every surface already routes through — `entityStore.update`
([ADR-003](../adrs/ADR-003-zustand-hydration.md)) — not scattered across
components. A surface that bypasses the store to mutate an entity is then the
visible anti-pattern, not a silent gap.

The log is designed to be **replayable** (event-shaped, ordered) though a
replay/time-travel surface is not built yet, and it **stays local** — a published
snapshot remains a frozen point-in-time entity with no history. Full decision in
[ADR-016](../adrs/ADR-016-provenance-log-and-overrides.md).

---

## Implementation status — target vs. current

This doc is the target. Where the code differs today:

- **Wizard** currently _soft-guides_ (advisory `SoftWarningBanner`, never blocks —
  `PilotWizard.tsx:96–97`). The target is enforced Guided Creation. This is a
  planned move from soft → hard.
- **Cockpit** does not exist as its own surface. Guided-Play controls (Push /
  Heat Check via `SheetMech.tsx`, activation via `activateItem` /
  [ADR-008](../adrs/ADR-008-sequential-mutations.md)) currently live **inside the
  Live Sheet**. The target moves every lifecycle transaction — activation, Push,
  crafting, salvage, downtime, advancement — into the Cockpit as interactive
  rules-layers, and leaves the Live Sheet as pure Free Edit.
- **Live Sheet** today mixes free editing with those leftover enforced controls.
  The target strips the transactions out and adds cap **overrides** (with the
  derived-baseline callout), which are not yet built.
- **Provenance log** is not yet implemented; ADR-016 records the decision ahead of
  the build. Several rules primitives (`salvage`, `crafting`, `downtime`,
  `scrapMech`, `takeDamage`) are built and tested in `lib/rules` but unwired —
  they are the raw material for the Cockpit's layers.

When any of these lands, update the corresponding bullet (and, if a border moves,
the matrix above) rather than leaving the gap undocumented.

---

## Long-tail vision (not in scope)

Recorded so it isn't lost, explicitly **not** something we build toward now:

- **Workspaces → "Game spaces."** Today's local-only `workspaces` become shared
  Game spaces where entities are **owned by you vs. owned by others** (cross-user
  pilots, mechs, crawlers). This is the multi-user direction deferred by the
  local-first stance — it needs auth and a backend that
  [ADR-001](../adrs/ADR-001-local-first-no-backend.md) currently rules out, so it
  is a long-tail vision gated on revisiting ADR-001, not a roadmap item. The mode
  model above still holds under it (ownership scopes _who_ may edit; it does not
  change _what_ each mode enforces).
- **A dedicated Mediator layer.** The **Adjudicate** mode eventually moves off the
  Encounter surface into a purpose-built **Mediator layer** — the GM-facing home
  for encounters, Mediator tables, and NPC control. Same mode, better surface (the
  Guided Play → Cockpit move, applied to the GM side). Not a priority yet; the
  taxonomy already accounts for it, so no reclassification is needed when it lands.

---

## Implications for future development

When a feature touches a game rule, place it **twice** before writing code:

1. **Which mode?** Guided Creation / Guided Play (enforce + teach) vs. Free Edit
   (bypass, override) vs. Frozen (read-only) vs. Adjudicate (GM tooling on NPC
   instances, not player entities). → sets the enforcement stance.
2. **Which rule class?** Lifecycle transaction / structural coherence /
   quantitative cap / free state / procedural. → sets what the stance does.

The cell where they meet in the matrix above _is_ the behavior (for procedural
adjudication and anything NPC-facing, the answer is the Adjudicate mode, which is
tooling, not enforcement). If a mechanic's mode or class is ambiguous, resolve it
in this document — with rationale — before implementation. Decisions live here,
not in code comments.

---

## Cross-references

- [ADR-001](../adrs/ADR-001-local-first-no-backend.md) — local-first; the honor
  system that makes Free Edit legitimate.
- [ADR-003](../adrs/ADR-003-zustand-hydration.md) — the `entityStore` write-through
  path the provenance log hooks into.
- [ADR-006](../adrs/ADR-006-pure-rules-logic.md) — rules as pure functions; the
  shared math every mode consumes.
- [ADR-007](../adrs/ADR-007-automation-boundary.md) — confirm-before-destructive
  within Guided Play; permits deliberate player edits in Free Edit.
- [ADR-008](../adrs/ADR-008-sequential-mutations.md) — the write-through
  mechanism behind a lifecycle transaction (its home moves to the Cockpit).
- [ADR-010](../adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md) — the
  persistence-agnostic display contract (Frozen is its read-only end).
- [ADR-015](../adrs/ADR-015-itun-surface-taxonomy.md) — surface/mode taxonomy.
- [ADR-016](../adrs/ADR-016-provenance-log-and-overrides.md) — provenance log &
  stat overrides.
- [combat-loop.md](combat-loop.md) — the current (Sheet-hosted) resource loop;
  migrates to Guided Play under this model.
- [data-flow.md](data-flow.md) — how state is stored and hydrated.
