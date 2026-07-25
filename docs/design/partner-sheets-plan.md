# Partner Sheets — research, options, and a recommended plan

**Status:** proposal. Nothing here is built.
**Scope:** a new add-on sheet kind for statted Drones / Companions ("Partners")
that are granted to a **pilot or a mech**, are linkable and clickable, appear on
entity rows, participate in cargo loading/unloading, and deliberately get **no
index route**.

---

## 1. What is actually true in the codebase today

The premise for this work was that "the Eldridge Coast data has several 'drone'
datasets mistaken as mechs." That was true once; it is no longer true of the seed
data, and the distinction matters for scoping.

- `apps/itun/src/lib/eldridgeCoast/eldridgeCoast.ts` seeds **six mechs, all with
  real chassis refs** (`atlas`, `solo`, `brawler`, `solo`, `goliath`,
  `mirrorball`). No mech record is a disguised drone.
- The four companions — **Custos** and **Incitatus** (Caligula), **PR-1**
  (Gersin), **Rek Jet** (Roach-Boy) — were already re-modelled off mechs and onto
  the owning pilot as ability-granted equipment under
  [ADR-023](../adrs/ADR-023-drone-equipment-installed-loadout.md).

> **Worth checking before anything else.** Seed data does not retro-fix a
> workspace that was already seeded. If drones still render as mechs in the
> running app, that is stale **local IndexedDB** from before the ADR-023
> correction, not a data-file bug.

So the real problem is not mis-typed records. It is that partners are modelled in
**two unrelated half-measures** — one on the pilot side, one on the mech side —
and neither can carry a partner as a thing you can look at, link to, or load
cargo onto.

### 1.1 The pilot side: ADR-023 has run out of room

1. **Two of the same partner collapse into one.** `equipmentLoadouts` is keyed by
   equipment _slug_. ADR-023 names this an accepted limitation; it is now a live
   bug, because **Mecha Packmaster grants two Mecha Companions**, which would
   share a single loadout, name, and condition set.
2. **A partner is not an entity** — cannot be linked, rowed, or navigated to.
3. **No cargo.** Partners have real `cargoCapacity`.
4. **No live state** — current SP, heat, and conditions have nowhere to live.
5. **Identity is free text** in `equipmentChoices`.

### 1.2 The mech side: partners are dropped on the floor entirely

**ITUN's `mech.ts` and `pattern.ts` have no drone field at all.** The reference
package models pattern drones (`PatternDroneConfigSchema`) and `component-lib`
resolves them for SRD display (`resolvePatternDrone`, `resolveChassisDrone` in
`resolveNestedEntities.ts`) — but nothing carries into a player's build. **Build a
Little Sestra in ITUN today and its Sestra Drone silently vanishes.** This is the
concrete gap behind "some partners belong to mechs."

---

## 2. The rules

### 2.1 A Partner is a mech-shaped stat block, wherever it lives

The discriminator is structural and already in the data: a Partner is an entity
carrying **`systemSlots`/`moduleSlots` plus energy and heat** — the mech shape.
It is _not_ a schema: partners live in **two** files.

**Pilot-granted (in `equipment.json`) — granted by a pilot ability's `grants`:**

| Partner             | Granted by                                 |  TL |  SP |  EP | Heat | Sys | Mod | Cargo | Traits             |
| ------------------- | ------------------------------------------ | --: | --: | --: | ---: | --: | --: | ----: | ------------------ |
| **Auto-Turret**     | Auto-Turret                                |   1 |  15 |  10 |   10 |  15 |   4 |     0 | Immobile, Portable |
| **Survey Drone**    | Survey Drone                               |   1 |   2 |   4 |    2 |   3 |   1 |     1 | Hover              |
| **Mecha Companion** | Mecha Companion; **Mecha Packmaster (×2)** |   1 |  12 |   5 |    8 |  12 |   2 |     3 | —                  |

**Mech-granted (in `drones.json`) — granted by a chassis ability:**

| Partner               | Granted by                                                    |  TL |  SP |  EP | Heat | Sys | Mod | Cargo |
| --------------------- | ------------------------------------------------------------- | --: | --: | --: | ---: | --: | --: | ----: |
| **Sestra Drone**      | **Little Sestra** chassis → `Sestra Drone Controller`         |   3 |   7 |   8 |    6 |   7 |   2 |     3 |
| **Big Brother Drone** | **Big Brother** chassis → `Big Brother Drone Controller` (×4) |   5 |   3 |   4 |    4 |   4 |   1 |     2 |

The TL column is the **base** value. How it grows differs sharply by grant path —
see §2.5, which is where the rulebook corrected this plan's first draft.

### 2.2 The grant edges, fully mapped

Three distinct mechanisms produce a partner. All three already exist in data:

1. **Pilot ability → equipment.** `ability.grants[] → equipment.json` entry with
   slots. Predicate: `isLoadoutHost()` in
   `apps/itun/src/components/sheet/pilotInventory.ts`.
2. **Chassis ability → drone.** `chassis.chassisAbilities[]` names an entry in
   `actions.json` carrying a **`drone` field**. Exactly two such edges exist:
   `Sestra Drone Controller → Sestra Drone` and
   `Big Brother Drone Controller → Big Brother Drone`. Already traversed by
   `resolveChassisDrone`.
3. **Pattern → starting loadout.** `pattern.drones[]`
   (`PatternDroneConfigSchema`: `name`, `systems[]`, `modules[]`) supplies each
   granted partner's **instance name and starting loadout**. Little Sestra's
   three patterns each ship one Sestra Drone; Big Brother's DronTek pattern ships
   **four**, individually named and kitted.

### 2.3 What is _not_ a Partner

- **The other twelve `drones.json` entries** (Defacer, Salvo, Combat, Walker,
  Pest, Hover, Needle, TDA Steelcap, TDA Silverback, the standalone Survey Drone,
  The Iron Lady) carry **structure points only** — no EP, no heat, no slots.
  These are opposition stat blocks. Note the trap: "Survey Drone" exists in
  _both_ files with different meanings and different stats.
- **Granted equipment without a stat block** — **Holo Companion** (explicitly
  cannot interact physically with the world) and **Knife Missile** read as
  companions in prose but must stay ordinary equipment. Fourteen abilities use
  `grants`; only three host a loadout.

### 2.4 What the rules say a Partner does

**Confirmed against the Core Book (Digital Edition 2.0a), not just the dataset.**
The same formula is stated four independent times — Auto-Turret (p. 29), Survey
Drone (p. 48), Mecha Companion (p. 68), Sestra Drone (p. 128):

> \[It] uses the same rules as Mechs for attaching Systems and Modules; taking
> damage and being repaired; as well as Heat and Heat Checks. **Your \[partner]
> cannot Push.**

> The Sestra Drone acts separately to the Little Sestra on its own turn, and is
> controlled by the Pilot. It functions effectively as a Mech, but cannot Push. It
> can be installed with Systems and Modules and restores its SP and EP in a T3 or
> higher Mech Bay during Downtime. If the Drone is damaged it can be repaired as
> though it was a Mech. If it is destroyed you may craft a new Sestra Drone for
> 2 Tech 3 Scrap. **The Little Sestra may have one active Sestra Drone at a time.**

Five load-bearing consequences, each verified in the book:

1. **Own turn.** "It acts independently of you, and has its own turn in the round."
2. **Mech-shaped minus Push.** Systems/modules, damage/repair, heat and heat
   checks all use the mech rules; **Push is the one explicit carve-out.**
3. **Repair and refit through mech channels** — restores SP/EP in a Mech Bay
   during Downtime.
4. **Replaceable when lost.** Equipment partners: "you can acquire a new one
   during Downtime." Sestra: craft for 2 Tech 3 Scrap.
5. **A hard per-host cap**, stated individually for each partner (§2.6).

### 2.5 Two different Tech Level rules — one per grant path

This is the sharpest correction the rulebook made to the first draft of this
plan, which assumed a partner tracks its host's tech level. It does not.

**Pilot-granted partners scale off the Union Crawler, not the pilot:**

> Your Auto-Turret has a Tech Level equal to your **Union Crawler**. Your
> Auto-Turret is upgraded along with your Union Crawler, it gains additional
> stats as shown for each Tech level above the first.

Stated identically for Survey Drone, and for Mecha Companion with a floor —
"equal to your Union Crawler **(Tech 3 minimum)**." This is what
`bonusPerTechLevel` on the equipment records is for.

**Mech-granted partners have a fixed Tech Level** and no crawler scaling: Sestra
Drone is TL 3, Big Brother Drone TL 5, and neither carries `bonusPerTechLevel`.

### 2.6 Per-host caps (all confirmed verbatim)

| Partner                                | Cap                                                                                     | Source |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| Auto-Turret                            | "You may only ever have one Auto-Turret at a time"                                      | p. 29  |
| Survey Drone                           | "only ever have one Survey Drone at a time"                                             | p. 48  |
| Mecha Companion                        | "only ever have one Mecha Companion at a time"                                          | p. 68  |
| Mecha Companion **+ Mecha Packmaster** | "allows you to have **up to two** Mecha Companions active in the field at any one time" | p. 69  |
| Sestra Drone                           | "The Little Sestra may have one active Sestra Drone at a time"                          | p. 128 |

### 2.7 Loading and unloading — confirmed, and broader than assumed

The campaign owner's statement:

> Drones operate like mechs do to crawlers — they can load things onto the
> crawler, or give them to other mechs / drones / anything with cargo.

**The Core Book backs this directly.** The Load action (Rigging trait required):

> You pick up and load a Mech Chassis, System, Module, or piece of Scrap in Range
> onto **your Mech or an allied Mech**. This takes up a number of Cargo Slots
> equal to its Salvage Value. Scrap takes up 1 Cargo Slot.

Combined with "uses the same rules as Mechs" (§2.4), a partner is a valid Load
target and a valid Load source. So a Partner is a **first-class node in the cargo
graph**, not a leaf.

Worth flagging: the rules describe an **N-node graph** (any mech to any allied
mech), while ITUN implements a **single hardcoded mech⇄crawler boundary**. ITUN
is therefore already under-modelling cargo _before_ partners enter the picture —
mech→mech transfer isn't possible today either. The §4.4 generalisation fixes
both at once.

Also confirmed: the crawler Storage Bay "has an unlimited amount of storage and
you do not need to track this" and "is accessible to all Pilots in the Union
Crawler" — matching what ITUN already does.

### 2.8 Two data bugs found during this research

- **Big Brother's four pattern drones do not resolve.** `resolvePatternDrone`
  looks each up in `drones.json` by `config.name`, but "Shield Drone",
  "Anti-Missile Drone", "Fire Support Drone", and "Minelayer Drone" are
  **instance names over the Big Brother Drone stat block** and exist nowhere as
  entries. All four return `undefined`. The pattern-drone config has no ref field
  to say which stat block it instantiates.
- **`resolvePatternDrone` reads `pattern.drones[0]` only** — so even once the
  names resolve, Big Brother's four collapse to one.

Both need fixing for mech-side partners to work at all, and both are data/resolver
issues independent of the UI plan.

---

## 3. Options considered

### Option A — extend ADR-023 in place

Re-key `equipmentLoadouts` by instance id; add name / SP / heat fields.

- ✅ Cheap; fixes the Mecha Packmaster collision.
- ❌ Pilot-side only — **cannot represent a mech's drone at all**, which is now
  known to be half the problem.
- **Verdict: fails the ask.**

### Option B — Partner as a fourth first-class entity type

A `partners` IndexedDB store; `EntityRef.type` gains `'partner'`; `SoftLink.type`
gains `'partner-to-pilot'` / `'partner-to-mech'`.

- ✅ One home regardless of who owns it; links, rows, routes fall out.
- ❌ Widening `EntityRef` ripples into `SoftLink`, snapshot/export bundle,
  `deepStrip`, roster filters, workspace stamping, orphan cleanup.
- ❌ Ownership becomes a _soft_ link, so deleting the host orphans its partners —
  wrong semantics. A partner has no independent existence.
- ❌ A roster citizen with no index route is against the grain of the store.

### Option C′ — Partner as an owned sub-entity of its **host** _(recommended)_

An additive-optional `partners: PartnerInstance[]` on **both `PilotSchema` and
`MechSchema`**, each instance carrying a globally-unique `id`.

- ✅ Handles both grant paths with one shape — the host is whoever holds the array.
- ✅ Ownership is intrinsic: deleting a pilot or mech removes its partners. No
  orphan cleanup.
- ✅ No new store, no DB migration; rides through snapshots and export bundles
  with its host for free.
- ✅ Per-instance `id` fixes both multiplicity cases (Mecha Packmaster ×2, Big
  Brother ×4).
- ✅ No index route by construction — it is not in a roster store to begin with.
- ⚠️ Needs a resolver so a flat `{ type: 'partner', id }` ref resolves across all
  pilots _and_ mechs (a derived index over `entityStore`).

**Recommendation: Option C′.** It is the only option that spans both ownership
paths without making a partner independently existent.

---

## 4. The plan (Option C′)

### 4.1 Data model

`apps/itun/src/lib/schemas/partner.ts`:

```ts
PartnerInstanceSchema = {
  id: string                    // globally unique — fixes ×2 and ×4 multiplicity
  hostRef: string               // stat-block slug: 'survey-drone' | 'sestra-drone' | …
  hostSchema: 'equipment' | 'drones'   // which file hostRef resolves against
  name?: string                 // instance name ('Custos', 'Shield Drone')
  appearance?: string
  aiPersonality?: string
  techLevelOverride?: number    // see below — TL is DERIVED, not stored
  currentSP?: number
  currentHeat?: number
  systems: string[]
  modules: string[]
  systemConditions?: …          // shapes reused verbatim from equipmentLoadouts
  moduleConditions?: …
  itemUses?: …
  conditions: string[]
  cargoLots?: CargoLot[]        // §4.4
}
```

`hostSchema` is what makes one shape serve both grant paths — the same field that
disambiguates the two different "Survey Drone" records.

Both `PilotSchema` and `MechSchema` gain `partners?: PartnerInstance[]`
(additive-optional; absent reads as none). Derived maxima compute from the
resolved stat block, mirroring `src/lib/rules/derivedStats.ts` — **never stored**.

**Tech Level is derived, per §2.5 — and the rule differs by grant path.** A
`partnerTechLevel(partner, host)` helper implements both branches:

- **Pilot-granted** → the **Union Crawler's** tech level (found by walking the
  pilot's `pilot-to-crawler` soft link), floored at 3 for Mecha Companion, then
  applying `bonusPerTechLevel` for each level above the first.
- **Mech-granted** → the drone stat block's own fixed TL. No scaling.

`techLevelOverride` exists only as a Free-Edit escape hatch
([ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md)); the derived value is the
default. Note the consequence: **a partner's stats change when the crawler is
upgraded**, which is a genuinely new cross-entity dependency — a pilot-granted
partner reads state from an entity two hops away, and an unlinked pilot has no
crawler to read, so the helper must degrade to TL 1 (or 3) rather than throw.

**Migration.** A migration lifts each `equipmentLoadouts[slug]` into a
`PartnerInstance` (minting an id, pulling identity out of `equipmentChoices`);
`equipmentLoadouts` is then deprecated. Mech-side partners are seeded at build
time from the chassis ability + pattern (§2.2), which needs the §2.8 resolver
fixes first.

**Per-host cap (§2.6).** Every partner carries a hard rules cap on how many may
be active at once — 1 for each, 2 for Mecha Companion with Mecha Packmaster. Per
[ADR-007](../adrs/ADR-007-automation-boundary.md) and the Free-Edit rule in
[ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md), this is displayed as
`used/max` and **never blocks** — same treatment as slot budgets. Note the cap is
raised by a _second ability_ (Packmaster), so it is a computed property of the
host's ability set, not a constant on the stat block.

### 4.2 Surfaces and routing

- **Host live sheet** — a Partners slab on the pilot sheet _and_ the mech sheet,
  one `EntityRow` per partner. This is the "appearing on the entity row"
  requirement, met with the component that already exists.
- **Partner sheet** — `/sheet/partner/$id` via the existing `/sheet/$kind/$id`
  route, `kind` widened to include `'partner'`. The mech sheet minus
  chassis/pattern — and minus Push, per §2.4.
- **No index route.** Never in the Roster, `/pilots`, `/mechs`, or any listing.
  Reachable only from its host's sheet or a direct link.
- **Header** — the sticky bar shows the owning pilot _or mech_ as a back-link
  badge, so a partner sheet always reads as owned.

### 4.3 Colour

The two suggestions in the ask resolve differently:

- **NPC/adversary tone (`--color-adversary`, #8c4b38) is wrong.** `theme.css`
  defines it as the shared header tone for the world/opposition schemas —
  creatures, bio-titans, factions, npcs, meld, squads. Partners are player-side.
- **Blue is right, but no ontology blue exists.** `--color-wk-accent` (#7dceeb)
  is the workshop/game-state accent and `--color-wk-line` an advisory rule
  colour; neither is an ontology hue and neither should be conscripted.

**Recommendation:** mint a sixth ontology hue — `--color-partner` /
`--color-sheet-partner` / `--color-sheet-partner-deep` — in the blue family and
distinct from the mech sage (#7a978a). `EntityRow`'s `TONE` map and the `Badge`
`tone` union each gain a `partner` entry.

The mech-ownership finding **strengthens** this: a partner row sits directly
beneath its mech on the same sheet, so reusing the mech tone (the cheap
alternative) would make the two indistinguishable exactly where the distinction
matters most.

### 4.4 Cargo — the largest work item

`apps/itun/src/lib/cargo/cargoTransfer.ts` is a pure reducer over a **hardcoded
two-node mech⇄crawler boundary**: `CargoBoundaryState` names a mech hold and a
crawler bay, with actions `stow` / `load` / `add-mech-lot` / `remove-mech-lot` /
`add-crawler-lot` / `remove-crawler-lot` / `withdraw-scrap`.

Admitting partners requires generalising to a `(source, target)` pair with
per-node capacity semantics (`capped: n` vs `unlimited`). The reducer is pure and
well-tested, so this is tractable, but it is a real refactor and it touches
`StorageManifest.tsx`, which is written around the two named sides.

Per §2.7 this generalisation is owed to the rules regardless of partners — the
book's Load action already permits mech→allied-mech transfer, which ITUN cannot
express. Doing it once buys both.

**One decision needed before this can be specified:** the transfer verbs are
deliberate player-facing vocabulary — _Load/Unload_ for the mech hold,
_Stow/Unstow_ for the crawler bay, one pair per container. My suggestion is to
give partners **Load/Unload**, since §2.4 says a partner functions as a mech, and
accept that "Load" then names an action on two container types.

Note Auto-Turret has `cargoCapacity: 0` **and** the Immobile trait — its hold
should render as structurally absent, not as a zero-capacity container.

### 4.5 Out of scope (deliberately)

Dashboard mounting of a partner, partner-turn automation, downtime repair/refit
automation, re-crafting a destroyed partner, and any hard enforcement of slot or
partner-count budgets.

---

## 5. Suggested phasing

Each phase is independently shippable and leaves the app working.

| #   | Phase              | Delivers                                                                                                                                                    |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Reference data fix | Give `PatternDroneConfigSchema` a ref to its stat block; resolve **all** of `pattern.drones[]`, not `[0]`. Unblocks every mech-side partner (§2.8).         |
| 1   | Schema + migration | `PartnerInstance`, `partners` on Pilot **and** Mech, lift from `equipmentLoadouts`, Eldridge seed re-expressed. Fixes both multiplicity bugs. No UI change. |
| 2   | Tone + rows        | `--color-partner` tokens, `EntityRow`/`Badge` `partner` tone, Partners slab on both host sheets. Partners become visible and clickable.                     |
| 3   | Partner sheet      | `/sheet/partner/$id`, identity + stats + systems/modules slabs, host back-link. No index route.                                                             |
| 4   | Cargo              | Generalise `cargoTransfer` to N nodes; partner hold in `StorageManifest`; the verb decision from §4.4.                                                      |
| 5   | Cleanup            | Retire `equipmentLoadouts` and `PilotEquipmentLoadout.tsx`; supersede ADR-023 with a new ADR covering both grant paths.                                     |

Phase 0 is new and now sits first: without it, mech-owned partners cannot be
resolved at all.

## 6. Risks

- **Phase 0 changes the reference package**, so it has srd + discord-bot blast
  radius and regenerates JSON schemas. It is the only phase that leaves ITUN.
- **`equipmentLoadouts` retirement is a one-way migration** — must be
  reversible-by-backup (the export bundle) before it lands.
- **`EntityRef` widening.** Even in Option C′, a `{type:'partner'}` ref appearing
  in `SoftLink` or snapshots would ripple. The plan avoids this by keeping
  ownership implicit and _not_ creating partner soft-links — worth guarding in
  review so it doesn't creep back in.
- **Snapshot compatibility.** A partner rides inside its host, so old snapshots
  stay readable; a _new_ snapshot read by an old client silently drops partners.
- **Sixth ontology hue** has cross-app blast radius and should be checked against
  the style-unification rules before Phase 2.

## 7. Open questions

1. Confirm the stale-IndexedDB hypothesis in §1 — is a drone still showing as a
   mech in your running app?
2. **Big Brother's four drones (§2.8): are "Shield Drone" / "Anti-Missile Drone"
   / "Fire Support Drone" / "Minelayer Drone" instance names over the one Big
   Brother Drone stat block?** If so, Phase 0 adds a ref field. If they are meant
   to be their own stat blocks, this is a data gap in `drones.json` instead.
3. Cargo verb pair for partners (§4.4): reuse **Load/Unload**, or mint a new pair?
4. New blue ontology hue, or reuse the mech tone (§4.3)?
5. Should the §4.4 refactor also expose **mech→allied-mech** transfer (§2.7),
   which the rules permit and ITUN currently cannot express, or stay scoped to
   adding partners as nodes?

~~5. Should a partner's tech level track its host's automatically?~~ **Answered
by the rulebook** — see §2.5. Pilot-granted partners take the _Union Crawler's_
tech level (Mecha Companion floored at 3); mech-granted partners are fixed.

## 8. Rules verification

Everything in §2 was checked against **Salvage Union Core Book, Digital Edition
2.0a** (`~/Documents/SURules/`) via text extraction, not inferred from the JSON
dataset. Confirmed: the "same rules as Mechs / cannot Push" formula (4 sites),
the own-turn rule, per-host caps (5 sites), Mecha Packmaster's ×2, the Union
Crawler tech-level rule and the Mecha Companion T3 floor, Downtime
reacquisition, the Sestra Drone block verbatim with matching stats, the Load
action's "your Mech or an allied Mech" wording, and the unlimited Storage Bay.
Every stat table in §2.1 was cross-checked against the book's printed stat
blocks and matches the dataset.

**One gap:** the **Big Brother** chassis and its drone come from _False Flag_,
which is not among the local PDFs — so the Big Brother rows in §2.1 and the
four-drone claim in §2.2/§2.8 rest on the dataset alone and remain unverified
against the rulebook. That is exactly where open question 2 sits.
