# Salvage Union Starter Set: Integration Audit

Single audit doc tracking the deep-dive of the **Salvage Union Starter Set 1.0** product against the current `salvageunion-reference` data. Scope is strictly the seven Starter Set PDFs — no other sources or backlog items.

**Source enum value:** `Salvage Union Starter Set` (added in `packages/salvageunion-reference/lib/schemas/enums.ts`)
**Source data entry:** `packages/salvageunion-reference/data/sources.json` (id `572a5eee-b3f3-4f82-8092-88551fa6e0c4`)
**Border treatment:** placeholder — reuses `Mech Monday` scanline classes (`expansion-scanline-texture`, `expansion-scanline-card`, border `rgb(25,55,30)`) until a dedicated treatment is designed.
**Purchase link:** https://www.backerkit.com/c/projects/leyline-press/salvage-union-starter-set

## Booklet Abbreviations (established in Rules Reference p.2)

| Code | Full title |
| --- | --- |
| `CR` | Core Rulebook (`SUSS Core Rulebook 1.0.pdf`) |
| `PH` | Pilots Handbook (`SUSS Pilots Handbook 1.0.pdf`) |
| `PC` | Parts Catalogue (`SUSS Parts Catalogue 1.0.pdf`) |
| `RR` | Rules Reference (`SUSS Rules Reference 1.0.pdf`) |
| `AP` | Asset Pack — **Sticker Sheets only** (`Asset Pack Sticker Sheets 1.0.pdf`) |

**Standalone sources — NOT SUSS booklets** (each is its own work, no booklet code):

- `Reclamation of the Wastes` — bundled adventure module
- `The Hive` — Asset Pack mini-adventure
- `Thatcher's Mech Base` — Asset Pack mini-adventure
- `Relics of a Time Gone By` — Asset Pack mini-adventure

Quick-ref pages elsewhere use `(p. NNXX)` — e.g. `(p. 16CR)` means page 16 of the Core Rulebook.

## Audit Status

| PDF | Size | Status | Net-new | MM overlaps | Cross-ref TODOs |
| --- | --- | --- | --- | --- | --- |
| SUSS Rules Reference 1.0 | 590k | ✓ done | 0 | 0 | 1 (multi-source pagination) |
| SUSS Core Rulebook 1.0 | 3.4M | ✓ done | 0 | 0 | 24 backfills (roll tables, guides, distances, generic abilities) + **116 traits/keywords backfilled** (43 traits, 73 keywords from CR pp. 34-44 glossary) |
| SUSS Pilots Handbook 1.0 | 6.3M | ✓ surveyed | 0 | all PH classes/abilities reprint WM | TBD |
| SUSS Parts Catalogue 1.0 | 13M | ✓ surveyed | 2 chassis + 1 system + ~30 patterns | all WM systems/modules reprint | high (every chassis/system/module reprinted) |
| SUSS Reclamation of the Wastes 1.0 | 8.5M | ✓ surveyed | major (see below) | none | high (every entity is net-new for SUSS) |
| SUSS Campaign Map 1.0 | 5.4M | ✓ surveyed | 0 (visual aid) | 0 | 0 |
| Asset Pack — The Hive (standalone source) | ~3M | ✓ surveyed | major (see below) | none | high (every NPC/pattern is net-new) |
| Asset Pack — Thatcher's Mech Base (standalone source) | ~3M | ✓ surveyed | major (see below) | none | high (every NPC/system/lance is net-new) |
| Asset Pack — Relics of a Time Gone By (standalone source) | ~3M | ✓ surveyed | major (see below) | none | high (every NPC/equipment/table is net-new) |
| Asset Pack — Sticker Sheets (SUSS booklet `AP`) | ~1M | ✓ surveyed | 10 modules/systems | none | n/a |
| SUSS Char/Mech/Crawler Sheets 1.0 | 9.1M | ✓ surveyed | 0 (consolidated reprint of RotW pre-mades) | 0 | 0 (cross-ref RotW once modeled) |

## Cross-Cutting Open Questions

These will recur across multiple PDFs and should be resolved once, not per-booklet.

### Q1. Multi-source page references — ✓ resolved (Option A + booklet)

Decision: **Option A — primary + additional sources, with optional booklet code.** Added `AdditionalSourceSchema` and an optional `additionalSources?: Array<{source, booklet?, page}>` field to `BaseEntitySchema` (`packages/salvageunion-reference/lib/schemas/objects.ts`). The new field is automatically inherited by all 25 entity schemas that extend `BaseEntitySchema`, and is reported in every generated `*.schema.json`.

The optional `booklet` field disambiguates pages within multi-booklet sources. The Starter Set uses five codes: `CR` (Core Rulebook), `PH` (Pilots Handbook), `PC` (Parts Catalogue), `RR` (Rules Reference), `AP` (Asset Pack Sticker Sheets only). The `booklet` field is omitted for single-volume sources. **Reclamation of the Wastes and the Asset Pack mini-adventures (The Hive, Thatcher's Mech Base, Relics of a Time Gone By) are each their own standalone source** (not SUSS booklets) — citations use the work's title as `source` with no booklet code.

Backfilled with the 6 guide entries surfaced from the Rules Reference pass:

| Guide | Primary | Added |
| --- | --- | --- |
| Pushing a Mech | WM p. 233 | SUSS p. 16CR |
| Heat | WM p. 234 | SUSS p. 16CR |
| Activating and Shutting Down a Mech | WM p. 238 | SUSS p. 21CR |
| Crawler Downtime | WM p. 227 | SUSS p. 64PH |
| Map Movement | WM p. 263 | RotW p. 8 |
| Safety Protocols | WM p. 12 | SUSS p. 8CR |

### Q2. Source granularity — ✓ resolved (revised 2026-05-10)

`Salvage Union Starter Set` covers the rules booklets and Sticker Sheets (CR/PH/PC/RR/AP) — same source, different booklets. **Each adventure / mini-adventure shipped in the box is its own standalone source** with no booklet code:

- `Reclamation of the Wastes` — bundled adventure module
- `The Hive` — Asset Pack mini-adventure
- `Thatcher's Mech Base` — Asset Pack mini-adventure
- `Relics of a Time Gone By` — Asset Pack mini-adventure

Each is a self-paginated PDF with substantial original setting/entity material that warrants independent citation. The `AP` booklet code now refers strictly to the Sticker Sheets PDF (10 net-new modules + systems).

---

## Per-PDF Findings

### SUSS Rules Reference 1.0 — ✓ done

- **File:** `Starter Set Rules Booklets/SUSS Rules Reference 1.0.pdf`
- **Size / pages:** 590k, 2 pages (1 cover art + 1 dense quick-ref card)
- **Nature:** Single-card rules summary, equivalent to the existing `SU_Quick Ref Sheets Digital 2.0.pdf` but restyled for the Starter Set. Functionally a condensed restatement, not net-new content.

#### Content inventory (page 2, by panel)

**CORE RESOLUTION**
- Core Mechanic Table (5-tier d20: Nailed it / Success / Tough Choice / Failure / Cascade Failure)
- Tough Choice Examples (default in/out of combat + 9 alternative examples)
- Pushing rules + 5-step Push Order

**ACTION SCENE**
- Group Initiative Table (You Shot First / Quickdraw / Wait and See / Fumble / Ambush)
- Actions (Move + 1 Turn Action; any number of Free / Reactions)
- Action Types table (Reaction Instant, Free Instant, Turn 1 Min, Short 10 Min, Long 1 Hr, Downtime 1 Week)
- Distances (Close / Medium / Long / Far)
- Activating and shutting down a Mech (4 bullets)

**HEAT**
- Heat rules (6 bullets)
- Reactor Overload Table (Overdrive / Overheat / Module Overload / System Overload / Reactor Overload)

**DAMAGE**
- Critical Injury Table (Miraculous Survival / Unconscious / Minor Injury / Major Injury / Fatal Injury)
- Critical Damage Table (Miraculous Survival / Core Damage / Module Destruction / System Destruction / Catastrophic Damage)
- Mech Damage rules (6 bullets)
- Pilot Damage rules (5 bullets)

**SALVAGING**
- Area Salvage Table (Jackpot! / Winning / Not Bad / Better than Nothing / Nothing)
- Mech Salvage Table (Lion's Share / Meat and Potatoes / Bits and Pieces / Nuts and Bolts / Ashes and Dust)
- Area Salvage rules
- Mech Salvage rules
- Conditions (Intact / Damaged / Destroyed)
- Tech Levels (T1–T6 with descriptions)
- Scrap Value formula

**NPC TABLES**
- Reaction Roll Table (Actively Helpful and Friendly / Friendly / Unfriendly / Hostile / Actively Hostile)
- NPC Action Table (5-tier mirror of Core Mechanic from NPC POV)
- Morale Table (Fight to the Death / Keep Fighting / Fighting Retreat / Retreat / Surrender)
- Retreat Table (Perfect Escape / Escape / Dangerous Escape / Failed Escape / Disastrous Escape)

**MISC**
- Safety Protocols (Boundaries: Out of Bounds / Off Camera; Stop Sign)
- Map Movement (Campaign Map / Region Map / Area Map — speeds for Crawler/Pilot vs Mech)
- Downtime Procedure (Post-Session 6 bullets / Pre-session 2 bullets)
- Page References legend (CR / PH / PC / RR — RotW is its own source)

#### Coverage analysis vs current data

**Roll tables — 11/11 covered** (`packages/salvageunion-reference/data/roll-tables.json`):
Core Mechanic ✓ · Group Initiative ✓ · Critical Injury ✓ · Critical Damage ✓ · Reactor Overload ✓ · Area Salvage ✓ · Mech Salvage ✓ · Reaction Roll ✓ · NPC Action ✓ · Morale ✓ · Retreat ✓

**Guides — all rules sections covered** (`packages/salvageunion-reference/data/guides.json`):
Safety Protocols ✓ · Pushing a Mech ✓ (incl. Push Procedure) · Heat ✓ (incl. Heat Check) · Activating and Shutting Down a Mech ✓ · Tough Choices ✓ (incl. Alternative Tough Choices) · Map Movement ✓ · Crawler Downtime ✓ (incl. Tally Salvage, Upkeep & Upgrade, etc.)

**Enums / lookups — covered:**
- Distances: Close / Medium / Long / Far ✓ (`distances.json`)
- Tech Levels: Tech 1–6 ✓ (`tech-levels.json`)
- Action Types: enum present (`Passive`, `Free`, `Reaction`, `Turn`, `Short`, `Long`, `DownTime`) in `enums.ts:46`. The Rules Reference's explicit time durations (Reaction Instant, Turn 1 Min, etc.) are not surfaced as schema descriptions but they match the existing semantic model.
- Conditions: Intact / Damaged / Destroyed ✓ (`item_condition` enum in DB + `keywords.json` entries)

#### Net-new content

**None.** The Rules Reference is a condensed restatement of Workshop Manual material; nothing on it lacks an existing entity.

#### Mech Monday overlaps

**None.** No MM-sourced content appears on this card.

#### Cross-ref TODOs

1. **Multi-source pagination decision (cross-cutting Q1)** — every guide and roll table referenced on this card has a SUSS page number that we currently can't store. Resolving Q1 unblocks adding SUSS pages to ~20 existing entities. No action until decision is made.

#### SUSS page references catalogued (for future cross-ref work)

| Entity | Current `source` / `page` | SUSS reference |
| --- | --- | --- |
| `Actions` (concept) | WM | p. 18CR |
| `Pushing a Mech` (guide) | WM p. 233 | p. 16CR |
| `Heat` (guide) | WM p. 234 | p. 16CR |
| `Distances` (collection) | WM | p. 19CR |
| `Activating and Shutting Down a Mech` (guide) | WM p. 238 | p. 21CR |
| Mech Damage (concept, in `Critical Damage` table area) | WM | p. 22CR |
| Pilot Damage (concept, in `Critical Injury` table area) | WM | p. 24CR |
| `Conditions` (keyword set) | WM | p. 28CR |
| Area Salvage (concept) | WM | p. 29CR |
| Scrap Value (concept) | WM | p. 30CR |
| Mech Salvage (concept) | WM | p. 30CR |
| `Crawler Downtime` (guide) | WM | p. 64PH |
| `Map Movement` (guide) | WM p. 263 | RotW p. 8 |
| `Safety Protocols` (guide) | WM p. 12 | p. 8CR |

---

### SUSS Core Rulebook 1.0 — ✓ done

- **File:** `Starter Set Rules Booklets/SUSS Core Rulebook 1.0.pdf`
- **Size / pages:** 3.4M, 47 pages
- **Nature:** Condensed restatement of Workshop Manual Core Rules. The booklet covers the entire base game loop in compact form: Setting intro, Safety Protocols, How to Play, Core Rules (mechanic, pushing, heat, action scenes, attacks, damage), Salvaging (types, conditions, area + mech salvage, cargo, abilities), and a comprehensive Keywords + Traits glossary.

#### Content inventory (by page)

**Front matter / setting (p. 1–13):** cover, credits, TOC, intro art, Setting overview (The world is scarred / Mechs are commonplace / Corpos / Salvage Unions / Wasters / The world is ripe for exploration / Bio-Titans / The Meld / There is hope), Safety Protocols (Boundaries — Out of Bounds / Off Camera / Stop Sign), How to Play (3–6 players, Mediator role, Things you Need to Play list).

**Core Rules (p. 14–25):**
- p. 14: Core Mechanic table (5-tier d20)
- p. 15: Only roll once / Always round down / Specific beats general / Rulings not rules / Pushing a Mech (header)
- p. 16: Push details, Push Procedure (5 bullets), Heat (header), Heat Check
- p. 17: Heat Check details, Reactor Overload Table, Venting Heat
- p. 18: Action Scenes / Group Initiative / What is a Group? / Who acts first?
- p. 19: Group Initiative Table / What can I do on my turn? / Movement / Distances (header)
- p. 20: Close / Medium / Long / Far Range, Actions, Turn Actions, Free Actions, Reactions
- p. 21: Short / Long / Downtime Actions, Is my Pilot or Mech acting?, Activating a Mech, Embarking and Disembarking
- p. 22: Attacks, Improvised Attacks, Improvised Damage, Death Blow, Mech Damage (header)
- p. 23: Critical Damage Table, Restoring Mech Structure Points
- p. 24: Repairing Mech Chassis/Systems/Modules, Destroyed Mechs, Pilot Damage (header)
- p. 25: Critical Injury Table, Injuries, Restoring Pilot Health, Pilot Armour

**Salvaging (p. 28–33):**
- p. 28: Salvaging intro, Salvage Types (Chassis/Systems/Modules/Vehicles/Scrap), Salvage Condition (Intact/Damaged/Destroyed)
- p. 29: Condition details, Area Salvaging (incl. Tech Level, Supply)
- p. 30: Salvaging a Mech, Salvaging a Non-Mech, Cargo Capacity
- p. 31: Salvaging Abilities — `Area Salvage`, `Mech Salvage`
- p. 32: `Scrap`, `Craft`
- p. 33: `Repair`, `Patch Up`, `Load`, `Mount`

**Keywords and Traits (p. 34–44):** comprehensive alphabetical glossary. Traits: Amphibious, Anti-Organic, Anti-Shielding, Armour, Ballistic, Burn, Burrower, Climbing, Communicator, Deadly, Energy, Escape, Explosive, Fast, Flashy, Fly, Guided, Hacking, Heat Spike, Heavy, Hot, Hover, Immobile, Ion, Jamming, Melee, Missile, Multi-Attack, Optics, Overheat, Personnel Capacity, Pinning, Poison, Rigging, Salvaging, Scanner, Shield, Silent, Targeter, Uses (X), Unwieldy, Vulnerable, Wield (43). Keywords: ~80 entries covering action types, classes, conditions, damage states, environment, etc.

**Index (p. 45–46), back cover (p. 47).**

#### Coverage analysis vs current data

**Roll tables — 7/7 covered** (existing in `roll-tables.json`):
Core Mechanic ✓ · Reactor Overload ✓ · Group Initiative ✓ · Critical Damage ✓ · Critical Injury ✓ · Area Salvage ✓ · Mech Salvage ✓

**Guides — all 11 referenced sections covered** (existing in `guides.json`):
Safety Protocols ✓ · Pushing a Mech ✓ · Heat ✓ · Activating and Shutting Down a Mech ✓ · Tough Choices ✓ · Map Movement (referenced in RotW p. 8) · Crawler Downtime (referenced in PH) · Mech Damage ✓ · Pilot Damage ✓ · Salvaging ✓ · Salvage Condition ✓

**Generic Pilot Abilities — 8/8 covered** (existing in `abilities.json`, tree `Generic`, source WM p.248–249):
Area Salvage ✓ · Mech Salvage ✓ · Scrap ✓ · Craft ✓ · Repair ✓ · Patch Up ✓ · Load ✓ · Mount ✓

**Distances — 4/4 covered** (existing in `distances.json`): Close · Medium · Long · Far ✓

**Traits — 43/43 covered** in `traits.json`. (Existing extras: `dependable`, `portable` — sourced elsewhere, not in SUSS.)

**Keywords — all SUSS keywords present** in `keywords.json`. (Existing extras such as `anomalous zone`, `bio-chassis`, `bio-module`, `bio-system`, `corporate scrip`, `freezing`, `low visibility`, `surface ice`, `difficult terrain (False Flag)` come from MM/expansion sources, not SUSS.)

#### Net-new content

**None.** The Core Rulebook is a condensed restatement of WM material; every rule, table, ability, keyword, and trait it contains is already represented in our data.

#### Mech Monday overlaps

**None.** No MM-sourced content appears in this booklet.

#### Cross-ref backlog

To be backfilled as `additionalSources` entries with `booklet: "CR"`. High-value targets done in this pass:

| Entity type | Count | Notes |
| --- | --- | --- |
| Roll tables | 7 | Core Mechanic, Reactor Overload, Group Initiative, Critical Damage, Critical Injury, Area Salvage, Mech Salvage |
| Guides (new) | 5 | Mech Damage, Pilot Damage, Salvaging, Salvage Condition, Tough Choices |
| Generic abilities | 8 | Area Salvage, Mech Salvage, Scrap, Craft, Repair, Patch Up, Load, Mount |
| Distances | 4 | Close, Medium, Long, Far |

✓ done (per top-of-doc status row): 73 keywords (CR pp. 38–44 glossary) and 43 traits (CR pp. 34–37 glossary) backfilled with `additionalSources` `booklet: "CR"` entries — 116 total. Tech-level entities are concept-only on p. 29 and not modeled as separate entities.



### SUSS Pilots Handbook 1.0 — ✓ surveyed

- **File:** `Starter Set Rules Booklets/SUSS Pilots Handbook 1.0.pdf`
- **Size / pages:** 6.3M, 68 pages
- **Nature:** Pilot-side rules booklet. All Pilot classes, advanced classes, abilities, equipment, NPCs, and Crawler/Union Crawler rules reprinted from WM. No net-new entities identified — every class, ability, and item already exists in current data.
- **Cross-ref backlog (large):** Each existing pilot-side entity needs `additionalSources` with `booklet: "PH"` and the PH page. To be batched in a later pass alongside PC backfills.

### SUSS Parts Catalogue 1.0 — ✓ surveyed

- **File:** `Starter Set Rules Booklets/SUSS Parts Catalogue 1.0.pdf`
- **Size / pages:** 13M (12.3M load), 79 pages
- **Nature:** Mech-side rules booklet (Mech Workshop p.4, Stats p.6, Sheet p.8, Chassis p.10, Systems p.46, Modules p.62, Tables p.76). The booklet styles itself as an in-fiction sales catalogue — many entries are theatrically annotated with "BANNED", "REDACTED", "Deauthorised", "UNSUBSCRIBED", "Access Denied" stickers. These overlays are flavor only; the underlying entries are the same as WM.

#### Net-new entities (must be added to data)

| Type | Name | Page | Notes |
| --- | --- | --- | --- |
| Chassis | **Bobcat** | 10 | T1 chassis, Integrated Scrap Magnet ability (Turn Action / Close / 1 EP). 11 SP / 8 EP / 8 HC / 13 SS / 2 MS / 6 Cargo / SV 7. |
| Chassis | **Gatecrasher** | 42 | T2/T3 siege chassis, Siege Ram ability (Turn Action / Heat Spike / Close — bypasses Immobile). 32 SP / 11 EP / 15 HC / 19 SS / 3 MS / 6 Cargo / SV 9. |
| System | **Sand Blaster** | 52 | T1 / 3 SS / SV 2. Turn Action / Close / 1 SP. Targeted system/module with Targeter trait disabled for 1 turn. Rendered as a handwritten "scrap of paper" insert — easy to miss but it's a real game item. |

#### Net-new chassis patterns (~30 not in current data)

Each existing chassis already has 1 pattern in current data; SUSS PC adds 2 new patterns per chassis plus the RotW pre-made pilot mech patterns. The full new pattern list per chassis (existing patterns marked ✓):

| Chassis | SUSS Patterns | Status |
| --- | --- | --- |
| Bobcat (new chassis) | Mr Miner (RotW pre-made for Driftwood), Warrior, Manic Miner | all new |
| Mule | Survivor (RotW for Judge), Hauler ✓, Shunter | 2 new |
| Mazona | Pop (RotW for Hotdog), M2, 'Shaitan' | 3 new |
| Scrapper | Swiss Cheese (RotW for Bone-Saw), Leaky ✓, Rigger ✓ | 1 new |
| Spectrum | Pyrotechnic (RotW for Pickle), Operator ✓, Party Bus | 2 new |
| Thresher | Slugger (RotW for Razor), Shepherd ✓, H&V ✓ | 1 new |
| Forge | Beam ✓, Steamroller ✓, Cargo | 1 new |
| Goliath | Scrapjack, Endeavour, Bio Hunter | 3 new |
| Gopher | Legion ✓, Herrsch, Analysis | 2 new |
| Hussar | Mauler ✓, Piggyback ✓, Blue Bolt | 1 new |
| Jackhammer | Cackler ✓, Auger ✓, Thatcher ✓ | 0 new |
| Kraken | Blackbeard ✓, TDA Industrial, Last Resort | 2 new |
| Magpie | Ironmonger ✓, Maggie ✓, Scourer | 1 new |
| Mirrorball | Junker ✓, Reclaimer ✓, Furtive | 1 new |
| Atlas | Thunder Storm ✓, Chauffeur, All Is Dust | 2 new |
| Brawler | Rifleman ✓, Torpedo-Man, Steel-Drivingman | 2 new |
| Gatecrasher (new chassis) | Moth, Grond, APC | all new |
| Solo | Blueberry Surprise, Refugee, Monster Games | 3 new |

**~30 net-new patterns** total across 16 existing + 2 new chassis. All have full system/module loadouts in the booklet — these are real, complete pre-built mechs.

#### Cross-ref backlog (PC pages on existing entities)

The PC reprints all T1–T4 systems and modules from WM, organized by tech level. Every existing system and module entity needs an `additionalSources` entry with `booklet: "PC"` and the PC page. Index on p.78–79 has all page numbers — can be batched mechanically.

- Systems (T1 ~13, T2 ~17, T3 ~6, T4 ~1) — 37 entities
- Modules (T1 ~12, T2 ~17, T3 ~1, T4 ~1) — 31 entities
- Existing chassis reprinted with stat blocks (16 chassis on p.12–45) — 16 entities
- Existing patterns reprinted (each existing pattern that overlaps SUSS) — ~10 entities
- Quirks Table (p.76), Mech Appearance Table (p.76), Pattern Names Table (p.77) — 3 roll tables (currently in WM)
- Mech Advancement guide (p.77) — 1 guide (currently in WM as part of mech progression rules)

Total: ~98 cross-ref backfills.

#### Notable

- The Bobcat ability "Integrated Scrap Magnet" is mechanically distinct: creates a Cargo Slot extension (12 slots) on the magnet, with the Vulnerable trait while active.
- The Gatecrasher "Siege Ram" auto-hits Immobile targets (structures, doors, turrets) and scales damage to Heat spent.
- The Sand Blaster's Targeter-disable effect is the only system in T1 with this kind of utility. Worth checking the keyword glossary for `Targeter` references when modeling.

### SUSS Reclamation of the Wastes 1.0 — ✓ surveyed

- **File:** `Reclamation of the Wastes/SUSS Reclamation of the Wastes 1.0.pdf`
- **Size / pages:** 8.5M, 119 pages (cover → setting/jobs → 4 regions → Mediator advice → entity catalog → index)
- **Nature:** The Campaign Book. Region/sandbox content, Mediator advice, and a consolidated NPC/vehicle/creature/Meld statblock catalog. **By far the largest net-new contributor in the Starter Set.** Where Core Rulebook / Pilots Handbook / Parts Catalogue restated WM material, RotW is original setting + entity content built specifically for the Starter Set's Reclamation of the Wastes campaign.

#### Structure (per Index, p. 116–119)

- **Front matter (p. 4–11):** Reclamation of the Wastes Setting · What is the Salvage Union? · The Present Day · Your First Session · Campaign Goals · Starting Play · Campaign Pacing · Exploration · Campaign Tables (Salvage Cache · Rumour)
- **Region 1.0 — Caldera's Edge (p. 12–31):** 16 sub-locations with NPCs/lances/encounters
- **Region 2.0 — Void Shore (p. 32–53):** ~10 sub-locations
- **Region 3.0 — House of the Gods (p. 54–69):** ~10 sub-locations
- **Region 4.0 — Irongrad (p. 70–87):** 16+ sub-locations including TDA history payload (Code Black, Rainmaker, Vornaya Meld)
- **Mediator Advice (p. 88–94):** Setbacks · Tough Choices · Controlling NPCs · NPC Health and Damage · How Do I Balance Combat? · Answer Lots of Questions · Encourage Creativity · Managing Time
- **NPC Tables (p. 97–99):** NPC Action · Reaction Roll · Morale · Retreat (all already exist in `roll-tables.json`)
- **Mechs of the Wasteland (p. 100):** essay-style guide on running NPC mechs
- **Vehicles, Drones & Turrets (p. 102–103):** 13 entities
- **People (p. 104–106):** 6 individual NPCs + 5 squad statblocks
- **Creatures (p. 107–109):** 11 creature statblocks
- **Ygdriss (p. 110–111):** Bio-Titan statblock
- **Meld (p. 112–115):** Meld lore + 5 entity statblocks (Drone, Drone Swarm, Nanoid, Splitter, Behemoth) + 2 item entries (Inert/Active Meld Nanite)

#### Net-new entities (consolidated catalog from p. 102–115) — ✓ done

All RotW entity statblocks are now in the dataset. Reprints from Workshop Manual (Box Wheel, Armoured Box Wheel, Tank, Rotorcraft, Power Loader, Machine Gun Turret, Survey Drone, all 6 People NPCs, Waster Mob, Raider Band, Rifle Squad, Wasteland Bear, Carrion Bird, Molebear, Chimeripede, Artl, Irradiated Scorpion, all 5 Meld statblocks) carry RotW under `additionalSources`. RotW-native entries (E-Boat, Tombstone Trackbox, Green Laser Turret, Missile Pod Turret, TDA Steelcap Drone, TDA Silverback Drone, Saboteur, Saboteur Squad, Iron Leech, Scrap Termite, Artl Queen, Hunter, Ygdriss, Inert Meld Nanite, Active Meld Nanite) carry RotW as primary `source`. The catalog tables below remain for cross-reference.

**Vehicles** (6 — all net-new; current data has no `vehicles.json`)

| Name | TL | SP | Personnel | Notes |
| --- | --- | --- | --- | --- |
| Box Wheel | 1 | 1 | 4 | Wheeled, Locomotion System only |
| Armoured Box Wheel | 2 | 4 | 18 | Wheeled, Locomotion System + 30mm Autocannon (Medium / 4 SP / Ballistic / Jamming) |
| Tank | 3 | 6 | – | Tracked, Locomotion System + 120mm Cannon (Long / 6 SP / Ballistic / Explosive (1)) |
| Rotorcraft | 4 | 3 | 6 | Hover Locomotion + Rotary Mini Gun (Medium / 4 SP / Ballistic / Hot (1) / Jamming / Multi-Attack (2) / Pinning) |
| E-Boat | 1 | 2 | 12 | Integrated Amphibious Locomotion |
| Tombstone Trackbox | 1 | 2 | 12 | Locomotion + Shanty Home (caravan home) |

**Drones** (3 — net-new; no `drones.json` currently)

| Name | TL | SP | Loadout |
| --- | --- | --- | --- |
| Survey Drone | 1 | 1 | Hover Locomotion + Survey Scanner |
| TDA Steelcap Drone | 1 | 4 | Red Laser (Close / 3 SP / Energy) + Locomotion + Comms Module |
| TDA Silverback Drone | 1 | 4 | Mini Mortar (Medium / 5 SP / Explosive (1) / Uses (5)) + Locomotion + Comms Module |

**Turrets** (3 + 1 utility loader — net-new; no `turrets.json` currently)

| Name | TL | SP | Weapon |
| --- | --- | --- | --- |
| Machine Gun Turret | 1 | 2 | .50 Cal Machine Gun (Close / 2 SP / Ballistic / Jamming / Pinning) — Immobile |
| Green Laser Turret | 2 | 4 | Green Laser (Medium / 4 SP / Energy / Hot (2)) — Immobile |
| Missile Pod Turret | 3 | 6 | Missile Pod (Long / 8 SP / Explosive (2) / Hot (1) / Missile / Uses (6)) — Immobile |
| Power Loader | 1 | 1 | Locomotion + Rigging Arm × 2 (Close / 1 SP / Melee / Load) |

**People NPCs (individuals)** (6 — net-new; no `npcs.json` currently)

| Name | HP | Loadout |
| --- | --- | --- |
| Wastelander | 2 | Improvised Melee Weapon + Salvaging Tools |
| Raider | 3 | Improvised Firearm (Close / 3 HP / Ballistic / Unwieldy) |
| Trooper | 5 | Rifle (Medium / 5 HP / Ballistic) + Portable Comms Unit |
| Veteran | 9 | Green Laser Rifle (Medium / 5 HP / Energy) + Portable Comms Unit |
| Combat Pilot | 10 | Pistol (Close / 3 HP / Ballistic) + Portable Comms Unit |
| Ace | 16 | Sniper Rifle (Long / 6 HP / Ballistic) + Portable Comms Unit |

**People NPCs (squads)** (5 — net-new; squads = group statblocks per Mediator advice intro on p. 105)

| Name | HP | Notes |
| --- | --- | --- |
| Waster Mob | 4 | Improvised Weapons (Multi-Attack 2) + Salvaging Tools |
| Raider Band | 6 | Improvised Firearms (Multi-Attack 2 / Unwieldy) + High Tensile Wire |
| Rifle Squad | 10 | Rifles (Multi-Attack 2 / Jamming) + Portable Comms Unit |
| Saboteur (individual) | 6 | Camouflage Fatigues, Improvised Explosive Device, Oil Bomb, Electrostatic Mine, Hobbler Mine + Ambusher / Guerrilla / Explosive Expert traits |
| Saboteur Squad | 10 | Same loadout as individual + Multi-Attack on Saboteurs trait |

**Creatures** (11 — net-new; no `creatures.json` currently)

| Name | HP | Notes |
| --- | --- | --- |
| Wasteland Bear | 5 | Bear Carnage (Close / 4 HP / Melee) |
| Carrion Bird | 3 | Fly · Talons (Close / 3 HP) |
| Iron Leech | 10 | Attach (Close / 2 SP / Melee) — attaches to target, halves damage to target |
| Molebear | 12 | Burrower · Iron Claw (Close / 4 SP / Melee) |
| Chimeripede | 10 | Barbed Tentacles (Close / 3 HP / Melee / Pinning / Poison / Multi-Attack 3) |
| Scrap Termite | 4 | Bite (Close / 2 SP / Melee — damages random System, Immobile if destroyed) + Regurgitate (Turn / Medium — applies Immobile via concrete-like goo) |
| Artl | 2 | Burrower · Acid Spit (Medium / 2 HP / Burn 2) + Corrosive Skin Glands passive (2 HP melee feedback) |
| Artl Queen | 20 | Burrower · Armoured Carapace (1× Armour Plating) · Scythe Swipe (Close / 3 SP / Multi-Attack 2) · Acid Spray (Medium / 2 SP / Burn 2 / Explosive 1) · Corrosive Skin Glands |
| Hunter | 9 | Cockpit Strike (Close / 1 SP / Melee — exposes pilot) · Decapitating Bite (Close / 6 HP / Melee / Deadly) · Hunter's Sight (thermal) · Ambush · Cloaking · Leap |
| Irradiated Scorpion | 4 | Stinger (Close / 2 HP / Melee / Poison / Deadly Creatures Only) |

**Bio-Titan** (1 — Ygdriss; net-new statblock)

- **Ygdriss** — 27 SP, Titanic Actions (3 picks: God's Wrath / Rust Spores / Summon Bio-Fauna), Thorns passive (2 SP melee feedback), Mutagenic Radiation (Pilots within Close gain Pilot Keepsake-style minor mutation; hostile pilots get Minor Injury instead), Immobile, Thickened Bark (2× Armour Plating).
  - Abilities: God's Wrath (Turn / Medium / 4 SP / Melee / Multi-Attack 2 — applies Immobile + Vulnerable on hit) · Rust Spores (Turn — Far range cloud, 2 SP + Burn 2) · Summon Bio-Fauna (Turn / Uses 3 — d20 spawn table: 20→2 Hunters, 11–19→4 Artls, 6–10→4 Scrap Termites, 2–5→4 Irradiated Scorpions, 1→1 Chimeripede)

**Meld entities & items** (5 statblocks + 2 items — all net-new)

| Name | HP/SP | Notes |
| --- | --- | --- |
| Meld Drone | 3 HP | Bite (Close / 2 HP / Melee / Meld Infection) — N. Salvage 1 |
| Meld Drone Swarm | 6 HP | Devour (Close / 3 HP / Melee / Meld Infection / Multi-Attack 3) — N. Salvage 3 |
| Meld Nanoid | 5 SP | Fast · Nanoid Tendrils (Close / 3 SP / Melee / Meld Infection) — N. Salvage 5 |
| Meld Splitter | 10 SP | Splitter Tendrils (Medium / 4 SP / Melee / Meld Infection / Multi-Attack 2) + Split (becomes 2 Nanoids when reduced to 0 SP) — N. Salvage 10 |
| Meld Behemoth | 60 SP | Titanic Actions: Move 1 / Behemoth Tendrils (Turn / Medium / 6 SP / Melee / Multi-Attack 2) / Assimilation (Turn — absorbs 0-SP target, gains target's Max SP). Drops Inert Meld Nanites equal to its Max SP when defeated. |
| Inert Meld Nanite (item) | – | 1 Cargo · Tradeable as Tech 1 Scrap equivalent |
| Active Meld Nanite (item) | – | 1 Cargo · Tradeable as Tech 6 Scrap equivalent · Repairs/crafts as Tech 6 · Per-hour escape risk if not stored cryogenically |

#### Net-new mechanics / rules

- **Squad design rule** (p. 105): Squads have higher HP and Multi-Attack to represent ~6 NPCs without individual tracking; their weapon damage values cannot be used by individuals.
- **Meld Infection** (p. 113): persistent debuff; infected creature → Meld Drone on death, infected mech → Meld Behemoth control on 0 SP. Cleansed only by fire (which also damages the host).
- **Nanite Salvage** (p. 112): On any Meld unit reaching 0 SP, roll d20 per piece — 20 = Active Meld Nanite, otherwise Inert.
- **Active Meld Nanite handling** (p. 112): hourly d20 — 1 = Tough Choice (Meld escapes / spawns Nanoid / takes mech control / destroys system).
- **Ygdriss Mutagenic Radiation** (p. 111): Pilot Keepsake-style permanent narrative effect from proximity, with hostile/friendly branching.

#### Net-new roll tables — partial (8/12)

| Table | Page | Status |
| --- | --- | --- |
| Salvage Cache Table | 10 | Skipped — 11-bucket shape (1, 2-3, 4-5, 6-7, 8-9, 10-11, 12-13, 14-15, 16-17, 18-19, 20) doesn't fit any existing TableSchema discriminator |
| Rumour Table | 11 | ✓ done (`flat`, commit `6379d27d`) |
| Caldera's Edge Random Encounters | 13 | ✓ done (`standard`, commit `6379d27d`) |
| Void Shore Random Encounters | 33 | ✓ done (`standard`) |
| House of the Gods Random Encounters | 55 | ✓ done (`standard`) |
| Irongrad Random Encounters | 71 | ✓ done (`standard`) |
| Irongrad Faction Reaction Table | 71 | Skipped — 8-bucket faction-pick shape (1, 2-4, 5-7, 8-10, 11-13, 14-16, 17-19, 20) doesn't fit any existing discriminator |
| Heart of Ygdriss Removal Table | 64 | ✓ done (`standard`) |
| Hunter Nest | 69 | Not a roll table — descriptive location text only |
| Monkey Wrencher Boobytrap Table | 71 | ✓ done (`standard`) — source typo `10-19` encoded as `11-19` to resolve overlap with `6-10` bucket |
| Emergency EM Pulse Table | 51 | ✓ done (`standard`) |
| Bio-Fauna Table | 55 / 111 | p. 111 (Summon variant) already in dataset as `c02da98d-931f-4850-9b04-a3a1b6a3bc2a`. p. 55 House-of-the-Gods variant skipped — same 8-bucket shape as Faction Reaction Table |

8 net-new roll tables landed; 3 skipped pending TableSchema discriminator additions (out of scope for archival pass per CLAUDE.md "no schema features without explicit user request"); 1 (Hunter Nest) reclassified as descriptive text not a roll table.

#### Net-new guides (Mediator advice + setting) — ✓ done

All 21 net-new RotW guides have been added to `packages/salvageunion-reference/data/guides.json`. All entries use `source: "Reclamation of the Wastes"`, `guideType: "gameplay"`, `guideColor: "#B84C4C"`, and were transcribed verbatim from SUSS Reclamation of the Wastes 1.0 per the exact-text rule. Landed across 6 commits on `suss-update`: `7d4e5abf`, `d3cf0e23`, `09ac6a52`, `28e5e19e`, `2bcbddc1`, `340702c7`.

| Guide | Page | Type |
| --- | --- | --- |
| Reclamation of the Wastes Setting | 4 | Setting orientation |
| What is the Salvage Union? | 5 | Setting / Salvage Union faction primer |
| The Present Day | 5 | Setting timeline |
| Your First Session | 6 | Run-the-game guide |
| Campaign Goals | 6 | Run-the-game guide |
| Starting Play | 6 | Run-the-game guide |
| Campaign Pacing | 7 | Run-the-game guide |
| Exploration | 8 | Travel/exploration procedure |
| Running the Game | 88 | Mediator advice meta-section |
| Setbacks | 88 | Mediator advice |
| Mediator Tough Choices | 90 | Mediator-side complement to existing `Tough Choices` guide |
| Controlling NPCs | 91 | Mediator advice |
| NPC Health and Damage | 91 | NPC mechanics |
| How Do I Balance Combat? | 91 | Mediator advice |
| Answer Lots of Questions | 92 | Mediator advice |
| Encourage Creativity | 93 | Mediator advice |
| Managing Time | 94 | Mediator advice |
| Mechs of the Wasteland | 100 | NPC mech-running guide |
| Denizens of the Wastes | 96 | NPC category overview (Corpos / Wastelanders / Raiders / Creatures / Bio-Titans) |
| Nanite Salvage | 112 | Meld salvage rules |
| Meld Infection | 112 | Meld infection rules |

21 net-new guides. Several (Tough Choices, Reaction Rolls/Morale/Retreat narrative copy on p. 98–99) restate existing rules from a Mediator-perspective angle and are arguably duplicates worth merging into existing guide entries rather than adding.

#### Net-new locations / regions / NPCs / lances

The bulk of pages 12–87 is region/sub-location content. Modeling decision required (see Q3 below) before cataloging. Inventory at a glance (from index p. 116–118):

- **4 Regions:** Caldera's Edge · Void Shore · House of the Gods · Irongrad
- **~50 Areas / sub-locations** spread across the 4 regions (full list in index, e.g. Dumping Grounds, Crater Ridge, Sunbleached Highway, Mile 0 Cafe, Service Station, Camp Pinewood, Bunk Lodges, Stagnant Lake, Communal Lodge, The Geodome, Raging Ocean Adventure Park, The Captain's Eye, Rampage Water Slide, Paradise Pool, The Desalinator, The Rusted Barnacle, Container Town, Container Homes, The Dog House, The Docks, Scrap Graves, Crumbling Loading Wharf, Derelict Turbines, Seawall, Observation Post Exterior, Underground Research Lab, Reinforced Service Bunker, Coastal Observation Station, Monument Point, Nesting Grounds, Spore Factories, Shrine of Ygdriss, Elysia, Seat of the God, Carrion Oasis, Sunken Colony, Scrap Colossus, TDA War Museum, Iron Corridor S/N 51, Comms Tower, Diesel Spires, The Pits, TDA Cryo Bunker, Charnel Pits, Micro District 47, Checkpoint Delta, Central Ministry, Redline Metro West/East, The Silo, Remembrance Garden, Information Ministry, Megadistrict 7, I.N.P.II)
- **~30 named story NPCs** (Driftwood, Judge, Hotdog, Bone-Saw, Pickle, Razor as the 6 pre-made PCs; Miyo, Cowboy, Big Sal, Grimsby, Zayne, Katsuro, Patch, Tariq, Engineer Onishi, Section Commander Sierra, Mason, Mr Brass, Mr Pivot, Bon Bon, Honey, Dane, Duke, Mayor, Cypher Heads, Mime, Spinney, Provost Iona, Scholar Newman, Initiate Digit, Lance Leader Rex Hammer, Tarvich, Malik, plus the 8 TDA holograms in the Remembrance Garden: General Secretary Koba, Minister Benazir, Architect Tarvich, Pilot Helena, Commandant Zhukovsky, Agent Tanya, Professor Kaufman, Spud, Dotty)
- **~10 lances/factions:** Salvage Union (player faction), Sakura Academy, Sakura Habitation Lance, Evantis Industrial Lance, Wrecked Aeon Retrieval Lance, Sakura Academy 'Party' Lance, Opus Research Lance, Kombu Infiltration Lance, Osiris Kill Team, plus corpos (Aeon, TDA-defunct)
- **3 Reclamation Jobs:** Corpo Assassination (p. 29), The Desalinator (p. 42), Reclamation of the Wastes Setting opener (p. 4)
- **1 Mech blueprint reference:** TDA Mech "The Gatecrasher" (Information Ministry database, p. 85) — already added as a chassis in PC pass

#### Coverage analysis vs current data

- **Roll tables** — NPC Action / Reaction Roll / Morale / Retreat (p. 97–99) are all already in `roll-tables.json`. RotW is a reprint here; this is the only RotW content that overlaps existing data.
- **Vehicles / Drones / Turrets / People NPCs / Creatures / Bio-Titans / Meld** — none currently exist in `salvageunion-reference`. Confirmed by absence of corresponding JSON files in `packages/salvageunion-reference/data/`.
- **Locations / Regions / Reclamation Jobs / Lances** — no current schema. These would all be net-new entity types.

#### Mech Monday overlaps

**None.** RotW is a Starter Set–specific campaign and does not reprint MM content.

#### Cross-cutting open question raised by RotW

##### Q3. Schema scope — adding new entity types — ✓ resolved

RotW introduces material spread across three tiers. Decisions captured below.

| Proposed entity type | RotW count | Decision | Rationale |
| --- | --- | --- | --- |
| `vehicles` | 6 | **Tier 1 — add to existing `vehicles.json`** | Well-bounded statblock; schema already exists |
| `drones` | 3 | **Tier 1 — add to existing schema** | Drones already modeled (verify schema covers RotW shape) |
| `turrets` | 3 + 1 loader | **Tier 1 — needs new `turrets.json` or extend `vehicles`** | Currently turrets exist only as actions on parent NPCs |
| `npcs` (people) | 11 (6 individuals + 5 squads) | **Tier 1 — squads → existing `squads.json`, individuals → `npcs.json`** | Both schemas already exist |
| `creatures` | 11 | **Tier 1 — add to existing `creatures.json`** | Schema already exists |
| `bioTitans` | 1 (Ygdriss) | **Tier 2 — add to existing `bio-titans.json`** | Schema already exists |
| `meld` units | 5 | **Tier 2 — add to existing `meld.json`** | Schema already exists (5 entries today) |
| `meld` items (Nanite) | 2 | **Tier 2 — `equipment.json` with category discriminator** | No standalone schema needed |
| `lances` | ~10 | **Tier 1 — add to existing `squads.json`** | Lance = a squad; existing schema covers Thatcher Pit Android Lance, 4 CURNOS Lances, Skinless Jim's Scavengers |
| `regions` | 4 | **Tier 3 — Decision C: do not model** | Stays as PDF reference only |
| `areas` (sub-locations) | ~50 | **Tier 3 — Decision C: do not model** | Stays as PDF reference only |
| `reclamationJobs` | 3 | **Tier 3 — Decision C: do not model** | Stays as PDF reference only |

**Tier 3 = Decision C (do not model).** Regions, areas, sub-locations, and Reclamation Jobs stay as PDF references — suref-web links to them but doesn't render them. Rationale: these are adventure-path content tightly coupled to RotW; modeling them would either bloat the reference package with campaign-specific content or require a parallel `campaign-content` package with cross-package references. Neither pays off given the limited reuse value. The Asset Pack mini-adventure sub-locations (Hive ~10, Thatcher's ~10, Relics ~21) follow the same rule.

Note: turret schema decision is the only remaining open subquestion in Tier 1 — pick "extend vehicles" vs "new schema" at implementation time.

#### Cross-ref backlog

Once Tier 1 schemas land, every entity above gets `source: "Reclamation of the Wastes"` + the page number from the catalog (no booklet code — RotW is single-volume). **Tier 1 + Tier 2 totals: ~40 net-new entities + 12 roll tables + 21 guides = ~73 new data entries from RotW.** Tier 3 content (regions/areas/jobs) is intentionally not modeled per Decision C.

### SUSS Campaign Map 1.0 — surveyed

Single-page visual region map of Caldera (RotW campaign region). Pure graphical aid showing the four regions (Verdant Crescent, Ferrous Range, Caldera, Plains of Salt and Smoke), Crawler #430 starting position, and named locations from RotW.

**Net-new content:** none — every label corresponds to a location already cataloged in the RotW findings above. The map itself may be worth shipping as a static image asset under `apps/suref-web` if/when Tier 3 region/area schemas land, but it does not introduce new entities, mechanics, or rules.

**Backfill targets:** none.

### Asset Pack (Hive / Thatcher's Mech Base / Relics / Sticker Sheets) — surveyed

The Asset Pack ships four self-contained mini-adventures plus a sticker sheet cataloging 10 net-new mech equipment items. All four mini-adventures are net-new content — none of these locations, NPCs, or systems exist in current SU-SRD data. The Char/Mech/Crawler Sheets PDF (in the RotW directory but functionally part of the asset pack) is a print-ready consolidation of the six pre-made pilots already cataloged in the RotW findings.

#### The Hive 1.0 (2 pages)

Mini-adventure: a derelict Bee-themed mech facility ruled by an AI Holo-Companion (Dr Mortimer Apis) and his still-living daughter Dr Regina Apis.

**Net-new chassis patterns (Mazonas + Atlas):**

| Pattern | Chassis | Notes |
| --- | --- | --- |
| Madrona Pattern Mazonas | Mazonas | Bee-themed scout build |
| Bomblebee Pattern Mazonas | Mazonas | Suicide-bomber variant |
| Killer Pattern Mazonas | Mazonas | Drone-swarm assault build |
| Queen Bee Pattern Atlas | Atlas | Boss/leader build for Dr Regina Apis |

**Net-new NPCs:**
- **Dr Mortimer Apis** — AI Holo-Companion (statblock implies non-corporeal NPC). Source/host of the Hive's automated systems.
- **Dr Regina Apis** — human survivor / hive matriarch. Pilots Queen Bee Pattern Atlas.

**Net-new roll tables:**
- Hive Rumour Table (d6 or d20 — to confirm on re-read; flavor for crawler cantina hooks)
- Hive Random Encounters
- Crater Field Minefield Table

**Net-new locations (sub-areas of the Hive complex):** Crater Field, Greenhouse, Meadows, Hive Entrance, Hive Refinery, Hive Workshop, Brood Cells, Fuel Storage, Queen's Chambers, Reactor Core (~10 areas).

**Net-new terminology:** "Mech Bay" — a Tech-Leveled facility analogous to the Crawler's Mech Bay, found at fixed locations. Worth flagging as a glossary candidate.

#### Thatcher's Mech Base 1.0 (2 pages)

Mini-adventure: an android-staffed mech base run by The Iron Lady (corrupted titan-class android boss).

**Net-new boss / titan:**
- **The Iron Lady** — 87 SP titanic NPC. Three Titanic Actions including TRIDENT Missile Pod (Irradiated trait), M.I.L.K. Injector reaction, Control Signal hacking ability.

**Net-new NPCs:**
- Thatcher Pit Android (2 SP) — mook
- Skull Drone (2 SP) — mook drone
- Super Android Soldier (9 SP) — elite mook
- Super Android Strikebreaker (15 SP, Fast trait) — elite
- Churchill (12 SP, Fast) — pitbull-android hybrid
- Android Osborne (12 HP, character-stat) — humanoid android
- Hogg (2 SP) — pig-android hybrid
- Dennis (15 SP, Immobile) — turret-head emplaced unit
- Browning — Skull Drone variant (+2 SP)

**Net-new lance:**
- Thatcher Pit Android Lance — composition: Thatcher Pit Androids + Skull Drone(s) (exact count to confirm)

**Net-new mech systems / pilot equipment:**
- **AMS Micro Laser** (T1 mech system) — includes 1EP Solder ability for repair-in-the-field
- Reinforced Polycarbonate Shield (pilot equipment)
- Steel Billy Club (pilot melee weapon)
- Broad Koch Submachine Gun (pilot ballistic weapon)
- T2S2 Grenade (pilot explosive)
- Electro-Whip (pilot melee, energy/shock)

**Net-new traits:**
- **Irradiated** — used by TRIDENT Missile (also referenced by Thresher's Self-Destruct in Char Sheets PDF — see below). Irradiated terrain mechanic should be modeled as a keyword. *Backfill candidate: this trait may already implicitly exist in WM Self-Destruct; needs cross-check during Q2 traits/keywords pass.*

**Net-new locations:** ~10 sub-areas of the mech base (specific room names to re-read from PDF when modeling).

#### Relics of a Time Gone By 1.0 (2 pages)

Mini-adventure: explore a multi-level pre-Cataclysm ruin staffed by AI entities (CURNOS + PAX) and contested by Skinless Jim's Scavengers.

**Net-new AI entities (NPC, non-corporeal):**
- **CURNOS** (42 SP) — primary AI antagonist
- **PAX** — secondary AI (statblock smaller; specific SP to re-read)

**Net-new mech module:**
- **Coolant Flow Manifold** (T?, slot/SV to re-read) — heat-management module

**Net-new pilot equipment:**
- **Growth Formula** (spray) — botanical/biological equipment

**Net-new chassis pattern:**
- **All is Dust Pattern Atlas** — Atlas variant for the boss encounter

**Net-new NPCs (Skinless Jim's Scavengers — 4-person lance):**
- Skinless Jim (Trooper)
- Gorgut (Raider)
- Ayana (Raider)
- Dragonfly (Raider)

**Net-new lances:**
- CURNOS Alpha Lance
- CURNOS Beta Lance
- CURNOS Gamma Lance
- CURNOS Survey Lance

**Drone references (no statblocks given — assumed already in WM or Tier 1 RotW):** Heavy Combat Drone, Hover Drone, Walker Drone, Combat Drone, Pest Drone, Defacer Drone, Salvo Drone, Analysis Pattern Gopher. *Backfill flag: cross-check WM data — if any are missing, RotW has Drone statblocks for several; otherwise this PDF references but does not redefine them.*

**Net-new tables:**
- Random Encounters (Relics-specific)
- Salvage Table (Relics-specific)

**Net-new locations:** 21 sub-locations across Top Level / Upper Level / Mid Level / Lower Level (room/floor structure to re-read).

#### Asset Pack Sticker Sheets 1.0 (3 pages)

Sticker sheets cataloging 10 net-new mech equipment items, organized by manufacturer (Evantis Heavy Industries, Opus Institute, Sakura). All entries are full game-data-ready (Tech Level / Slots / Salvage Value / type / range / damage / abilities). Source/booklet target: `Salvage Union Starter Set`, booklet `AP` (Asset Pack — see Q1 for the full booklet code list).

| Item | Manufacturer | TL/SS/SV | Type | Notes |
| --- | --- | --- | --- | --- |
| Cluster Missile | Evantis | T4/7/5 | System (Far range, 3 SP, Explosive(3), Guided, Uses(6)) | Explosive radius hits Medium instead of Close |
| Analogue Internals | Evantis | T1/1/3 | Module (Passive) | Blocks Hacking targeting + ECM Transmitter; disables host's Hacking/Communicator/Targeter abilities |
| Targeting Reticule | Evantis | T2/1/2 | Module (Targeter, 1EP Free Action) | Reroll next Ballistic/Laser attack |
| IFF Beacon | Evantis | T3/2/2 | Module (1EP Long Turn Action) | Identify Mech friendly/chassis/pattern/faction |
| Surge Protector | Opus | T1/1/1 | Module | Ignore Reactor Overheat roll (destroy module + reduce Heat by 1 instead) |
| Remote Transponder | Opus | T4/1/2 | Module (1EP Turn Action) | Activate Hacking/Targeter/Scanner/Communicator on friendly Mech with Remote Transponder |
| Impact Hammer | Opus | T3/7/6 | System (Close, 3 SP, Melee) | "Hammer Time" ability (1EP Turn — next attack within 10 min deals 2× damage; breaches blast doors) |
| EM Counterpulse | Sakura | T3/1/2 | Module (1EP Medium Turn Action) | Friendly Mechs in range cannot be prevented from activating Hacking/Scanner/Communicator/Targeter/Shield |
| Adaptive Chassis Linkage | Sakura | T6/1/2 | Module | Links 2 Mechs into one (combined SP/EP/Heat, shared abilities, double turns); grants "Combo Attack" ability |
| Mozart's Ghost | Sakura | T5/1/2 | Module (2EP Medium Turn Action, Hacking) | Create ghost copy of target Mech; activate its Hacking/Targeter/Scanner/Communicator for 1 hour |

**Backfill flag:** several abilities here reference traits/keywords that may be net-new (Guided, Hacking-blocking, "Communicator-trait" interactions). Sweep during Q2 keywords pass.

#### SUSS Char/Mech/Crawler Sheets 1.0 (13 pages)

Print-ready pre-made character sheets for the six RotW pre-made pilots + Crawler #430. **All content is reprinted from the RotW PDF and cross-referenced in those findings above.** Confirmed roster:

| Character | Class | Mech Pattern (Chassis) | Notable abilities/equipment |
| --- | --- | --- | --- |
| Bonesaw | Engineer | Swiss Cheese Pattern Scrapper | Eggs Mayhem (hacking program) |
| Pickle | Hacker | Pyrotechnic Pattern Spectrum | A Little Bit Rude (1EP), Eggs Mayhem, Loudspeakers, FM-3 Flamethrower, Firewall |
| Judge | Hauler | Survivor Pattern Mule | Read a Person ability; Mule has Integrated Cargo Bay (Cargo Cap +10→16) |
| Driftwood | Salvager | Mr Dig Pattern BobCat | "Squeeze it in" (1AP Turn), BobCat has Integrated Scrap Magnet (1EP Turn — 12 cargo slots magnetic carry) |
| Hotdog | Scout | Pop Pattern Mazona | "You Shot First" (2AP Free Action — auto-act-first/init-20); Mazona has Integrated Hover Drone (Hover Locomotion) |
| Razor | Soldier | Slugger Pattern Thresher | "Provoke" (1AP Turn); Thresher has Heavily Armoured Chassis (Nailed It crits count as standard hits) + Self-Destruct (Irradiated terrain) |

**Crawler #430 ("Tenacity")** — Exploratory Crawler, 20 SP, T1, 5 upgrade total. **Bays (10):** Command, Mech, Armament (with Mini Mortar T1), Crafting, Trading, Med, Pilot, Armoury, Cantina, Storage. **Crew (10 Wasteland NPCs):** Cara 'Blaze' Voss (Princeps), Yuri 'Tinker' Petrov (Greaser), Sergio 'Grip' Cruz (Gunny), Danika 'Artificer' Gujar (Forger), Olivia 'Tout' Ortega (Operator), Maya 'Hale' Turner (Doc), Shariq 'Hawk' Rahimi (Ace), Paloma 'Hammer' Fane (Smith), Jaxon 'Blazemaker' Todd (Chef), Sofia 'Stormcrow' Costa (Bullwhacker). All 4 HP. Hannah 'Trek' Lane = Wasteland Explorer (4 HP). Crawler ability: All Terrain Locomotion + Wasteland Explorer (1×/Downtime, 2 questions about an area).

**Backfill flag:** if RotW pre-mades are modeled as `players` data (or a new `pre-made-characters` schema), this PDF is the single canonical source for the print-ready stat blocks. Same source as RotW (`source: "Reclamation of the Wastes"`, no booklet code).

#### Asset Pack — schema scope summary

The asset-pack mini-adventures push the same Tier 3 question raised in RotW (regions / areas / lances / NPCs as schemas vs as a separate `campaign-content` package). Three of the four mini-adventures (Hive, Thatcher's, Relics) introduce new lances, location hierarchies, and named NPCs that don't fit cleanly into existing schemas. Recommend deferring all four mini-adventures behind the Q3 Tier 3 decision.

The sticker-sheet equipment (10 items) is the **only Asset Pack content that can land immediately** under existing schemas (`mechSystems` + `mechModules`) — it's the highest-ROI quick win in this PDF set.

#### Asset Pack — cross-ref backlog estimate

| Source | Net-new entities (immediate) | Net-new entities (Tier 3 deferred) |
| --- | --- | --- |
| The Hive | 4 patterns + 2 NPCs + 3 tables | ~10 locations |
| Thatcher's Mech Base | 1 system (AMS Micro Laser) + 9 NPCs + 5 pilot equipment + 1 trait + 1 lance | ~10 locations + 1 titanic boss schema decision |
| Relics of a Time Gone By | 1 module + 1 pilot equipment + 1 pattern + 4 NPCs + 4 lances + 2 tables | ~21 locations + AI-entity NPC category |
| Sticker Sheets | 10 mech systems/modules | 0 |
| Char/Mech/Crawler Sheets | 0 (cross-ref RotW) | 0 |
| **Total (immediate)** | **~36 entities + 5 tables + 1 trait** | **~41 locations + 2 schema decisions** |

#### Asset Pack landing status (2026-05-11)

| Item | Status |
| --- | --- |
| Hive: 4 chassis patterns (Madrona, Bomblebee, Killer, Queen Bee Atlas) | ✓ done |
| Hive: Random Encounters + Minefield roll tables | ✓ done |
| Hive: Dr Mortimer Apis, Dr Regina Apis NPCs | Skipped — narrative-only in source PDF (Mortimer in stasis pod, Regina pilots Queen Bee Atlas); no statblocks to transcribe |
| Thatcher's: AMS Micro Laser system + Coolant Flow Manifold module | ✓ done |
| Thatcher's: 7 NPCs (Pit Android, Skull Drone, Super Android Soldier/Strikebreaker, Churchill, Dennis, Android Osborne, Hogg, Browning) | ✓ done |
| Thatcher's: The Iron Lady (titanic boss in npcs.json) | ✓ done |
| Thatcher's: Thatcher Pit Android Lance | ✓ done |
| Thatcher's: Steel Billy Club pilot equipment | ✓ done (no-stat entry per source) |
| Thatcher's: Reinforced Polycarbonate Shield + Growth Formula equipment | ✓ done (already present from WM / Relics) |
| Thatcher's: Broad Koch SMG, T2S2 Grenade, Electro-Whip | Encoded as NPC actions (already in actions.json) — source treats them as NPC armaments, not pilot equipment |
| Relics: CURNOS + PAX NPCs | CURNOS done (npcs.json); PAX skipped — narrative-only in source PDF |
| Relics: Skinless Jim, Gorgut, Ayana, Dragonfly | Skipped — source labels them as named pilots using existing Trooper/Raider NPC stats; no separate statblocks |
| Relics: 4 CURNOS Lances + Skinless Jim's Scavengers | ✓ done (composition-only entries; source provides no aggregate HP/damage type) |
| Relics: Random Encounters + Salvage Table roll tables | ✓ done |
| Relics: Coolant Flow Manifold module + All is Dust Pattern Atlas + Growth Formula equipment | ✓ done |
| Sticker Sheets: 10 mech systems/modules | ✓ done |
| Char/Mech/Crawler Sheets: 6 RotW pre-made pilots | Deferred — needs `players.json` or `pre-made-characters` schema decision |
