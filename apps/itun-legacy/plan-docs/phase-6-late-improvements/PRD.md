# Phase 6 — Late Phase Improvements

## Scope

Polish and gameplay features that build on the complete foundation from Phases 1-5. Includes real-time data, change tracking with rollback, live sheet editing, crawler downtime flow, ability progression, and crawler upgrading.

**What ships:**

- Real-time data via Supabase Realtime (live updates to character sheets)
- Change tracking: every edit logged to `change_log` with descriptions and rollback support
- Editable pilot stats (HP/AP/TP, identity "used" toggles)
- Editable mech state (SP/EP/Heat, component conditions)
- Crawler downtime button (triggers "Crawler Downtime" guide for all assigned pilots)
- Ability training/progression (ability tree prerequisites enforced)
- Crawler upgrading (tech level progression, scrap-based)

---

## User Stories

### Real-Time Data

- **US-L1**: As a crawler crewmate, when another player modifies their pilot/mech data, I see the change in real time without refreshing.
- **US-L2**: As a user with multiple tabs, changes made in one tab are reflected in all other tabs.

### Change Tracking

- **US-L3**: As a player, I can view a log of all changes made to my pilots, mechs, and crawlers.
- **US-L4**: As a player, I can roll back individual changes or grouped operations (e.g., undo a pattern application).
- **US-L5**: As a player, each change has a human-readable description (e.g., "Reduced HP from 10 to 8", "Installed Red Laser in slot 3").

### Live Sheet Editing

- **US-L6**: As a player, I can directly edit my pilot's HP, AP, and TP values on the pilot detail view.
- **US-L7**: As a player, I can mark identity fields (background, motto, keepsake) as "used" during gameplay.
- **US-L8**: As a player, I can edit my mech's SP, EP, and Heat values.
- **US-L9**: As a player, I can change the condition of individual systems/modules (intact -> damaged -> destroyed).

### Crawler Downtime

- **US-L10**: As a player, I can trigger the "Crawler Downtime" flow from the crawler detail view. Triggering downtime:
  - **Grants TP** to all pilots assigned to the crawler
  - **Heals pilots** (restores HP) and **repairs mechs** (restores SP) based on downtime rules
  - Runs the full downtime guide (salvage, crafting, trading, training, etc.) for each assigned pilot
- **US-L10a**: As a player, the downtime flow processes each assigned pilot, applying all healing/repair/TP actions automatically and surfacing decisions (craft, trade, train) interactively.

### Progression

- **US-L11**: As a player, I can train new abilities following the per-tree prerequisite chain. Each tree's requirements are defined in `ability-tree-requirements.json` (core → advanced → legendary, hybrid classes require 2 specific core trees). Training costs TP.
- **US-L11a**: As a player, I can unlearn an ability (costs TP). I cannot unlearn a lower-level ability if a higher-level ability in the same tree chain is still learned.
- **US-L11b**: As a player, I can **advance my base class** to its legendary variant, or **hybridize** by meeting two core tree prerequisites from different classes. Class changes are logged in `change_log` with full provenance (old class, new class, which ability trees triggered the change).
- **US-L12**: As a player, I can upgrade my crawler's tech level by spending accumulated scrap from the upgrade pool.

### Action Execution & Rolls

- **US-L13**: As a player, when I click on an **entity display** (system, module, or ability) in my pilot/mech sheet, it **deducts the AP or EP cost** and **triggers the associated roll** (typically the base general action roll: d20). The roll result is displayed and logged. The entity display's `onClick` is the primary interaction surface for action execution.
- **US-L13a**: Some abilities have **sub-actions** (nested actions within an expanded entity view). These use dedicated `ActionButton` components within the entity's expanded content area.
- **US-L14**: As a player, if I don't have enough AP/EP for an action, the entity display / action button is disabled with a tooltip showing the cost.

### Campaign Activity Feed (Toast System)

- **US-L15**: As a crawler crewmate, I see **real-time toast notifications** for actions other players in the campaign take — e.g., "Nell lost 5 HP", "Nell rolled a 5 on General Actions", "Nell installed Red Laser". This uses Supabase Realtime + the change_log table.
- **US-L16**: Toast notifications are non-intrusive and auto-dismiss after a few seconds. They can be expanded to show more detail.

---

## Change Tracking Model

### Change Log Table (created in Phase 1)

```
change_log
  id, user_id, created_at
  target_id uuid        -- which entity was changed
  target_type text       -- 'pilot' | 'mech' | 'crawler' | 'entity_ref' | 'player_choice'
  action text            -- 'create' | 'update' | 'delete'
  field text             -- which field changed (nullable for create/delete)
  old_value jsonb        -- previous value (nullable for create)
  new_value jsonb        -- new value (nullable for delete)
  description text       -- human-readable summary
  session_id uuid        -- groups changes within a logical session/transaction
  reversible boolean     -- whether this change can be rolled back
```

### Use Cases

- Damage reduction: "Reduced Pilot HP from 10 to 8"
- Chassis swap: "Changed chassis from Scrapper to Mule"
- System install: "Installed Red Laser in system slot 3"
- System removal: "Removed Armour Plating from system slot 1"
- Ability training: "Trained new ability: Emergency Repair"
- Stat changes: "Increased mech current_heat from 2 to 4"

### Rollback Mechanics

- **Individual rollback**: Apply inverse operation (restore `old_value`).
- **Session rollback**: Undo all changes in a `session_id` group atomically (e.g., "apply pattern" = swap chassis + replace all systems/modules).
- **Reversibility**: Some changes are marked `reversible = false` (e.g., deletion of data that was consumed).

---

## Crawler Downtime

The "Crawler Downtime" guide (10 info steps) provides a checklist for post-session and pre-session activities:

1. Discard hand
2. Repair modules
3. Repair mech structure
4. Repair pilot (heals HP)
5. Salvage from the field
6. Craft new systems/modules
7. Upgrade crawler
8. Trade with NPCs
9. Train abilities
10. Preparation

A "Downtime" button on the crawler detail view triggers this flow for all assigned pilots. Triggering downtime automatically:

- **Grants 1 TP** to each assigned pilot (Training Points for learning new abilities)
- **Heals pilot HP** (based on Med Bay / repair rules)
- **Repairs mech SP** (based on Mech Bay / repair capacity)
- **Repairs mech systems/modules** (damaged -> intact) — **gated by crawler tech level**: only items with `techLevel <= crawler.tech_level` can be repaired. Higher-TL items remain damaged until the crawler is upgraded.

Interactive steps (salvage, craft, trade, train) are presented to each pilot individually. Automatic steps (heal, repair, TP) are applied in batch.

**Tech level gates apply to all downtime actions**, not just repairs:

- Crafting new systems/modules: only items up to crawler TL can be crafted
- Trading: available items gated by crawler TL
- Upgrading crawler: requires scrap threshold per tech level table

---

## Acceptance Criteria

### AC-1: Real-Time

- [ ] Changes by one user are visible to crewmates in real time
- [ ] Multi-tab sync works for the same user
- [ ] TanStack Query cache invalidated via Supabase Realtime channels

### AC-2: Change Tracking

- [ ] Every stat edit creates a change_log entry
- [ ] Each entry has a human-readable description
- [ ] Related changes grouped by session_id
- [ ] Change log viewable on entity detail views

### AC-3: Rollback

- [ ] Individual changes can be rolled back
- [ ] Session groups can be rolled back atomically
- [ ] Rollback applies inverse operation correctly

### AC-4: Live Sheet Editing

- [ ] Pilot HP/AP/TP directly editable
- [ ] Identity fields can be marked "used"
- [ ] Mech SP/EP/Heat directly editable
- [ ] System/module conditions changeable (intact/damaged/destroyed)

### AC-5: Downtime

- [ ] "Downtime" button visible on crawler detail
- [ ] Triggers downtime guide for all assigned pilots
- [ ] Grants 1 TP to each assigned pilot
- [ ] Heals pilot HP based on repair rules
- [ ] Repairs mech SP and system/module conditions
- [ ] Tech level gate: only items with `techLevel <= crawler.tech_level` can be repaired
- [ ] Crafting and trading gated by crawler tech level
- [ ] Interactive steps (craft, trade, train) presented per pilot
- [ ] Each pilot can process downtime independently

### AC-6: Progression

- [ ] Ability tree prerequisites enforced during training (per-tree chain from `ability-tree-requirements.json`)
- [ ] Core -> Advanced -> Legendary unlock chain works per-tree
- [ ] Hybrid class prerequisites enforced (2 core trees from different classes)
- [ ] Abilities can be unlearned (costs TP, respects dependency chain)
- [ ] Class advancement/hybridization logged with full provenance in change_log
- [ ] Crawler tech level upgradeable via scrap pool

### AC-7: Action Buttons & Rolls

- [ ] Action buttons on systems/modules/abilities deduct AP/EP cost on click
- [ ] Buttons disabled when insufficient AP/EP with cost tooltip
- [ ] Clicking triggers associated roll (d20 general action) and displays result
- [ ] Roll results logged in change_log

### AC-8: Campaign Activity Feed

- [ ] Real-time toast notifications for other players' actions in the same campaign
- [ ] Toasts show human-readable descriptions from change_log
- [ ] Toasts auto-dismiss after 5 seconds
- [ ] Only shows other players' actions (not your own)
