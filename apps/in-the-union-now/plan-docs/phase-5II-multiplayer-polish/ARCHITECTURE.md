# Phase 5II — Multiplayer, Live Play & Polish — Architecture

## Existing Infrastructure

DB infrastructure already in place from Phase 4:

- `campaigns.invite_code` column (unique text, nullable)
- `campaigns.archived` column (boolean, default false)
- `campaign_members` table (campaign_id, user_id, role default 'player', joined_at)
- `change_log` table (empty but schema exists — id, user_id, target_id, target_type, action, field, old_value, new_value, description, session_id, reversible)
- `pilots.visible` column (boolean, default false)
- `mech_patterns.visible` column (boolean, default false)

---

## Wave 1 — Infrastructure & Cleanup

### 1a. RLS Performance Migration

All RLS policies currently use `auth.uid()` directly, which re-evaluates per row. Wrap in `(select ...)` for single evaluation:

```sql
-- Before (slow):
CREATE POLICY "Users can view own pilots" ON pilots FOR SELECT
  USING (user_id = auth.uid());

-- After (fast):
CREATE POLICY "Users can view own pilots" ON pilots FOR SELECT
  USING (user_id = (select auth.uid()));
```

**Tables affected:** pilots, mechs, crawlers, entity_refs, player_choices, cargo, change_log, mech_patterns, campaigns, campaign_members (all existing policies).

**Consolidate duplicate SELECT policies on campaigns:**

```sql
-- Current: two separate permissive SELECT policies
-- "Creator can manage campaign" + "Members can view campaign"
-- Replace with single policy:
CREATE POLICY "Campaign access" ON campaigns FOR SELECT
  USING (
    created_by = (select auth.uid())
    OR id IN (SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid()))
  );
```

**Add missing FK indexes:**

```sql
CREATE INDEX IF NOT EXISTS idx_campaigns_crawler_id ON campaigns(crawler_id);
CREATE INDEX IF NOT EXISTS idx_player_choices_parent_choice_id ON player_choices(parent_choice_id);
```

### 1b. Codebase Cleanup

Cleanup specifics will be identified via audit before implementation. Known targets:

- **EntityDisplayContent.tsx** (~700 lines) — decompose into focused rendering modules
- **suref-react barrel audit** — identify and remove unused exports from `src/index.ts`
- **Repeated hook patterns** — extract shared mutation/query patterns
- **Repeated utility patterns** — consolidate across lib/ files
- **Test coverage** — add tests for pure utility functions that lack coverage

### 1c. Change Log API

```typescript
// src/lib/api/changeLogApi.ts
export const changeLogApi = {
  log: async (params: {
    targetId: string
    targetType: 'pilot' | 'mech' | 'crawler' | 'entity_ref' | 'player_choice'
    action: 'create' | 'update' | 'delete'
    field?: string
    oldValue?: unknown
    newValue?: unknown
    description: string
    sessionId?: string
    reversible?: boolean
  }) => Promise<void>

  listByTarget: async (targetId: string, targetType: string) => Promise<ChangeLogEntry[]>
}
```

### 1d. Realtime Subscription Hook

```typescript
// src/hooks/useRealtimeSubscription.ts
export function useRealtimeSubscription(
  table: string,
  filter: string,
  queryKeys: QueryKey[]
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-${filter}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter,
      }, () => {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key })
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [table, filter])
}
```

Design: Purely additive — existing API -> TanStack Query -> components data flow is unchanged. Realtime just triggers cache invalidation, which causes refetch.

- **Optimistic updates** for the editing user (immediate UI response)
- **Realtime pushes** for viewers (cache invalidation triggers refetch)
- **Conflict resolution**: Last-write-wins (acceptable for character sheet use case)

---

## Wave 2 — Multiplayer (Track A)

### Campaign RLS Policies

#### Campaign Table

```sql
-- Replace existing duplicate SELECT policies with unified policy
CREATE POLICY "Campaign access" ON campaigns FOR SELECT
  USING (
    created_by = (select auth.uid())
    OR id IN (SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid()))
  );

-- Only mediators can update campaigns (name, crawler, archive)
CREATE POLICY "Mediators can update campaign" ON campaigns FOR UPDATE
  USING (id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = (select auth.uid()) AND role = 'mediator'
  ));

-- Any authenticated user can create a campaign
CREATE POLICY "Users can create campaigns" ON campaigns FOR INSERT
  WITH CHECK ((select auth.uid()) = created_by);
```

#### Campaign Members

```sql
-- Mediators can manage members (invite/uninvite)
CREATE POLICY "Mediators can manage members" ON campaign_members FOR INSERT
  WITH CHECK (campaign_id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = (select auth.uid()) AND role = 'mediator'
  ));

CREATE POLICY "Mediators can remove members" ON campaign_members FOR DELETE
  USING (campaign_id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = (select auth.uid()) AND role = 'mediator'
  ));

-- Members can view roster
CREATE POLICY "Members can view campaign roster" ON campaign_members FOR SELECT
  USING (campaign_id IN (
    SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid())
  ));

-- Members can update own role (for self-demotion)
CREATE POLICY "Members can update own role" ON campaign_members FOR UPDATE
  USING (user_id = (select auth.uid()));

-- Users can join via invite code (self-insert)
CREATE POLICY "Users can join via invite" ON campaign_members FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
```

#### Extended Pilot Visibility

```sql
-- Replace owner-only SELECT with: owner OR visible OR same crawler crew
CREATE POLICY "Pilot visibility" ON pilots FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR visible = true
    OR (
      crawler_id IS NOT NULL
      AND crawler_id IN (
        SELECT crawler_id FROM pilots
        WHERE user_id = (select auth.uid()) AND crawler_id IS NOT NULL
      )
    )
  );
```

#### Extended Pattern Visibility

```sql
CREATE POLICY "Pattern visibility" ON mech_patterns FOR SELECT
  USING (visible = true OR user_id = (select auth.uid()));
```

### Invite Code System

```typescript
// Generate a random 8-character invite code (no ambiguous chars)
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}
```

Join flow:
1. User enters invite code
2. Look up campaign by code (must not be archived)
3. Insert campaign_member with 'player' role
4. Navigate to campaign detail

### Campaign Member API

```typescript
// src/lib/api/campaignMemberApi.ts
export const campaignMemberApi = {
  invite: async (campaignId: string, userId: string, role?: 'player' | 'mediator') => void
  uninvite: async (campaignId: string, userId: string) => void
  promote: async (campaignId: string, userId: string) => void
  selfDemote: async (campaignId: string) => void
  joinByCode: async (inviteCode: string) => void
}
```

### Campaign Detail Enhancements

The campaign detail view (Phase 4) gets:

- Member roster with role badges (Mediator/Player)
- Invite code display + copy button
- "Regenerate Code" button (Mediator only)
- Per-member actions: promote, uninvite (Mediator only)
- "Demote Self" button (Mediator only, on own row)
- "Archive Campaign" button (Mediator only)

### Visibility Toggle

```typescript
// src/components/shared/VisibilityToggle.tsx
type VisibilityToggleProps = {
  visible: boolean
  onToggle: (visible: boolean) => void
  label?: string
}
```

Added to: pilot detail view, pattern library cards.

---

## Wave 3 — Live Play (Track B)

### Change Tracking Integration

Every mutation wraps its Supabase call with a `changeLogApi.log()`:

```typescript
// Pattern: wrap existing mutations
const updatePilotHp = async (pilotId: string, newHp: number) => {
  const pilot = await pilotApi.getById(pilotId)
  await pilotApi.update(pilotId, { hp: newHp })
  await changeLogApi.log({
    targetId: pilotId,
    targetType: 'pilot',
    action: 'update',
    field: 'hp',
    oldValue: pilot.hp,
    newValue: newHp,
    description: `${newHp > pilot.hp ? 'Healed' : 'Took damage'}: HP ${pilot.hp} -> ${newHp}`,
  })
}
```

Session grouping for multi-step operations:

```typescript
const sessionId = crypto.randomUUID()
// All related log entries share the same sessionId
```

### Inline Edit Components

```typescript
// Numeric stat editor (HP, AP, TP, SP, EP, Heat)
// Reuses CrawlerStatControl pattern from Phase 4
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

### Realtime Wiring

Subscribe to changes relevant to the current view:

```typescript
// In usePilots hook — subscribe to pilots on the same crawler
useRealtimeSubscription('pilots', `crawler_id=eq.${crawlerId}`, [pilotKeys.byCrawler(crawlerId)])

// In useMechs hook — subscribe to entity_refs for mechs on the same crawler
useRealtimeSubscription('entity_refs', `parent_id=in.(${mechIds.join(',')})`, mechQueryKeys)

// In useCrawlers hook — subscribe to the crawler itself
useRealtimeSubscription('crawlers', `id=eq.${crawlerId}`, [crawlerKeys.detail(crawlerId)])
```

### Ability Training

```typescript
const trainAbility = async (pilotId: string, abilityTreeId: string) => {
  // 1. Verify prerequisites from ability-tree-requirements data
  // 2. Verify sufficient TP (training costs 1 TP)
  // 3. Create entity_ref (schema_name='abilities')
  // 4. Deduct TP
  // 5. Log to change_log
}

const unlearnAbility = async (pilotId: string, abilityTreeId: string) => {
  // 1. Verify no higher-level abilities depend on this one
  // 2. Verify sufficient TP (unlearning also costs 1 TP)
  // 3. Remove entity_ref
  // 4. Deduct TP
  // 5. Log to change_log
}
```

UI: AbilityTraining component on pilot detail, showing available trees with lock/unlock state based on prerequisites.

### Crawler Tech Level Upgrading

```typescript
const upgradeCrawler = async (crawlerId: string) => {
  const crawler = await crawlerApi.getById(crawlerId)
  const nextTL = crawler.tech_level + 1
  const upgradeCost = getUpgradeCost(nextTL)
  // Deduct from upgrade_pool, increment tech_level, update max_sp
}
```

### Campaign Activity Feed

Toasts driven by change_log inserts from other campaign members, via Supabase Realtime:

```typescript
// src/hooks/useActivityFeed.ts
export function useActivityFeed(campaignId: string, currentUserId: string) {
  useEffect(() => {
    const channel = supabase
      .channel(`campaign-activity-${campaignId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'change_log',
      }, (payload) => {
        if (payload.new.user_id !== currentUserId) {
          toast(payload.new.description)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [campaignId, currentUserId])
}
```

Uses existing Toaster component from suref-react.

---

## File Summary

### New Files (~15)

```
# Wave 1 — Infrastructure
src/lib/api/changeLogApi.ts
src/hooks/useRealtimeSubscription.ts
src/hooks/useActivityFeed.ts

# Wave 2 — Multiplayer
src/lib/api/campaignMemberApi.ts
src/hooks/useCampaignMembers.ts
src/components/shared/VisibilityToggle.tsx
src/components/games/MemberRoster.tsx
src/components/games/InviteSection.tsx
src/components/games/JoinCampaignDialog.tsx

# Wave 3 — Live Play
src/components/shared/StatEditor.tsx
src/components/shared/ConditionToggle.tsx
src/components/shared/UsedToggle.tsx
src/components/pilots/AbilityTraining.tsx
src/components/games/CrawlerUpgrade.tsx
```

### Modified Files (~10)

```
# Wave 1 — Cleanup
packages/suref-react/src/components/entity/EntityDisplay/components/EntityDisplayContent.tsx  -- decompose
packages/suref-react/src/index.ts  -- barrel audit

# Wave 2 — Multiplayer
src/routes/_authenticated/games/$gameId/index.tsx  -- member roster, invite UI, archive
src/routes/_authenticated/pilots/$pilotId/index.tsx  -- visibility toggle
src/components/patterns/PatternCard.tsx  -- visibility toggle

# Wave 3 — Live Play
src/routes/_authenticated/pilots/$pilotId/index.tsx  -- inline editing, change logging
src/routes/_authenticated/games/$gameId/crawler.tsx  -- upgrade UI
src/hooks/usePilots.ts  -- realtime subscriptions
src/hooks/useMechs.ts  -- realtime subscriptions
src/hooks/useCrawlers.ts  -- realtime subscriptions
```

### RLS Changes (Migration)

- Replace all `auth.uid()` with `(select auth.uid())` across all tables
- Consolidate campaigns duplicate SELECT policies
- Add FK indexes on campaigns.crawler_id, player_choices.parent_choice_id
- Extended pilot SELECT: owner OR visible OR same crawler crew
- Extended mech_patterns SELECT: owner OR visible
- Campaign member policies: mediator management, roster viewing, self-insert via invite, self-update
- Campaign UPDATE: mediator-only

---

## Implementation Order

### Wave 1 — Infrastructure & Cleanup (do first, unblocks everything)

1. RLS performance migration
2. Codebase DRY pass + decomposition
3. Change log API + hook
4. Realtime subscription hook

### Wave 2 — Multiplayer (Track A, depends on Wave 1 RLS)

5. Campaign member API
6. Invite code system + join flow
7. Visibility RLS migration
8. Member roster component
9. Invite UI (code display, copy, regenerate)
10. Role management UI (promote, uninvite, self-demote)
11. Archiving (archive button, dashboard filter)
12. Visibility toggles (pilot detail, pattern cards)

### Wave 3 — Live Play (Track B, depends on Wave 1 infra)

13. Inline editing components
14. Wire editing into pilot/mech detail with change logging
15. Wire realtime into existing hooks
16. Ability training with tree prerequisites
17. Crawler tech level upgrading
18. Campaign activity feed (toast from change_log via Realtime)
