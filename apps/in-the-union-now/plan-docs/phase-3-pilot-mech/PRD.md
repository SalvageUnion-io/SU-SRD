# Phase 3 — Pilot (with Mech) Builder & CRUD

## Scope

Pilot creation wizard (includes mech creation), pilot detail view with "Load In / Load Out" mech toggle, mech modification, and pattern application. The pilot creation flow runs both the pilot wizard and the mech wizard back-to-back, producing a fully equipped pilot.

**What ships:**

- Pilot creation wizard ("Create a Pilot" — 8 interactive steps: 7 mandatory + 1 optional, skipping paperOnly)
- Mech creation wizard ("Create a Mech" — 7 interactive steps, scrap budget + slot constraints)
- Wizard engine core: info, select-one, select-many, freeform, roll-table step types
- Pilot detail view with "Load In / Load Out" mech toggle
- Mech modification (swap individual systems/modules)
- Apply pattern to pilot's mech
- Save current mech config as a new pattern
- Pilot roster on dashboard
- Pilot and mech editing after creation

**What does NOT ship:**

- Crawler/Campaign management (Phase 4)
- User invites and roles (Phase 5)
- Change tracking, real-time, downtime (Phase 6)

---

## User Stories

### Pilot Creation

- **US-M1**: As a player, I can create a new pilot by following an interactive wizard that walks me through class selection, ability choice, equipment picks, and identity (callsign, background, motto, keepsake, appearance).
- **US-M2**: After completing the pilot wizard, the mech wizard runs automatically, building my starting mech within a 20 TL1 scrap budget.
- **US-M3**: As a player, I can see a roster of all my pilots on the dashboard.

### Pilot Detail & "Load In / Load Out"

- **US-M4**: As a player, I can view my pilot's full sheet showing class, abilities, equipment, identity fields, HP/AP/TP — presented inside a DisplayCard.
- **US-M5**: As a player, I see a **"Load In"** button below the pilot header. Pressing it swaps the main header to show mech stats (SP/EP/Heat/chassis), and the pilot stats are reduced to a smaller secondary display. This represents my pilot climbing into their mech.
- **US-M6**: When loaded in, the button reads **"Load Out"**. Pressing it swaps back to pilot-forward view, with mech stats moving to the secondary display.
- **US-M7**: The "Load In" button is **only active if the mech is considered pilotable** (i.e., the mech exists and has SP remaining). A mech with 0 SP is destroyed. Note: `item_condition` values are `intact` (functional), `damaged` (inoperable — cannot be used), and `destroyed` (permanently gone). "Damaged" means **inoperable**, not "has taken some damage". **If a mech's chassis is damaged, the entire mech is inoperable** (cannot load in).
- **US-M8**: When loaded in, mech actions (systems, modules, chassis ability) are highlighted; pilot-only actions are de-emphasized but still accessible.

### Mech Management

- **US-M9**: As a player, I can modify my mech's installed systems/modules individually (swap, add, remove) while respecting slot constraints. The mech editor uses the same MechBuilder component as the Pattern Builder, pre-populated with current loadout. If assigned to a crawler, **any change that costs communal scrap** (adding, removing, or swapping systems/modules/chassis) shows a **scrap cost confirmation dialog** before executing.
- **US-M10**: As a player, I can apply a saved pattern to my pilot's mech via an **"Apply Pattern"** button in the mech editor. If assigned to a crawler, patterns are filtered to chassis at or below the crawler's tech level, and a **scrap cost confirmation dialog** shows the net cost (new items minus refunded old items) before applying. The scrap is deducted from the crawler pool.
- **US-M11**: As a player, I can save my pilot's current mech configuration as a new pattern.

### Storage / Cargo

- **US-M14**: As a player, I can manage my mech's cargo. Mech storage capacity is determined by the chassis (`cargo_capacity` stat). Items exceeding capacity cannot be added. Mech cargo may contain abstract scrap or items with scrap value.
- **US-M15**: As a player, I can view my pilot's personal inventory (pilot cargo — no hard capacity limit, but limited in practice by what a pilot can carry on foot).

### Scrap Economy & Cargo Transfer

- **US-M17**: As a player, I can **"Unload Cargo"** from my mech — this moves all scrap and cargo items from mech storage to the crawler's storage/scrap inventory. Items with scrap value are converted to the appropriate TL scrap on the crawler.
- **US-M17a**: As a player, I can **"Load Cargo"** onto my mech from the crawler — this opens a selection UI where I can pick from: game entities of selectable types (chassis, systems, modules from crawler storage) or abstract scrap of any TL. Loaded items are added to mech cargo, subject to mech cargo capacity.
- **US-M18**: As a player, I can **"Refund"** an installed system or module from my active mech, removing it from the mech and returning its scrap value to the crawler's scrap pool (at the item's tech level).
- **US-M19**: As a player, I can alternatively move a refunded item to crawler bay storage instead of scrapping it (preserving the item for future reinstallation).
- **US-M20**: When upgrading my mech (adding/swapping systems or modules), the scrap budget is **drawn from the crawler's scrap inventory**. The cost is deducted at the item's tech level.
- **US-M21**: Pilots do **not** have an independent scrap budget — the crawler is the communal scrap pool.
- **US-M22**: If my pilot is **not assigned to a crawler**, I can freely edit my mech's loadout (swap chassis, systems, modules) with no scrap cost — like the Pattern Builder but embedded in the pilot sheet. This represents a pilot operating independently outside of a crawler's economy.

**Note**: Scrap economy features that involve the crawler (US-M17, M17a, M18, M19, M20) require crawler infrastructure from Phase 4. In Phase 3, only the "unassigned pilot = free editing" path (US-M22) is implemented. The crawler-dependent cargo/scrap operations are wired in Phase 4.

### Pilot Equipment

- **US-M23**: As a player, my pilot starts with **2 pieces of TL1 equipment** chosen during creation.
- **US-M24**: As a player, I can **swap equipment** on my pilot. Equipment is gated by the **crawler's tech level** — only equipment at or below the crawler's TL is available.
- **US-M25**: During downtime, I can obtain **1 piece of pilot equipment** from the Armoury (at or below crawler TL), per the downtime rules.
- **US-M26**: Pilots have **6 Inventory Slots**. Equipment occupies inventory slots. Items cannot exceed this capacity.
- **US-M27**: If my pilot is not assigned to a crawler, equipment swapping is unrestricted by tech level (same as unassigned mech editing — no constraints outside the crawler economy).

**Note**: Equipment features that reference crawler TL gating (US-M24, US-M25) require crawler infrastructure from Phase 4. In Phase 3, equipment swapping is unrestricted (same as unassigned pilot behavior). TL constraints are wired when crawlers exist.

### Ability Learning

- **US-M16**: As a player, if I have enough **TP (Training Points)**, I can learn a new ability from my class's ability trees, following the per-tree prerequisite chain (core -> advanced -> legendary). Requirements are defined in `ability-tree-requirements.json`.
- **US-M16a**: As a player, I can **unlearn** an ability (costs TP). I cannot unlearn a lower-level ability if a higher-level ability in the same tree chain is still learned.

### Editing

- **US-M12**: As a player, I can edit my pilot's identity fields (callsign, background, motto, keepsake, appearance) and stats after creation.
- **US-M13**: As a player, I can edit my mech's loadout and metadata (pattern name, quirk, appearance) after creation.

---

## Creation Workflows

### Create a Pilot (Guide: `character-creation`)

The wizard runs 8 interactive steps (7 mandatory + 1 optional), skipping 1 `paperOnly` step. All wizard steps are rendered inside DisplayCard containers, maintaining the visual consistency established in Phase 1.

| Step | Name                       | Type          | Details                                                                                   |
| ---- | -------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| 1    | Choose your Pilot Class    | `select-one`  | From 6 core classes (filtered: `hybrid=false`). Schema: `classes`.                        |
| 2    | Choose your first Ability  | `select-one`  | From abilities in the chosen class's core trees. `dependsOn` + `contextFrom`: class step. |
| 3    | Select Two Pilot Equipment | `select-many` | TL1 equipment, max 2. Schema: `equipment`. Filter: `techLevel=1`.                         |
| 4    | Choose your Callsign       | `roll-table`  | Roll table: "Callsign Table" (columns type — two d20 rolls).                              |
| 5    | Choose your Background     | `roll-table`  | Roll table: "Background" (flat 1-20).                                                     |
| 6    | Choose your Motto          | `roll-table`  | Roll table: "Motto" (flat 1-20).                                                          |
| 7    | Choose your Keepsake       | `roll-table`  | Roll table: "Keepsake" (flat 1-20).                                                       |

Optional step (not skipped, but marked optional): **Choose your Appearance** (roll-table, "Pilot Appearance").

**Skipped `paperOnly` steps**: "Fill out your Stats" (info — auto-populated digitally).

**On completion**: Creates `pilots` row + `entity_refs` for ability and equipment + `player_choices` for callsign, background, motto, keepsake, appearance. Then immediately transitions to the mech creation wizard.

### Create a Mech (Guide: `mech-creation`)

Runs immediately after pilot creation. Uses the **same MechBuilder component** as the Pattern Builder, but with constraints enabled. 7 interactive steps:

| Step | Name                            | Type          | Details                                                                  |
| ---- | ------------------------------- | ------------- | ------------------------------------------------------------------------ |
| 1    | Gain Scrap                      | `info`        | Starting budget: 20 TL1 scrap. Displayed, no user action.                |
| 2    | Craft your Mech Chassis         | `select-one`  | TL1 chassis only. Deducts salvage value from scrap.                      |
| 3    | Craft your Systems              | `select-many` | TL1 systems. Max from chassis `systemSlots`. Deducts salvage per system. |
| 4    | Craft your Modules              | `select-many` | TL1 modules. Max from chassis `moduleSlots`. Deducts salvage per module. |
| 5    | Choose your Quirk               | `roll-table`  | Optional. Roll table: "Quirks".                                          |
| 6    | Describe your Mech's Appearance | `roll-table`  | Optional. Roll table: "Mech Appearance".                                 |
| 7    | Give your Mech a Pattern Name   | `roll-table`  | Roll table: "Mech Pattern Names".                                        |

**On completion**: Creates `mechs` row + `entity_refs` for systems/modules + `player_choices` for quirk, appearance, pattern name. Updates `pilots.mech_id`.

---

## Constraint System

### Ability Tree Prerequisites

Abilities unlock **per-tree, in order** (core → advanced → legendary). Each tree has its own chain defined in `ability-tree-requirements.json`.

1. **Core abilities** (Level 1): Available from the trees of the pilot's chosen class (e.g., Engineer has Mechanical Knowledge, Forging, Mech-Tech).
2. **Advanced abilities** (Level 2): Each advanced tree requires a specific core tree (e.g., "Advanced Engineer" requires "Mech-Tech"). Defined by `requirement` array with 1 entry.
3. **Legendary abilities** (Level 3): Each legendary tree requires its corresponding advanced tree (e.g., "Legendary Engineer" requires "Advanced Engineer").
4. **Hybrid classes**: Require 2 specific core trees from different classes (e.g., "Fabricator" requires "Forging" + "Electronics"). Their legendary trees then require the hybrid tree.
5. **Unlearning**: Abilities CAN be unlearned, but unlearning costs TP. Cannot unlearn a lower-level ability without first unlearning the higher-level abilities that depend on it (e.g., can't unlearn core tree if advanced tree from it is still learned).
6. **Ordering enforced**: Can't learn level N+1 without having level N in the same tree chain.

### Scrap Budget (Mech Creation)

- Starting budget: **20 TL1 scrap**
- Each chassis/system/module has a `salvageValue` cost at its tech level
- Wizard tracks remaining scrap in real time and prevents overspending
- Scrap conversion: `normalizeTechLevel()` from salvageunion-reference

### Slot Management

- Each chassis defines `systemSlots` and `moduleSlots`
- Each system/module has `slotsRequired` (typically 1, some take more)
- Wizard enforces: total `slotsRequired` of installed items <= chassis slot count

---

## Pilot Detail — "Load In / Load Out"

The pilot detail view uses a **single DisplayCard** with a dynamic header that swaps based on the pilot's load state. This is a UI toggle, not a data change — both states read the same underlying data.

**Design principle**: The pilot sheet should be **space-efficient**, showing as much relevant information as the player needs for their current mode (pilot-forward vs mech-forward) without wasted space. Maximize screen real estate. Visual elements should resemble their suref-web counterparts — e.g., HP/AP/TP displays use the same `ValueDisplay` component as EntityDisplay stats, extended with `InteractiveStatDisplay` for editability.

### Pilot-Forward (Default — "Loaded Out")

The DisplayCard header shows **pilot stats** prominently:

- Callsign, class name
- HP / AP / TP
- Background, motto, keepsake

Below the header: **"Load In" button** (only active if mech exists and is pilotable).

Body content:

- Pilot abilities with actions
- Pilot equipment with actions
- Pilot inventory (cargo)
- Mech stats shown in a **smaller secondary display** (if mech exists)

### Mech-Forward ("Loaded In")

The DisplayCard header swaps to show **mech stats** prominently:

- Pattern name, chassis name
- SP / EP / Heat Capacity
- Chassis ability summary

Below the header: **"Load Out" button**.

Body content:

- Systems with actions (highlighted — primary combat actions)
- Modules with actions
- Mech cargo
- Pilot stats shown in a **smaller secondary display** (HP/AP/TP, abilities de-emphasized)
- Pilot equipment still accessible but visually de-emphasized

### "Load In" Button Rules

- **Active**: Mech exists (`pilots.mech_id` is not null) AND mech is pilotable (at least 1 SP remaining — a mech with 0 SP is destroyed)
- **Disabled**: No mech assigned, or mech is destroyed
- **Label**: "Load In" when pilot-forward, "Load Out" when mech-forward
- **State**: `useState<'pilot' | 'mech'>` in the PilotDetail component, defaults to `'pilot'`

---

## Acceptance Criteria

### AC-1: Pilot Creation Wizard

- [ ] Wizard runs 7 interactive steps matching guide data
- [ ] paperOnly steps are skipped
- [ ] Class selection filters to non-hybrid classes
- [ ] Ability selection shows abilities from chosen class's trees
- [ ] Equipment selection enforces max 2, TL1 only
- [ ] Roll table steps support both rolling and manual selection
- [ ] All wizard steps render inside DisplayCard containers
- [ ] On completion, creates pilot + entity_refs + player_choices

### AC-2: Mech Creation (Integrated)

- [ ] Mech wizard runs immediately after pilot wizard completes
- [ ] MechBuilder shows scrap budget tracker (20 TL1)
- [ ] Only TL1 chassis/systems/modules available
- [ ] Slot limits enforced
- [ ] Scrap budget prevents overspending
- [ ] On completion, creates mech + entity_refs, links to pilot

### AC-3: Pilot Detail — Load In / Load Out

- [ ] Default view is pilot-forward with pilot stats in DisplayCard header
- [ ] "Load In" button below header, only active when mech is pilotable
- [ ] Pressing "Load In" swaps header to mech stats, pilot stats become secondary
- [ ] "Load Out" button swaps back to pilot-forward
- [ ] Mech-forward view highlights mech actions, de-emphasizes pilot-only actions
- [ ] Pilot-forward view shows mech in smaller secondary display

### AC-4: Pilot Roster

- [ ] Dashboard shows pilot section with grid of pilot cards
- [ ] Each card shows: callsign, class name, mech chassis name (if exists)
- [ ] "Create a Pilot" button navigates to wizard
- [ ] Click card navigates to pilot detail

### AC-5: Mech Modification

- [ ] Can swap individual systems/modules on an existing mech
- [ ] MechBuilder component reused with current loadout as initial state
- [ ] Can apply a saved pattern to reconfigure the mech
- [ ] Can save current mech config as a new pattern

### AC-6: Scrap Economy

- [ ] "Unload Cargo" button on mech view transfers cargo/scrap to crawler
- [ ] "Refund" on installed system/module returns scrap to crawler or moves item to crawler storage
- [ ] Mech upgrades for crawler-assigned pilots deduct from crawler scrap pool
- [ ] Unassigned pilots can edit mech freely (no scrap cost, like pattern builder)

### AC-7: Pilot Equipment

- [ ] Pilot starts with 2 TL1 equipment items from creation
- [ ] Equipment can be swapped (gated by crawler TL for assigned pilots)
- [ ] Unassigned pilots can swap equipment freely (no TL restriction)
- [ ] 6 inventory slots enforced

### AC-8: Editing

- [ ] Pilot identity fields editable after creation
- [ ] Mech loadout and metadata editable after creation
