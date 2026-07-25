# Partner Sheets — research, options, and a recommended plan

**Status:** proposal. Nothing here is built.
**Scope:** a new add-on sheet kind for statted Drones / Companions ("Partners")
that are granted by pilot abilities, are linkable and clickable, appear on entity
rows, participate in cargo loading/unloading, and deliberately get **no index
route**.

---

## 1. What is actually true in the codebase today

The premise for this work was that "the Eldridge Coast data has several 'drone'
datasets mistaken as mechs." That was true once; it is not true of the seed data
now, and the distinction matters for scoping.

- `apps/itun/src/lib/eldridgeCoast/eldridgeCoast.ts` seeds **six mechs, all with
  real chassis refs** (`atlas`, `solo`, `brawler`, `solo`, `goliath`,
  `mirrorball`). No mech record is a disguised drone.
- The four companions — **Custos** and **Incitatus** (Caligula), **PR-1**
  (Gersin), **Rek Jet** (Roach-Boy) — were already re-modelled off mechs and onto
  the owning pilot as ability-granted equipment under
  [ADR-023](../adrs/ADR-023-drone-equipment-installed-loadout.md): the equipment
  slug in `equipment[]`, identity in `equipmentChoices`, installed
  systems/modules in `equipmentLoadouts`.

> **Worth checking before anything else.** Seed data does not retro-fix a
> workspace that was already seeded. If drones are still rendering as mechs in
> the running app, that is stale **local IndexedDB** from before the ADR-023
> correction, not a data-file bug — and it needs a data fix or a re-seed, not a
> feature. This is a five-minute check and it changes nothing about the plan
> below; the plan is still worth doing on its own merits.

So the real problem is not mis-typed records. It is that **ADR-023's shape has
run out of room**, in five specific ways:

1. **Two of the same partner collapse into one.** `equipmentLoadouts` is keyed by
   equipment _slug_. ADR-023 names this an accepted limitation. It is now a live
   bug: the **Mecha Packmaster** ability grants **two** Mecha Companions, and
   they would share a single loadout, a single name, and a single condition set.
2. **A partner is not an entity**, so it cannot be soft-linked, cannot appear as
   an `EntityRow`, and cannot be navigated to.
3. **No cargo.** Partners have real `cargoCapacity` and — per the rules — load
   and unload exactly as mechs do.
4. **No live state.** Current SP, heat, and conditions have nowhere to live; only
   per-installed-item condition/uses do.
5. **Identity is free text** in `equipmentChoices`, so a partner has no name
   prominence, no callsign treatment, no tone.

---

## 2. The rules

### 2.1 What counts as a Partner

Three SRD equipment entries — and only three — carry a full mech-shaped stat
block. They are the Partners:

| Partner             | Granted by ability                         |  TL |  SP |  EP | Heat | Sys | Mod | Cargo | Traits             |
| ------------------- | ------------------------------------------ | --: | --: | --: | ---: | --: | --: | ----: | ------------------ |
| **Auto-Turret**     | Auto-Turret                                |   1 |  15 |  10 |   10 |  15 |   4 |     0 | Immobile, Portable |
| **Survey Drone**    | Survey Drone                               |   1 |   2 |   4 |    2 |   3 |   1 |     1 | Hover              |
| **Mecha Companion** | Mecha Companion; **Mecha Packmaster (×2)** |   1 |  12 |   5 |    8 |  12 |   2 |     3 | —                  |

Each also carries `bonusPerTechLevel`, so a Partner scales with tech level the
same way a chassis does.

**The discriminator is already in the data and needs no new field:** a Partner is
granted equipment where `systemSlots` or `moduleSlots` is present. This is the
exact predicate `isLoadoutHost()` already uses in
`apps/itun/src/components/sheet/pilotInventory.ts`.

Granted equipment _without_ stats stays ordinary equipment — **Holo Companion**
(explicitly cannot interact physically with the world) and **Knife Missile** both
read as companions in prose but have no stat block, so they must not become
Partners. Fourteen abilities use `grants`; only the three above host a loadout.

### 2.2 What is _not_ a Partner

`packages/salvageunion-reference/data/drones.json` (14 entries — Defacer Drone,
Salvo Drone, Combat Drone, Big Brother Drone, The Iron Lady, …) is a set of
**opposition stat blocks** in the world/adversary domain. These are GM-side
drones, not player partners. Note the trap: "Survey Drone" exists in _both_ files
with different meanings. Partner resolution must read `equipment.json`, never
`drones.json`.

### 2.3 Loading and unloading (per the campaign owner)

> Drones operate like mechs do to crawlers — they can load things onto the
> crawler, or give them to other mechs / drones / anything with cargo.

So a Partner is a **first-class node in the cargo graph**, not a leaf. Survey
Drone carries 1, Mecha Companion 3, Auto-Turret 0. This is the single most
structurally demanding requirement in the ask — see §4.4.

---

## 3. Options considered

### Option A — extend ADR-023 in place

Re-key `equipmentLoadouts` by instance id instead of slug; add name / SP / heat
fields to the loadout record.

- ✅ Cheap; no new store; no migration beyond additive-optional.
- ✅ Fixes the Mecha Packmaster collision.
- ❌ Still not an entity: no entity row, no link, no navigation, no cargo node.
- **Verdict: fails the ask.** It is, however, a strict subset of the recommended
  option and could ship first as a stepping stone.

### Option B — Partner as a fourth first-class entity type

A `partners` IndexedDB store, `PartnerSchema`, `EntityRef.type` gains
`'partner'`, `SoftLink.type` gains `'partner-to-pilot'`.

- ✅ Maximum power: links, rows, routes, cargo, dashboard mounts all fall out.
- ❌ Widening `EntityRef` ripples into `SoftLink`, snapshot/export bundle,
  `deepStrip`, roster filters, workspace stamping, orphan-link cleanup.
- ❌ Ownership becomes a _soft_ link, so deleting a pilot orphans its partners
  rather than removing them — wrong semantics. A partner has no independent
  existence; it is granted by an ability on one specific pilot.
- ❌ A roster citizen with no index route is against the grain of the store.

### Option C — Partner as an owned sub-entity of the pilot _(recommended)_

An additive-optional `partners: PartnerInstance[]` array on `PilotSchema`, where
each instance carries its own globally-unique `id`.

- ✅ Ownership is intrinsic: deleting a pilot removes its partners, correctly and
  automatically. No orphan cleanup.
- ✅ No new store, no DB migration — it rides through snapshots and export
  bundles with the pilot for free.
- ✅ The per-instance `id` fixes the Mecha Packmaster collision.
- ✅ Naturally has no index route — it is not in a roster store to begin with.
- ⚠️ Needs a resolver so a flat `{ type: 'partner', id }` ref can be looked up
  across all pilots (a derived index, ~20 lines over `entityStore`).

**Recommendation: Option C**, with the flat-ref resolver so partners get Option
B's addressability while keeping C's ownership semantics.

---

## 4. The plan (Option C)

### 4.1 Data model

Add to `apps/itun/src/lib/schemas/partner.ts`:

```ts
PartnerInstanceSchema = {
  id: string                    // globally unique — fixes the Packmaster case
  hostRef: string               // 'survey-drone' | 'auto-turret' | 'mecha-companion'
  name?: string                 // migrated from equipmentChoices.Name
  appearance?: string
  aiPersonality?: string
  techLevel?: number            // drives bonusPerTechLevel; defaults to the pilot's
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

`PilotSchema` gains `partners?: PartnerInstance[]` (additive-optional; absent
reads as none). Derived maxima (SP / heat / slots at tech level) compute from the
resolved equipment entry + `bonusPerTechLevel`, mirroring
`src/lib/rules/derivedStats.ts` — **never stored**.

**Migration from ADR-023.** A migration lifts each `equipmentLoadouts[slug]` into
one `PartnerInstance` (minting an id, pulling `Name` / `Appearance` /
`A.I. Personality` out of `equipmentChoices`). `equipmentLoadouts` is then
deprecated. The four Eldridge companions are re-expressed in the seed directly.

### 4.2 Surfaces and routing

- **Pilot live sheet** — a Partners slab, one `EntityRow` per partner, alongside
  the existing linked-unit rows. This is the user's "appearing on the entity row"
  requirement, met with the component that already exists.
- **Partner sheet** — `/sheet/partner/$id` via the existing `/sheet/$kind/$id`
  route, `kind` widened to include `'partner'`. It is a real sheet: identity
  card, stat card, systems slab, modules slab, hold, conditions — the mech sheet
  minus chassis/pattern.
- **No index route.** Partners never appear in the Roster, `/pilots`, or any
  listing. Reachable only from their owner's sheet or a direct link. This is why
  Option C's "not in a store" property is a feature, not a workaround.
- **Header** — the sticky bar shows the owning pilot as a back-link badge, so a
  partner sheet always reads as owned.

### 4.3 Colour

The two suggestions in the ask resolve differently:

- **NPC/adversary tone (`--color-adversary`, #8c4b38) is wrong.** `theme.css`
  defines it as the shared header tone for the world/opposition schemas —
  creatures, bio-titans, factions, npcs, meld, squads. Partners are player-side.
  Using it would misfile them ontologically.
- **Blue is right, but no ontology blue exists yet.** `--color-wk-accent`
  (#7dceeb) is the workshop/game-state accent, not an ontology hue, and
  `--color-wk-line` is an advisory rule colour. Neither should be conscripted.

**Recommendation:** mint a sixth ontology hue, `--color-partner` /
`--color-sheet-partner` / `--color-sheet-partner-deep`, in the blue family and
distinct from the mech sage (#7a978a) — the whole point is that a partner row
reads as _not a mech_ at a glance. `EntityRow`'s `TONE` map and the `Badge`
`tone` union each gain a `partner` entry. This is a deliberate expansion of the
ontology palette and should be recorded as such.

_(Alternative, if you'd rather not add a hue: reuse the mech tone, since a
partner is mechanically mech-shaped. Cheaper, but rows stop distinguishing.)_

### 4.4 Cargo — the largest work item

`apps/itun/src/lib/cargo/cargoTransfer.ts` is today a pure reducer over a
**hardcoded two-node mech⇄crawler boundary**: `CargoBoundaryState` names a mech
hold and a crawler bay, and the actions are `stow` / `load` / `add-mech-lot` /
`remove-mech-lot` / `add-crawler-lot` / `remove-crawler-lot` / `withdraw-scrap`.

Adding a third node type requires generalising it to a `(source, target)` pair
with per-node capacity semantics (`capped: n` vs `unlimited`). The reducer is
pure and well-tested, so this is tractable, but it is a real refactor and it
touches `StorageManifest.tsx`, which is written around the two named sides.

**One decision needed from you before this can be specified:** the transfer verbs
are deliberate player-facing vocabulary — _Load/Unload_ for the mech hold,
_Stow/Unstow_ for the crawler bay, one pair per container. A third container
needs its own pair, or the vocabulary needs to collapse to a generic pair. My
suggestion is to give partners **Load/Unload** (they are mech-shaped, and the
rules statement says they behave like mechs), and accept that "Load" then names
an action on two container types.

Note also that Auto-Turret has `cargoCapacity: 0` **and** the Immobile trait — it
should render its hold as structurally absent rather than as a zero-capacity
container.

### 4.5 Out of scope (deliberately)

Dashboard mounting of a partner, partner-vs-partner combat automation, and any
rules enforcement on slot budgets. Slot budgets stay soft per
[ADR-007](../adrs/ADR-007-automation-boundary.md) / the Free-Edit surface rule in
[ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md).

---

## 5. Suggested phasing

Each phase is independently shippable and leaves the app working.

| #   | Phase              | Delivers                                                                                                                                            |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Schema + migration | `PartnerInstance`, `Pilot.partners`, lift from `equipmentLoadouts`, Eldridge seed re-expressed. Fixes the Mecha Packmaster collision. No UI change. |
| 2   | Tone + rows        | `--color-partner` tokens, `EntityRow`/`Badge` `partner` tone, Partners slab on the pilot sheet. Partners become visible and clickable.              |
| 3   | Partner sheet      | `/sheet/partner/$id`, identity + stats + systems/modules slabs, owner back-link. No index route.                                                    |
| 4   | Cargo              | Generalise `cargoTransfer` to N nodes; partner hold in `StorageManifest`; the verb decision from §4.4.                                              |
| 5   | Cleanup            | Retire `equipmentLoadouts` and `PilotEquipmentLoadout.tsx`; supersede ADR-023 with a new ADR.                                                       |

## 6. Risks

- **`equipmentLoadouts` retirement is a one-way migration.** Phase 1 must be
  reversible-by-backup (the export bundle) before it lands.
- **`EntityRef` widening.** Even in Option C, a `{type:'partner'}` ref appearing
  in `SoftLink` or snapshots would ripple. The plan avoids this by keeping
  ownership implicit and _not_ creating partner soft-links — worth guarding in
  review so it doesn't creep back in.
- **Snapshot/share compatibility.** A partner rides inside its pilot, so old
  snapshots stay readable; but a _new_ snapshot read by an old client silently
  drops partners. Acceptable for a local-first app, worth stating.
- **Sixth ontology hue.** Adding a palette entry has cross-app blast radius
  (srd + itun + component-lib) and should be checked against the
  style-unification rules before Phase 2.

## 7. Open questions

1. Confirm the stale-IndexedDB hypothesis in the callout at the top of §1 — is a
   drone still showing as a mech in your running app?
2. Cargo verb pair for partners (§4.4): reuse **Load/Unload**, or mint a new pair?
3. New blue ontology hue, or reuse the mech tone (§4.3)?
4. Should a partner's tech level track the owning pilot's automatically, or be
   independently editable?
