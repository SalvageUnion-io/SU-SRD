# Rules & the ITUN Surfaces

> **This document supersedes and absorbs the former "Rules Engine Boundary" doc.**
> The old economic / procedural / hybrid classification is retained below (as the
> _rule-class_ axis) but reorganized under a **mode** axis: a rule's enforcement
> is a function of the **mode** a surface is in, not of the rule alone. The
> filename is unchanged so existing cross-links keep resolving. Formalized in
> [ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md) (surface/mode taxonomy) and
> [ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md) (provenance & overrides).
>
> **Status: target model.** Parts of this describe where we are going, not only
> where the code is today. The gap is tracked explicitly in
> [Implementation status](#implementation-status--target-vs-current). Game terms
> follow the Salvage Union core book; app-coined terms (the mode names, the
> _Dashboard_ surface) are called out as ours.

ITUN is a shared living character sheet, not a game engine. But "the app" is not
one actor — it is a set of surfaces the player moves through, and each surface is
in one of a few **enforcement modes**. How hard the app holds you to a rule
depends on **which mode you are in**, not only on **which rule it is**.

The organizing idea is a border, and the border is **lifecycle transactions** —
the rules _events_ that gate a change behind a cost or a procedure (spend
EP/Heat/AP, spend Scrap/TP, use a system, Push, craft, salvage, repair, upgrade,
run Downtime, advance). Two modes **own and enforce** those transactions and teach
their rules while doing so; one mode deliberately **bypasses** them so a human at
the table can patch reality.

---

## The enforcement modes

| Mode                | Surface(s)                                           | Ethos                                                                                           |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Guided Creation** | Wizard (`/*/new`)                                    | A "how-to guide" for _making_ a legal entity. Enforces creation rules.                          |
| **Free Edit**       | Live Sheet (`/sheet/:kind/:id`)                      | The manual-override console. Edits _state_, never runs _transactions_.                          |
| **Guided Play**     | **Dashboard** (Pilot + Mech + Crawler, live)         | Every asset in-hand + enforced play. Interactive rules-layers that _teach as they enforce_.     |
| **Frozen**          | Share / View (`/share`, `/s/:id`)                    | Read-only published snapshot.                                                                   |
| **Adjudicate**      | Encounter (`/encounter`) → future **Mediator** layer | GM tray — Mediator tables + NPCs. Surfaces rules as tooling; enforces nothing on player sheets. |

`Guided Creation`, `Free Edit`, and `Guided Play` are our terms, not Salvage
Union's. Two of the five are **boundary stances** rather than active enforcement:
_Frozen_ petrifies (it evaluates nothing), and _Adjudicate_ tools the GM side (it
enforces nothing on a player).

A **surface hosts a mode.** The distinction matters because one page can carry
more than one, and because a mode can outlive its current surface:

- The **Dashboard** is a _separate, multi-entity_ surface — it composes a player's
  **Pilot + Mech + Crawler** into one live play surface (distinct from the
  single-entity Live Sheet). It does not exist yet; today the Live Sheet holds the
  leftover Guided-Play controls (Push, using a system) that belong in the Dashboard.
- The **Adjudicate** mode will likewise leave the Encounter surface for a
  dedicated **Mediator layer**. Same pattern: the mode is stable, the surface is
  provisional.

**Which modes the rest of this document is about.** `Guided Creation`, `Free
Edit`, and `Guided Play` act on a player's **own** entity; `Frozen` is the
read-only view of that same entity. Those four are the columns of the matrix
below. **Adjudicate** (Encounter) is the odd one out on purpose: it operates on
_NPC instances and Mediator tables_, not the player's Pilot/Mech/Crawler, so it
sits **outside** the player-entity matrix (its rule class is procedural
adjudication — see below).

Two ethos pairings are load-bearing:

1. **Enforcement and pedagogy travel together.** The Wizard teaches creation _by_
   enforcing it; the Dashboard's interactive layers teach play/Downtime _by_
   enforcing them ("each layer exposes its rules in the display"). Free Edit does
   neither — it is raw manual control, on purpose.
2. **Free Edit edits _state_; the guided modes run _events_.** "Add a system
   without spending Scrap" on the Live Sheet writes the end-state (the system is
   installed) and skips the transaction. The _same_ change done as a transaction
   (pay the Scrap, follow the swap procedure) is a **Dashboard** act. Same
   destination, different door — only the guided door charges admission.

A consequence worth stating up front: because Guided Creation hard-enforces,
building a deliberately **house-ruled** entity is itself a **Free Edit** act —
create the nearest legal entity in the Wizard, then break it on the Live Sheet.
The guided door stays honest; the free door absorbs the exceptions. (This covers
house-ruled _arrangements of existing content_. Authoring genuinely **net-new
homebrew content** — a system or ability that isn't in the dataset — is a
different problem the model does not solve today; see
[Long-tail vision](#long-tail-vision-not-in-scope).)

The root of all of it is [ADR-001](../adrs/ADR-001-local-first-no-backend.md)
(superseded by [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md),
which adds accounts and shared Games but keeps the honour-system stance on
cross-player writes as propose-and-confirm):
local-first, no server game state, so no turn enforcement and an honor system.
The app owns the math and _tools_ adjudication; the table makes the calls.

---

## The rule classes (the WHAT axis)

The former economic / procedural / hybrid boundary is retained, but split into
sharper classes so each can be placed against the modes. (Mapping for continuity:
old **economic** → _lifecycle transactions_ + _quantitative caps_ + _structural
coherence_; old **procedural** → _procedural adjudication_; old **hybrid** → a
_lifecycle transaction with a confirmed destructive consequence_.)

1. **Lifecycle transaction** — a state change the rules gate behind a **cost or
   procedure**. Use a system — take its Action, spending EP/Heat and decrementing
   uses (the code's `activateItem`); Push (spend Heat); the Heat Check **trigger**
   (its Reactor-Overload _consequence_ is a confirmed-destructive case —
   see [below](#confirmed-destructive-consequences-the-old-hybrid)); craft /
   salvage / repair / upgrade / trade (spend Scrap, Tech-Level gated); Downtime
   Actions; Restore (`_used` re-roll flags reset in Downtime); advancement (spend
   earned TP for an ability). **Owned by the guided modes; bypassed in Free Edit.**

2. **Structural coherence** — references must resolve; type/containment must hold
   (a system cannot occupy a **module slot type**; a slug must point at a real
   entity). **Hard in every mode, Free Edit included.** You may house-rule an
   object; you may not make an incoherent one. Note the word "slot" cuts two ways:
   slot **type** is coherence and is hard everywhere; slot **count** is a
   quantitative cap (next class) and is overridable. Same word, opposite fidelity.

3. **Quantitative cap** — slot **counts** (how many, not what type) and derived
   maxima (max HP / SP / EP / AP / Heat / Cargo). Derived in the guided modes.
   **Overridable in Free Edit**, with a visible callout and a retained derived
   baseline (see [ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md)).

4. **Free state** — current pools (Hit Points, Structure Points, Heat, Energy
   Points, Ability Points, Scrap), conditions, and remaining-uses counts.
   **Freely editable in Free Edit.** In Guided Play these move only _through_
   enforced transactions (using a system spends EP/Heat/uses; taking damage runs
   the SP→HP overflow rule).

5. **Procedural adjudication** — turn order, initiative, range bands (Close /
   Medium / Long / Far), narrative consequences, Death Blow declarations,
   exploration supply. **Surfaced, never enforced** (unchanged). This is the rule
   class the **Adjudicate** mode (Encounter) exists to tool, GM-side; player
   surfaces only _apply_ its outcomes.

---

## The matrix — rule class × mode

The utility payload: where any feature lands, and how it behaves. This is the
authoritative placement table for a player's own entity (Pilot / Mech / Crawler);
resolve gray zones _here_.

| Rule class                                                 | Guided Creation (Wizard)  | Free Edit (Live Sheet)                     | Guided Play (Dashboard)                                        | Frozen (Share) |
| ---------------------------------------------------------- | ------------------------- | ------------------------------------------ | -------------------------------------------------------------- | -------------- |
| **Lifecycle transaction**                                  | Enforced (creation costs) | **Bypassed** — edit end-state, no cost     | **Enforced + interactive** (EP/Heat/Scrap/TP; Downtime layers) | frozen         |
| **Structural coherence** (refs, slot _type_)               | Enforced                  | **Hard** — refs resolve, slot-type holds   | Enforced                                                       | frozen         |
| **Quantitative cap** (slot _counts_, maxes)                | Derived / enforced        | **Override w/ callout** (retains baseline) | Derived / enforced                                             | frozen         |
| **Free state** (HP, SP, Heat, EP, AP, Scrap, uses, conds.) | Set by creation           | **Freely editable**                        | Changed _via_ enforced actions                                 | frozen         |
| **Procedural adjudication**                                | —                         | Manual (player applies by hand)            | Surfaced as tooling                                            | frozen         |

Two notes on the columns. The **Frozen** column is uniform by definition — a
published snapshot evaluates nothing. **Adjudicate / Encounter has no column
here** on purpose: it acts on NPC instances, not the player's own entities (see
"[The enforcement modes](#the-enforcement-modes)"). The **procedural-adjudication
row is not a contradiction** of that: the Adjudicate mode owns the GM _tooling_
for running procedural mechanics, while the row shows only how a player's own
surfaces _apply_ their outcomes (by hand in Free Edit; surfaced as reference in
Guided Play). Complementary, not duplicative.

Reading examples:

- **Use a system** (take its Action — spend EP/Heat, decrement uses) → _lifecycle
  transaction_ → **Dashboard only.** The Live Sheet has no such control; it can
  still hand-edit the item's remaining-uses count (that is _free state_, a number
  you set — not an Action).
- **Push / Heat Check** → _lifecycle transaction_ → **Dashboard.** They leave the
  Live Sheet; the Heat Capacity ("Heat Cap") hard-block belongs to Guided Play.
- **Set current Heat to 0, add a Condition, add 50 Scrap** → _free state_ →
  **Free Edit**, no questions asked.
- **Apply Mediator-declared damage** ("take 5 damage") → **split**: the rule-driven
  path (SP→HP overflow, Critical trigger + confirm) is a **Dashboard** transaction;
  raw-setting current SP/HP by hand is a **Free Edit** _free-state_ edit. Same
  outcome, two doors — the enforced one does the overflow math, the free one
  trusts you.
- **Raise max SP above its derived value** → _quantitative cap_ → **Free Edit
  override**, shown with an "overridden from N" callout and revertible.
- **Install a Tech 4 system on a Tech 2 crawler** → as a _transaction_ it is
  Tech-Level-gated in the **Dashboard**; as a _free edit_ you may just place it
  (bypassing the cost) — but the system must still be a real, correctly-typed
  entity (structural coherence holds).
- **Spend earned TP for a new ability** → the legit, enforced path is a **Dashboard**
  Downtime/advancement layer; "add the ability without spending TP" on the Live
  Sheet is that transaction's Free-Edit override.
- **Roll an NPC's Reaction** → _procedural adjudication_ → **Adjudicate**
  (Encounter): the app rolls on the Mediator table as GM tooling and enforces
  nothing on a player. (Outside the player-entity matrix, by design.)

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
Death Blow, and exploration supply are surfaced (Encounter / Dashboard tooling) but
never enforced.

---

## Provenance — the Change Log

Every surface writes to a per-entity, append-only **Change Log** (the provenance
log) — enforced Dashboard transactions _and_ free Live-Sheet edits alike, each
tagged with its provenance (`spent 3 Scrap to install X` vs.
`manual override: Heat → 0`). It records **all** changes, not just overrides, and
the free edits are exactly where it matters most. The Change Log is **viewed
behind a menu, never inline on a sheet** — the sheet shows current state, the
history lives one tap away. Distinct from it is the **overridden-stat indicator**:
a small marker on a currently-pinned stat, shown **on the Live Sheet only**.

To make "every mutation is logged" a **structural guarantee** rather than a
per-call-site discipline, the log entry is emitted at the **single write-through
chokepoint** every surface already routes through — `entityStore.update`
([ADR-003](../adrs/ADR-003-zustand-hydration.md)) — not scattered across
components. A surface that bypasses the store to mutate an entity is then the
visible anti-pattern, not a silent gap.

The log is designed to be **replayable** (event-shaped, ordered) though a
replay/time-travel surface is not built yet, and it **stays local** — a published
snapshot remains a frozen point-in-time entity with no history. Full decision in
[ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md).

---

## Implementation status — target vs. current

This doc is the target. Where the code stands today:

- **Wizard** enforces Guided Creation **hard** on the create path
  (`PilotWizard.tsx`, `MechWizard.tsx`, `CrawlerBuilder.tsx`): illegal options are
  filtered out rather than rendered, `Next` is gated by the step gates in
  `lib/rules/creation.ts` with the unmet requirement in the footer note,
  cross-step invalidation and draft-restore clamping are announced by toast, and
  the advisory `Banner` is removed from the create flow — nothing can be in
  violation. The deliberate exit is `OffRulesEscape` (leave the wizard for the
  blank Free-Edit path). **Edit** mode keeps the soft regime: presence-only gates,
  lifted filters/budgets, advisory warnings on Review.
- **Dashboard** is **built** at `/dashboard/$id` (`src/components/dashboard/`,
  Phases 1–7; design: [dashboard.md](dashboard.md), decision:
  [ADR-015](../adrs/ADR-015-dashboard-distinct-play-surface.md)), composing
  Pilot + Mech + Crawler with its lifecycle-transaction layers (use a system,
  Push, Downtime, take damage). The working title "Play Cockpit" and the
  `components/play/` directory are gone.
- **Live Sheet** is pure Free Edit — Push / Heat Check / `activateItem` no longer
  live there (`SheetMech.tsx`), and cap **overrides** with the derived-baseline
  callout and one-click revert are built.
- **Provenance log** is **built** (ADR-022): the `changeLog` store
  (`lib/db/changeLog.ts`, schema in `lib/schemas/changeLog.ts`) is written at the
  `entityStore.update` chokepoint, tagged `transaction` / `override` / `manual`,
  and read through `ChangeLogDrawer` behind the sheet menu. Replay/time-travel is
  still unbuilt. Of the rules primitives in `lib/rules`, `downtime` and
  `takeDamage` are wired into the Dashboard; `salvage`, `crafting`, and
  `scrapMech` are built and tested but still unwired — raw material for further
  Dashboard layers.

When any of these moves, update the corresponding bullet (and, if a border moves,
the matrix above) rather than leaving the gap undocumented.

---

## Long-tail vision (not in scope)

Recorded so it isn't lost, explicitly **not** something we build toward now:

- **Shared, live Dashboard.** The single-player Dashboard (Pilot + Mech + Crawler)
  eventually goes **multiplayer** — several players on the same Dashboard at once,
  **synchronized with a Mediator live**. That needs auth + a backend, which the
  original local-first stance ([ADR-001](../adrs/ADR-001-local-first-no-backend.md))
  ruled out. ADR-001 has since been superseded by
  [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md) (accounts, Games,
  a server of record), so the gate is no longer ADR-001 — it is ADR-030's phased
  delivery, hand-in-hand with Game spaces and the Mediator layer below.
- **Workspaces → "Game spaces."** Today's local-only `workspaces` become shared
  Game spaces where entities are **owned by you vs. owned by others** (cross-user
  Pilots, Mechs, Crawlers). The multi-user direction deferred by local-first; the
  mode model still holds under it (ownership scopes _who_ may edit; it does not
  change _what_ each mode enforces).
- **A dedicated Mediator layer.** The **Adjudicate** mode eventually moves off the
  Encounter surface into a purpose-built **Mediator layer** — the GM-facing home
  for encounters, Mediator tables, and NPC control (the same "mode outlives its
  surface" move as Guided Play → Dashboard, applied to the GM side). The taxonomy
  already accounts for it, so no reclassification is needed when it lands.
- **Net-new homebrew content authoring.** A path for players to author systems,
  abilities, and other content that isn't in `salvageunion-reference` (which
  Free Edit cannot express — an unresolved ref is incoherent by definition). A
  future authoring surface feeding the dataset, not a Free-Edit affordance.

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
  system that makes Free Edit legitimate. Superseded by
  [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md), which keeps that
  honour system as propose-and-confirm.
- [ADR-003](../adrs/ADR-003-zustand-hydration.md) — the `entityStore` write-through
  path the provenance log hooks into.
- [ADR-006](../adrs/ADR-006-pure-rules-logic.md) — rules as pure functions; the
  shared math every mode consumes.
- [ADR-007](../adrs/ADR-007-automation-boundary.md) — confirm-before-destructive
  within Guided Play; permits deliberate player edits in Free Edit.
- [ADR-008](../adrs/ADR-008-sequential-mutations.md) — the write-through
  mechanism behind a lifecycle transaction (its home moves to the Dashboard).
- [ADR-010](../adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md) — the
  persistence-agnostic display contract (Frozen is its read-only end).
- [ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md) — surface/mode taxonomy
  (governing).
- [ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md) — provenance log &
  stat overrides.
- [ADR-015](../adrs/ADR-015-dashboard-distinct-play-surface.md) — the Dashboard as
  the distinct Guided-Play surface (design in [dashboard.md](dashboard.md); sub-decisions
  ADR-016–020).
- [combat-loop.md](combat-loop.md) — the current (Sheet-hosted) resource loop;
  migrates to the Dashboard under this model.
- [data-flow.md](data-flow.md) — how state is stored and hydrated.
