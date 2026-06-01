# Phase 6 — Late Phase Improvements — Architecture

## Supabase Realtime Integration

### Architecture

Supabase Realtime subscriptions provide live updates. When a user modifies their pilot/mech/crawler, other viewers (e.g., crawler crewmates) see changes in real time.

### Integration with TanStack Query

```typescript
// Subscribe to changes on a specific pilot
const channel = supabase
  .channel('pilot-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'pilots',
      filter: `id=eq.${pilotId}`,
    },
    (payload) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.detail(pilotId) })
    }
  )
  .subscribe()
```

### Subscription Scope

- **Pilot sheets**: Subscribe to changes on pilots in the same crawler
- **Mech data**: Subscribe to entity_refs changes for mechs on the same crawler
- **Crawler state**: Subscribe to crawler changes for the assigned crawler

### Hook Pattern

```typescript
// src/hooks/useRealtimeSubscription.ts
export function useRealtimeSubscription(table: string, filter: string, queryKeys: QueryKey[]) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-${filter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        () => {
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key })
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter])
}
```

### Design Notes

The data flow (API -> TanStack Query -> components) already supports cache invalidation, so adding Realtime is purely additive. No architectural changes to Phases 1-5.

- **Optimistic updates** for the editing user (immediate UI response)
- **Realtime pushes** for viewers (cache invalidation triggers refetch)
- **Conflict resolution**: Last-write-wins (acceptable for character sheet use case)

---

## Change Tracking

### Logging Strategy

Every mutation that modifies pilot/mech/crawler/entity_ref data writes to `change_log`:

```typescript
const logChange = async (params: {
  targetId: string
  targetType: string
  action: 'create' | 'update' | 'delete'
  field?: string
  oldValue?: unknown
  newValue?: unknown
  description: string
  sessionId?: string
  reversible?: boolean
}) => {
  await supabase.from('change_log').insert({
    user_id: currentUserId,
    target_id: params.targetId,
    target_type: params.targetType,
    action: params.action,
    field: params.field,
    old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
    new_value: params.newValue ? JSON.stringify(params.newValue) : null,
    description: params.description,
    session_id: params.sessionId,
    reversible: params.reversible ?? true,
  })
}
```

### Session Grouping

Multi-step operations (e.g., "apply pattern") generate a `session_id` and group all changes under it:

```typescript
const applyPatternWithTracking = async (mechId: string, pattern: MechPattern) => {
  const sessionId = crypto.randomUUID()

  // Log chassis change
  await logChange({
    targetId: mechId,
    targetType: 'mech',
    action: 'update',
    field: 'chassis_ref',
    oldValue: currentChassis,
    newValue: pattern.chassis_ref,
    description: `Changed chassis from ${currentChassisName} to ${newChassisName}`,
    sessionId,
  })

  // Log each system/module removal and addition
  for (const removed of removedSystems) {
    await logChange({ ..., sessionId, description: `Removed ${removed.name}` })
  }
  for (const added of addedSystems) {
    await logChange({ ..., sessionId, description: `Installed ${added.name}` })
  }
}
```

### Rollback Implementation

```typescript
const rollbackChange = async (changeId: string) => {
  const change = await getChangeById(changeId)
  if (!change.reversible) throw new Error('Change is not reversible')

  // Apply inverse: set field back to old_value
  await supabase
    .from(change.target_type === 'mech' ? 'mechs' : 'pilots')
    .update({ [change.field]: change.old_value })
    .eq('id', change.target_id)

  // Log the rollback itself
  await logChange({
    targetId: change.target_id,
    targetType: change.target_type,
    action: 'update',
    field: change.field,
    oldValue: change.new_value,
    newValue: change.old_value,
    description: `Rolled back: ${change.description}`,
    reversible: false, // Rollbacks are not re-rollbackable
  })
}

const rollbackSession = async (sessionId: string) => {
  const changes = await getChangesBySession(sessionId)
  // Apply in reverse order
  for (const change of changes.reverse()) {
    if (change.reversible) {
      await rollbackChange(change.id)
    }
  }
}
```

### Change Log UI

```typescript
// src/components/shared/ChangeLog.tsx
type ChangeLogProps = {
  targetId: string
  targetType: string
}
```

Displays a chronological list of changes with:

- Timestamp
- Description
- "Undo" button (if reversible)
- Session grouping (collapsible)

---

## Live Sheet Editing

### Inline Edit Components

```typescript
// Numeric stat editor (HP, AP, TP, SP, EP, Heat)
type StatEditorProps = {
  value: number
  max: number
  label: string
  onChange: (newValue: number) => void
}

// Condition toggle (intact -> damaged -> destroyed)
type ConditionToggleProps = {
  condition: ItemCondition
  onChange: (newCondition: ItemCondition) => void
}

// "Used" toggle for identity fields
type UsedToggleProps = {
  label: string
  used: boolean
  onToggle: (used: boolean) => void
}
```

Each edit triggers:

1. Optimistic UI update
2. Supabase mutation
3. Change log entry
4. TanStack Query cache update

---

## Ability Progression

### Training Flow

Abilities unlock **per-tree, in order**. Requirements are defined in `ability-tree-requirements.json` (each entry has a `requirement` array of prerequisite tree names).

```typescript
const trainAbility = async (pilotId: string, abilityTreeId: string) => {
  // 1. Verify prerequisites from ability-tree-requirements data
  const trained = await getTrainedAbilities(pilotId) // entity_refs with schema_name='abilities'
  const treeReq = SalvageUnionReference.AbilityTreeRequirements.find((r) => r.id === abilityTreeId)

  if (treeReq) {
    // Check all prerequisite trees are learned
    for (const reqTreeName of treeReq.requirement) {
      const hasPrereq = trained.some((t) => t.treeName === reqTreeName)
      if (!hasPrereq) {
        throw new Error(`Prerequisite not met: must learn "${reqTreeName}" first`)
      }
    }
  }

  // 2. Spend TP (training costs 1 TP)
  if (currentTp < 1) throw new Error('Not enough TP to train')
  await pilotApi.update(pilotId, { tp: currentTp - 1 })

  // 3. Create entity_ref
  await entityRefApi.create({
    parent_id: pilotId,
    parent_type: 'pilot',
    schema_name: 'abilities',
    schema_ref_id: abilityTreeId,
  })

  // 4. Log change
  await logChange({
    targetId: pilotId,
    targetType: 'pilot',
    action: 'update',
    description: `Trained new ability tree: ${treeReq?.name}`,
  })
}

const unlearnAbility = async (pilotId: string, abilityTreeId: string) => {
  // 1. Verify no higher-level abilities depend on this one
  const trained = await getTrainedAbilities(pilotId)
  const allReqs = SalvageUnionReference.AbilityTreeRequirements.all()

  // Find any trained abilities that require this tree as a prerequisite
  const dependents = allReqs.filter(
    (req) =>
      req.requirement.includes(abilityTreeId) && trained.some((t) => t.schema_ref_id === req.id)
  )

  if (dependents.length > 0) {
    throw new Error(
      `Cannot unlearn: ${dependents.map((d) => d.name).join(', ')} depends on this ability`
    )
  }

  // 2. Spend TP (unlearning also costs 1 TP)
  if (currentTp < 1) throw new Error('Not enough TP to unlearn')
  await pilotApi.update(pilotId, { tp: currentTp - 1 })

  // 3. Remove entity_ref
  const ref = trained.find((t) => t.schema_ref_id === abilityTreeId)
  if (ref) await entityRefApi.delete(ref.id)

  // 4. Log change
  await logChange({
    targetId: pilotId,
    targetType: 'pilot',
    action: 'update',
    description: `Unlearned ability tree: ${abilityTreeId}`,
  })
}
```

### Class Advancement & Hybridization

When a pilot meets the prerequisites for an advanced/hybrid/legendary class, they can change their `class_ref`:

```typescript
const advanceClass = async (pilotId: string, newClassId: string) => {
  const pilot = await pilotApi.getById(pilotId)
  const oldClassRef = pilot.class_ref

  // Verify prerequisites from ability-tree-requirements
  const treeReq = SalvageUnionReference.AbilityTreeRequirements.find((r) => r.id === newClassId)
  if (!treeReq) throw new Error('Invalid class advancement target')

  const trained = await getTrainedAbilities(pilotId)
  for (const reqTreeName of treeReq.requirement) {
    if (!trained.some((t) => t.treeName === reqTreeName)) {
      throw new Error(`Prerequisite not met: must learn "${reqTreeName}" first`)
    }
  }

  // Update class_ref
  await pilotApi.update(pilotId, { class_ref: newClassId })

  // Log with full provenance — captures what triggered the class change
  await logChange({
    targetId: pilotId,
    targetType: 'pilot',
    action: 'update',
    field: 'class_ref',
    oldValue: oldClassRef,
    newValue: newClassId,
    description: `Advanced class from ${oldClassRef} to ${newClassId} (met prerequisites: ${treeReq.requirement.join(', ')})`,
  })
}
```

Provenance is captured in the `change_log` entry: the `old_value` (previous class), `new_value` (new class), and `description` (which prerequisites triggered it) allow full audit trail of class progression.

---

## Action Execution & Roll Integration

### Action Execution Flow

Systems, modules, and abilities have actions. The **primary interaction surface is the entity display itself** — clicking a system/module/ability entity display in the pilot/mech sheet triggers its action. Sub-actions (nested actions within an expanded ability) use dedicated `ActionButton` components within the entity's expanded content area.

When a player clicks an entity display or sub-action button:

```typescript
type ActionExecution = {
  entityRefId: string // Which installed system/module/ability
  actionName: string // The action being performed
  apCost: number // AP to deduct (0 if EP-based)
  epCost: number // EP to deduct (0 if AP-based)
  rollType: 'general' | 'none' // Whether to trigger a roll
}

const executeAction = async (pilotId: string, mechId: string | null, action: ActionExecution) => {
  // 1. Verify sufficient AP/EP
  const pilot = await pilotApi.getById(pilotId)
  if (action.apCost > 0 && pilot.ap < action.apCost) {
    throw new Error(`Not enough AP (need ${action.apCost}, have ${pilot.ap})`)
  }
  if (action.epCost > 0 && mechId) {
    const mech = await mechApi.getById(mechId)
    if (mech.current_ep < action.epCost) {
      throw new Error(`Not enough EP (need ${action.epCost}, have ${mech.current_ep})`)
    }
  }

  // 2. Deduct AP/EP
  if (action.apCost > 0) {
    await pilotApi.update(pilotId, { ap: pilot.ap - action.apCost })
  }
  if (action.epCost > 0 && mechId) {
    const mech = await mechApi.getById(mechId)
    await mechApi.update(mechId, { current_ep: mech.current_ep - action.epCost })
  }

  // 3. Trigger roll if applicable (base general action = d20)
  // Uses @randsum/roller for all dice-based needs
  let rollResult: number | null = null
  if (action.rollType === 'general') {
    const { total } = roll('1d20') // from @randsum/roller
    rollResult = total
  }

  // 4. Log the action + roll
  await logChange({
    targetId: pilotId,
    targetType: 'pilot',
    action: 'update',
    description: `Used ${action.actionName}${rollResult ? ` — rolled ${rollResult} on General Actions` : ''}`,
  })

  return { rollResult }
}
```

Action buttons are disabled when insufficient AP/EP, with a tooltip showing the cost.

---

## Campaign Activity Feed (Toast System)

### Architecture

Toasts are driven by `change_log` entries from other players in the same campaign, delivered via Supabase Realtime:

```typescript
// Subscribe to change_log entries from campaign crewmates
const useActivityFeed = (campaignId: string, currentUserId: string) => {
  useEffect(() => {
    const channel = supabase
      .channel(`campaign-activity-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'change_log',
        },
        (payload) => {
          const change = payload.new
          // Only show toasts for other users' actions
          if (change.user_id !== currentUserId) {
            toast(change.description) // e.g., "Nell lost 5 HP"
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId, currentUserId])
}
```

Toasts auto-dismiss after 5 seconds. Uses the `Toaster` component from suref-react.

---

## Crawler Upgrading

### Tech Level Progression

```typescript
const upgradeCrawler = async (crawlerId: string) => {
  const crawler = await crawlerApi.getById(crawlerId)
  const nextTL = crawler.tech_level + 1
  const upgradeCost = getUpgradeCost(nextTL) // From game data

  if (crawler.upgrade_pool < upgradeCost) {
    throw new Error('Insufficient scrap in upgrade pool')
  }

  await crawlerApi.update(crawlerId, {
    tech_level: nextTL,
    upgrade_pool: crawler.upgrade_pool - upgradeCost,
    max_sp: getMaxSP(nextTL), // From tech level table in game data
  })
}
```

---

## Downtime Flow

### Crawler Downtime Button

On crawler detail view, triggers the "Crawler Downtime" guide:

```typescript
const startDowntime = (crawlerId: string) => {
  // Navigate to a downtime flow that processes each assigned pilot
  navigate({ to: `/crawlers/${crawlerId}/downtime` })
}
```

### Downtime Route

```
src/routes/_authenticated/crawlers/$crawlerId/downtime.tsx
```

Renders the 10-step downtime guide for each assigned pilot sequentially or in parallel tabs. Uses the wizard engine from Phase 3 with info-only steps.

### Downtime Automatic Actions

When downtime is triggered, the following are applied in batch before interactive steps:

```typescript
const triggerDowntime = async (crawlerId: string) => {
  const crawler = await crawlerApi.getById(crawlerId)
  const assignedPilots = crawler.assignedPilots

  const sessionId = crypto.randomUUID()

  for (const pilot of assignedPilots) {
    // Grant 1 TP
    await pilotApi.update(pilot.id, { tp: pilot.tp + 1 })
    await logChange({ ..., description: `Downtime: +1 TP (now ${pilot.tp + 1})`, sessionId })

    // Heal pilot HP to max
    if (pilot.hp < pilot.max_hp) {
      await pilotApi.update(pilot.id, { hp: pilot.max_hp })
      await logChange({ ..., description: `Downtime: Healed HP to ${pilot.max_hp}`, sessionId })
    }

    // Repair mech SP (gated by crawler tech level)
    const mech = await mechApi.getByPilotId(pilot.id)
    if (mech && mech.current_sp < mech.max_sp) {
      // Mech Bay repairs are limited by crawler tech level
      // Only TL <= crawler.tech_level components can be repaired
      await mechApi.update(mech.id, { current_sp: mech.max_sp })
      await logChange({ ..., description: `Downtime: Repaired mech SP to ${mech.max_sp}`, sessionId })
    }

    // Repair damaged modules/systems -> intact
    // TECH LEVEL GATE: Only items with techLevel <= crawler.tech_level can be repaired
    const entityRefs = await entityRefApi.listByParent(mech.id, 'mech')
    for (const ref of entityRefs) {
      if (ref.condition === 'damaged') {
        const entityData = resolveEntity(ref.schema_name, ref.schema_ref_id)
        if (entityData.techLevel <= crawler.tech_level) {
          await entityRefApi.update(ref.id, { condition: 'intact' })
          await logChange({ ..., description: `Downtime: Repaired ${entityData.name} (TL${entityData.techLevel})`, sessionId })
        } else {
          // Cannot repair — tech level too high for this crawler
          await logChange({ ..., description: `Downtime: Cannot repair ${entityData.name} (TL${entityData.techLevel} > crawler TL${crawler.tech_level})`, sessionId, reversible: false })
        }
      }
    }
  }

  // Then navigate to interactive downtime steps
  navigate({ to: `/crawlers/${crawlerId}/downtime` })
}
```

### Storage Model

**Mech cargo**: Capacity determined by chassis `cargo_capacity` stat. Items cannot exceed capacity.

**Crawler cargo**: Functionally infinite storage. The `cargo` table rows with `parent_type='crawler'` have no enforced limit.

**Pilot cargo**: Personal items carried on foot. No hard capacity limit in the game rules.

---

## File Summary

### New Files -- 14+

```
# Real-time
src/hooks/useRealtimeSubscription.ts
src/hooks/useActivityFeed.ts

# Change tracking
src/lib/api/changeLogApi.ts
src/hooks/useChangeLog.ts
src/components/shared/ChangeLog.tsx

# Live editing
src/components/shared/StatEditor.tsx
src/components/shared/ConditionToggle.tsx
src/components/shared/UsedToggle.tsx

# Action execution (entity display onClick + sub-action buttons)
src/lib/actions/executeAction.ts
src/components/shared/ActionButton.tsx  # For sub-actions within expanded entities

# Progression
src/components/pilot/AbilityTraining.tsx
src/components/crawler/CrawlerUpgrade.tsx

# Downtime
src/routes/_authenticated/crawlers/$crawlerId/downtime.tsx
src/components/crawler/DowntimeFlow.tsx
```

### Modified Files -- 5+

```
src/components/pilot/PilotDetail.tsx    -- Add inline editing, change log
src/components/crawler/CrawlerDetail.tsx -- Add downtime button, upgrade UI
src/hooks/usePilots.ts                   -- Add realtime subscriptions
src/hooks/useMechs.ts                    -- Add realtime subscriptions
src/hooks/useCrawlers.ts                 -- Add realtime subscriptions
```

---

## Implementation Order

1. **Change log API + hook** -- changeLogApi, useChangeLog
2. **Change log component** -- ChangeLog display with undo
3. **Inline editing components** -- StatEditor, ConditionToggle, UsedToggle
4. **Wire editing into pilot/mech detail** -- Editable stats with change logging
5. **Realtime subscription hook** -- useRealtimeSubscription
6. **Wire realtime into existing hooks** -- Pilot, mech, crawler subscriptions
7. **Ability training** -- AbilityTraining component with tree prerequisites
8. **Crawler upgrading** -- CrawlerUpgrade component
9. **Downtime flow** -- Downtime route + DowntimeFlow component
