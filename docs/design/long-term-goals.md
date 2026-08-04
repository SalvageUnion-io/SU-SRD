# Long-Term Goals: Salvage Union Rules vs ITUN Gap Analysis

> ## ⚠️ HISTORICAL FRAMING — the mechanics audit is live, the infrastructure framing is not
>
> _Framing note added 2026-07-03; **corrected and moved here from `plan-docs/`
> on 2026-08-03** — the 2026-07-03 note asserted things that are no longer
> true._
>
> **1. The original hosted stack was dropped.** Everything this document
> describes in terms of **Supabase/Postgres** — row-level security (RLS),
> Postgres realtime subscriptions, and RPC migrations to make multiplayer writes
> atomic — belonged to an earlier stack that was abandoned. ITUN's on-device
> layer is IndexedDB
> ([ADR-002](../adrs/ADR-002-indexeddb-idb-zod.md)), and anonymous cross-device
> sharing still happens through immutable, unauthenticated snapshots on Netlify
> Functions + Blobs
> ([ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md)).
>
> **2. Multi-user Games are NOT deferred — they shipped.** The 2026-07-03 note
> said there was "no auth and no application backend" and that Games were
> "explicitly deferred under ADR-001". **That is now false.** Accounts, Games,
> member rosters with mediator/player roles, invite-code join flows and realtime
> sync are all built on **Convex as the server of record** — see
> [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md) (**governing**;
> supersedes ADR-001),
> [architecture/accounts-and-games.md](../architecture/accounts-and-games.md),
> [game-invites-and-membership-plan.md](./game-invites-and-membership-plan.md)
> (**Status: BUILT**), and `apps/itun/convex/{games,invites,proposals,mediator}.ts`.
> Read this document's multiplayer **implementation** notes as historical (the
> mechanism is Convex, not Supabase/RLS/RPC) while treating the **capability**
> as delivered. In particular, the inventory and matrix rows struck through
> below as `(historical — abandoned, see note at top)` — member roster, realtime
> subscriptions, the "Invite Code Join Flow" P1 row — describe a shipped feature
> under a different implementation; they are left physically intact per this
> doc's purpose rather than rewritten.
>
> **3. The game-mechanic gap analysis remains current.** The supported-vs-gaps
> inventory and the P0–P4 priority matrix are an accurate audit of Salvage Union
> mechanics against ITUN and are independent of the storage layer — read those
> as live. They are the reason this document is kept.

## Context

Comprehensive audit of every Salvage Union game mechanic encoded in `salvageunion-reference` cross-referenced against what the ITUN app currently supports. Surfaces every gap from critical missing gameplay features to nice-to-haves.

---

## What ITUN Fully Supports Today (26 Mechanics)

| Mechanic                                                                                                    | Status     |
| ----------------------------------------------------------------------------------------------------------- | ---------- |
| Pilot creation (wizard, all guide steps)                                                                    | Done       |
| Class selection (6 core + 5 hybrid)                                                                         | Done       |
| Ability selection (level 1 from core trees)                                                                 | Done       |
| Equipment selection (pilot gear)                                                                            | Done       |
| Roll tables (callsign, background, motto, keepsake, appearance)                                             | Done       |
| Mech creation (chassis, systems, modules, budget)                                                           | Done       |
| Pattern system (save, load, share mech configurations)                                                      | Done       |
| Capacity enforcement (slots, cargo, scrap budget)                                                           | Done       |
| Condition tracking (intact/damaged/destroyed on systems, modules, abilities, equipment)                     | Done       |
| Live stat editing (HP, AP, TP, SP, EP, Heat)                                                                | Done       |
| Crawler creation (type selection, weapon mounting, NPC naming)                                              | Done       |
| Crawler tech level display + upgrade with scrap cost                                                        | Done       |
| Scrap inventory (TL1-TL6 tiers, translation between tiers)                                                  | Done       |
| Cargo management (custom items, ref-linked items, capacity)                                                 | Done       |
| Game/campaign creation and basic management                                                                 | Done       |
| Pilot-to-crawler assignment                                                                                 | Done       |
| ~~Member roster (mediator/player roles)~~ (historical — abandoned, see note at top)                         | Historical |
| ~~Realtime subscriptions (live sync across clients)~~ (historical — abandoned, see note at top)             | Historical |
| Change logging + activity feed (toast notifications)                                                        | Done       |
| Comrade/drone display from mech entity refs                                                                 | Done       |
| Comrade EP tracking + custom naming                                                                         | Done       |
| Comrade action availability rules (pilot-sourced vs mech-sourced)                                           | Done       |
| Player choices (roll results, freeform text, selections)                                                    | Done       |
| Visibility toggles (public/private entities)                                                                | Done       |
| Background/motto/keepsake "used" flags                                                                      | Done       |
| ~~RLS + shared access policies (campaign members, crawler crew)~~ (historical — abandoned, see note at top) | Historical |

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

### Tier 3 -- Multiplayer & Campaign Features (historical — superseded, see note at top)

_This entire tier assumed the abandoned Supabase multi-user backend (Postgres campaigns, RLS, invite codes, member roles), so its "DB infrastructure exists" claims no longer hold and the gaps below are preserved only as written history. **The capabilities themselves are no longer deferred — they shipped on Convex** under [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md) (which supersedes ADR-001): Games, member rosters with mediator/player roles, invite-code join flows and realtime sync are all built. See [architecture/accounts-and-games.md](../architecture/accounts-and-games.md) and [game-invites-and-membership-plan.md](./game-invites-and-membership-plan.md) for the delivered design._

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

**Gap:** No image upload flow (URLs only).

**Impact:** Low -- URLs work as a workaround.

#### 22. Export / Import

**Rule:** N/A (app feature, not game rule).

**Current state:** Not implemented.

**Gap:** No way to export a pilot/mech sheet as PDF or share data.

**Impact:** Low -- would be nice for table play.

---

## Priority Matrix

| Priority | Gap                                   | Gameplay Impact          | Effort       |
| -------- | ------------------------------------- | ------------------------ | ------------ |
| **P0**   | Action Execution (AP/EP spending)     | Every combat turn        | Medium       |
| **P0**   | Downtime Flow (guided 10-step)        | Every session transition | Large        |
| **P1**   | Heat Management (action -> heat link) | Every combat turn        | Small-Medium |
| **P1**   | Damage Application (guided flow)      | Every combat round       | Medium       |
| **P1**   | Ability Training UI                   | Every downtime           | Medium       |
| **P1**   | Invite Code Join Flow                 | Onboarding blocker       | Small        |
| **P2**   | Pushing Mechanics                     | Frequent in combat       | Small        |
| **P2**   | Crafting System                       | Every downtime           | Medium       |
| **P2**   | Salvage Tallying                      | Every session end        | Small-Medium |
| **P2**   | Class Advancement UI                  | Once per character       | Medium       |
| **P2**   | NPC/Enemy Encounter Tracking          | Every combat (mediator)  | Large        |
| **P3**   | Campaign Archive UI                   | Campaign management      | Tiny         |
| **P3**   | Rumor Gathering                       | Downtime flavor          | Small        |
| **P3**   | Bay Damage Tracking                   | Rare events              | Small        |
| **P3**   | Dice Rolling Integration              | Every session            | Medium       |
| **P4**   | Faction/Formation Tracking            | GM tool                  | Medium       |
| **P4**   | Vehicle Management                    | Rare usage               | Small        |
| **P4**   | Creature/Bio-Titan Tracking           | GM encounters            | Medium-Large |
| **P4**   | Image Uploads                         | Cosmetic                 | Small        |
| **P4**   | Export/Import (PDF sheets)            | Convenience              | Medium       |
| **P4**   | Blackmarket Enforcement               | Flavor                   | Tiny         |
| **P4**   | Population Flavor Text                | Cosmetic                 | Tiny         |

---

## Overlap with Phase 5II Deferred Items (historical — abandoned, see note at top)

_"Phase 5II" was planning under the abandoned backend stack; the references below are historical. The underlying **game-mechanic** gaps (Action Execution, Downtime Wizard, Class Advancement UI) remain current — see the priority matrix above._

These gaps overlap with items explicitly deferred in the Phase 5II planning:

- **Action Execution** -- deferred as "action execution (AP/EP onClick)"
- **Downtime Wizard** -- deferred as "downtime wizard"
- **Class Advancement UI** -- deferred as "class advancement UI"
- **Rollback UI** -- deferred (change_log infrastructure exists — historical, part of the abandoned backend)

Everything else in the gap list above is **not currently on any roadmap**.

---

## Race Conditions (Multiplayer Blockers) (historical — superseded, see note at top)

_This section is moot **as written**: it enumerated operations that would have needed atomic Postgres RPC migrations in the abandoned Supabase stack. Multiplayer itself is no longer hypothetical — it shipped on Convex ([ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md)), whose mutations are transactional by construction, so the RPC-migration framing below has no successor task._

~~7 non-atomic multi-table operations that need RPC migration before multiplayer is reliable:~~

- `createGame`
- `createPilot`
- `createCrawler`
- `instantiateMechFromPattern`
- `updateMechEntityRefs`
- `updateCrawlerWeapon`
- `joinGame`
