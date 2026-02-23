# Long-Term Goals: Salvage Union Rules vs ITUN Gap Analysis

## Context

Comprehensive audit of every Salvage Union game mechanic encoded in `salvageunion-reference` cross-referenced against what the ITUN app currently supports. Surfaces every gap from critical missing gameplay features to nice-to-haves.

---

## What ITUN Fully Supports Today (26 Mechanics)

| Mechanic | Status |
|----------|--------|
| Pilot creation (wizard, all guide steps) | Done |
| Class selection (6 core + 5 hybrid) | Done |
| Ability selection (level 1 from core trees) | Done |
| Equipment selection (pilot gear) | Done |
| Roll tables (callsign, background, motto, keepsake, appearance) | Done |
| Mech creation (chassis, systems, modules, budget) | Done |
| Pattern system (save, load, share mech configurations) | Done |
| Capacity enforcement (slots, cargo, scrap budget) | Done |
| Condition tracking (intact/damaged/destroyed on systems, modules, abilities, equipment) | Done |
| Live stat editing (HP, AP, TP, SP, EP, Heat) | Done |
| Crawler creation (type selection, weapon mounting, NPC naming) | Done |
| Crawler tech level display + upgrade with scrap cost | Done |
| Scrap inventory (TL1-TL6 tiers, translation between tiers) | Done |
| Cargo management (custom items, ref-linked items, capacity) | Done |
| Game/campaign creation and basic management | Done |
| Pilot-to-crawler assignment | Done |
| Member roster (mediator/player roles) | Done |
| Realtime subscriptions (live sync across clients) | Done |
| Change logging + activity feed (toast notifications) | Done |
| Comrade/drone display from mech entity refs | Done |
| Comrade EP tracking + custom naming | Done |
| Comrade action availability rules (pilot-sourced vs mech-sourced) | Done |
| Player choices (roll results, freeform text, selections) | Done |
| Visibility toggles (public/private entities) | Done |
| Background/motto/keepsake "used" flags | Done |
| RLS + shared access policies (campaign members, crawler crew) | Done |

---

## Gap Analysis: What's Missing (22 Gaps)

### Tier 1 -- Core Gameplay Loops Not Yet Supported

These are mechanics that players use every session and are central to the game.

#### 1. Action Execution (AP/EP/SP/HP Spending)

**Rule:** Actions cost resources (EP, AP, SP, HP). Players spend these to activate abilities, fire weapons, use systems. This is THE core combat loop.

**Current state:** Actions are displayed with their costs, but clicking an action does nothing to the resource pools. Players must mentally track spending and manually edit stats.

**Gap:** No "use this action" button that deducts the cost from the appropriate stat. No heat generation from actions. No validation that the player has enough resources.

**Impact:** High -- this is every turn of every combat encounter.

#### 2. Damage Application

**Rule:** When a mech takes SP damage, systems/modules can become damaged or destroyed. When a pilot takes HP damage, injuries can occur. Specific damage thresholds trigger condition changes.

**Current state:** Condition can be manually toggled (intact -> damaged -> destroyed), but there's no automated damage flow. No "take X damage" button that auto-applies to SP and potentially cascades to equipment conditions.

**Gap:** Manual-only damage tracking. No guided damage resolution.

**Impact:** High -- damage happens every combat round.

#### 3. Heat Management

**Rule:** Certain actions generate heat. Exceeding heat capacity triggers overheat effects. Heat resets during downtime.

**Current state:** Heat is tracked as a number (current/max), but there's no connection between actions and heat generation. No overheat warning or effect.

**Gap:** Heat is a passive number, not an active mechanic.

**Impact:** Medium-High -- heat management is a key tactical decision.

#### 4. Pushing Mechanics

**Rule:** Pilots can "Push" to gain extra actions or effects at a cost (take damage, gain heat, etc.). This is a core risk/reward mechanic.

**Current state:** Not implemented. The rules exist in guides but no UI for pushing.

**Gap:** Entirely missing gameplay mechanic.

**Impact:** Medium -- used frequently in tense moments.

---

### Tier 2 -- Progression & Downtime (Between-Session Mechanics)

#### 5. Downtime Wizard / Flow

**Rule:** Between sessions, a 10-step downtime process occurs: tally salvage, pay upkeep, restore stats, repair equipment, trade scrap, craft items, customize mechs, train abilities, obtain equipment, gather rumors.

**Current state:** `in_downtime` flag exists on pilots. Scrap tracking exists. Individual pieces work (stat editing, condition editing, tech level upgrade). But there's no guided flow walking through the steps.

**Gap:** No structured downtime flow. Players must manually perform each step and remember the order. No upkeep enforcement. No auto-restore of stats/heat/conditions.

**Impact:** High -- happens every session transition.

#### 6. Ability Training / Progression UI

**Rule:** Pilots earn 1 Training Point per downtime week. Spend TP to learn new abilities (1 TP for core, 2 TP for advanced). Must respect tree prerequisites (need all 3 levels in a tree to access advanced).

**Current state:** TP is tracked as a number. Ability tree data and prerequisite rules exist in the reference package. But there's no UI for "spend TP to learn a new ability" with prerequisite validation.

**Gap:** No training flow. Players must manually add abilities and decrement TP.

**Impact:** Medium -- happens during downtime, typically once per session.

#### 7. Class Advancement / Hybridization

**Rule:** After meeting prerequisites (6+ core abilities, all 3 in a prerequisite tree), pilots can advance to an Advanced Class or become a Hybrid. This is a one-time major progression event.

**Current state:** Class data includes `advancedTree`, `legendaryTree`, and hybrid class definitions. But there's no UI for the advancement ceremony.

**Gap:** No class change UI. Players would need to manually edit their class reference.

**Impact:** Low-Medium -- happens once per character, but it's a meaningful moment.

#### 8. Crafting System

**Rule:** During downtime, players can craft any item (chassis, systems, modules, equipment) by spending scrap of the appropriate tech level equal to the item's salvage value.

**Current state:** Scrap inventory exists. Item salvage values are displayed. But there's no "craft this item" button that deducts scrap and adds the item.

**Gap:** No crafting flow connecting scrap spending to item acquisition.

**Impact:** Medium -- used during downtime to upgrade equipment.

#### 9. Salvage Tallying

**Rule:** After a mission, destroyed/unused items are converted back to scrap of their tech level.

**Current state:** No automated salvage conversion.

**Gap:** Players must manually add scrap and remove items.

**Impact:** Medium -- happens every session end.

---

### Tier 3 -- Multiplayer & Campaign Features

#### 10. Invite Code Join Flow (UI)

**Rule:** Players join games via invite codes.

**Current state:** `invite_code` column exists on campaigns. Mediators can (presumably) see the code. But there's no "Join Game" UI where a player enters a code.

**Gap:** The join flow UI is missing. DB infrastructure exists.

**Impact:** Medium -- blocks new players from joining campaigns without direct DB access.

#### 11. Campaign Archiving UI

**Rule:** Games can be archived (preserved but hidden from active lists).

**Current state:** `archived` column exists. But no archive/restore button in UI.

**Gap:** UI-only gap.

**Impact:** Low -- nice-to-have for campaign management.

#### 12. Rumor Gathering

**Rule:** During downtime, each pilot can gather 1 rumor from the Cantina NPC. Rumors provide mission hooks.

**Current state:** Not implemented.

**Gap:** No rumor system. Would need a way for mediators to create rumors and players to "gather" them.

**Impact:** Low -- narrative mechanic, easily handled verbally.

---

### Tier 4 -- Reference Data Gaps (Viewable in SRD, Not Interactive in ITUN)

#### 13. NPC / Enemy Management

**Rule:** GMs/mediators run NPCs, creatures, bio-titans, meld, squads, and factions in encounters.

**Current state:** NPC data exists in the reference package and renders in the SRD site. But ITUN has no way for a mediator to stage, track, or manage enemies during play.

**Gap:** No encounter/enemy tracking. Mediators must use external tools or the SRD.

**Impact:** Medium for mediators, zero for players.

#### 14. Faction & Formation Tracking

**Rule:** Factions have goals, assets, weaknesses, and formations (preset mech groups).

**Current state:** Data exists in reference. No ITUN integration.

**Gap:** No faction tracking in campaigns.

**Impact:** Low -- narrative/GM tool.

#### 15. Vehicle Management

**Rule:** Non-mech vehicles exist (cars, trucks, boats).

**Current state:** Vehicle data exists in reference. No ITUN integration.

**Gap:** Cannot track vehicles in ITUN.

**Impact:** Low -- rarely used.

#### 16. Creature / Bio-Titan / Meld Encounter Tracking

**Rule:** Various enemy types with HP/SP, actions, traits.

**Current state:** Data exists in reference, renders beautifully in SRD. No ITUN encounter management.

**Gap:** No way to track enemy HP/conditions during encounters.

**Impact:** Medium for mediators.

---

### Tier 5 -- Edge Cases & Nice-to-Haves

#### 17. Dice Rolling Integration

**Rule:** Many actions require d20 rolls. Roll tables use d20. Some tables are multi-column (2d20).

**Current state:** Roll tables render with "ROLL" buttons that generate random results. But general-purpose dice rolling for action resolution doesn't exist.

**Gap:** No integrated dice roller for combat/skill checks.

**Impact:** Low -- players typically use physical dice or external apps.

#### 18. Blackmarket Items

**Rule:** Some items are flagged as "blackmarket" (rare, expensive, may require special access).

**Current state:** `blackmarket` flag exists on items in reference data. Renders in SRD.

**Gap:** No special handling in ITUN builder -- blackmarket items can be selected like any other.

**Impact:** Very Low -- flavor/narrative restriction.

#### 19. Crawler Bay Damage Effects

**Rule:** When crawler bays are damaged, specific effects occur (medical bay can't heal, cantina rumors unreliable, etc.).

**Current state:** Bay NPCs are tracked as JSON. No bay damage/condition system.

**Gap:** No bay condition tracking.

**Impact:** Low -- rarely comes up.

#### 20. Crawler Population / Settlement Flavor

**Rule:** Each tech level has a population range and settlement type (Hamlet -> Megacity).

**Current state:** Tech level names and stats exist. Population flavor text not displayed.

**Gap:** Cosmetic only.

**Impact:** Very Low.

#### 21. Image Uploads

**Rule:** Players can customize their pilot/mech appearance.

**Current state:** `image_path` fields exist but only accept URLs. No upload flow.

**Gap:** No image upload to Supabase Storage.

**Impact:** Low -- URLs work as a workaround.

#### 22. Export / Import

**Rule:** N/A (app feature, not game rule).

**Current state:** Not implemented.

**Gap:** No way to export a pilot/mech sheet as PDF or share data.

**Impact:** Low -- would be nice for table play.

---

## Priority Matrix

| Priority | Gap | Gameplay Impact | Effort |
|----------|-----|----------------|--------|
| **P0** | Action Execution (AP/EP spending) | Every combat turn | Medium |
| **P0** | Downtime Flow (guided 10-step) | Every session transition | Large |
| **P1** | Heat Management (action -> heat link) | Every combat turn | Small-Medium |
| **P1** | Damage Application (guided flow) | Every combat round | Medium |
| **P1** | Ability Training UI | Every downtime | Medium |
| **P1** | Invite Code Join Flow | Onboarding blocker | Small |
| **P2** | Pushing Mechanics | Frequent in combat | Small |
| **P2** | Crafting System | Every downtime | Medium |
| **P2** | Salvage Tallying | Every session end | Small-Medium |
| **P2** | Class Advancement UI | Once per character | Medium |
| **P2** | NPC/Enemy Encounter Tracking | Every combat (mediator) | Large |
| **P3** | Campaign Archive UI | Campaign management | Tiny |
| **P3** | Rumor Gathering | Downtime flavor | Small |
| **P3** | Bay Damage Tracking | Rare events | Small |
| **P3** | Dice Rolling Integration | Every session | Medium |
| **P4** | Faction/Formation Tracking | GM tool | Medium |
| **P4** | Vehicle Management | Rare usage | Small |
| **P4** | Creature/Bio-Titan Tracking | GM encounters | Medium-Large |
| **P4** | Image Uploads | Cosmetic | Small |
| **P4** | Export/Import (PDF sheets) | Convenience | Medium |
| **P4** | Blackmarket Enforcement | Flavor | Tiny |
| **P4** | Population Flavor Text | Cosmetic | Tiny |

---

## Overlap with Phase 5II Deferred Items

These gaps overlap with items explicitly deferred in the Phase 5II planning:

- **Action Execution** -- deferred as "action execution (AP/EP onClick)"
- **Downtime Wizard** -- deferred as "downtime wizard"
- **Class Advancement UI** -- deferred as "class advancement UI"
- **Rollback UI** -- deferred (change_log infrastructure exists)

Everything else in the gap list above is **not currently on any roadmap**.

---

## Race Conditions (Multiplayer Blockers)

7 non-atomic multi-table operations that need RPC migration before multiplayer is reliable:

- `createGame`
- `createPilot`
- `createCrawler`
- `instantiateMechFromPattern`
- `updateMechEntityRefs`
- `updateCrawlerWeapon`
- `joinGame`

These are tracked in `plan-docs/audit-follow-up.md`.
