# Phase 5 — User Invites & Roles — Architecture

## Campaign RLS Policies

### Campaign Table Policies

```sql
-- All members can view their campaigns (including archived for history)
CREATE POLICY "Members can view campaign" ON campaigns FOR SELECT
  USING (id IN (SELECT campaign_id FROM campaign_members WHERE user_id = auth.uid()));

-- Only mediators can update campaigns (name, crawler, archive)
CREATE POLICY "Mediators can update campaign" ON campaigns FOR UPDATE
  USING (id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = auth.uid() AND role = 'mediator'
  ));

-- Any authenticated user can create a campaign
CREATE POLICY "Users can create campaigns" ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = created_by);
```

### Campaign Members Policies

```sql
-- Mediators can manage members (invite/uninvite)
CREATE POLICY "Mediators can manage members" ON campaign_members FOR INSERT
  WITH CHECK (campaign_id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = auth.uid() AND role = 'mediator'
  ));

CREATE POLICY "Mediators can remove members" ON campaign_members FOR DELETE
  USING (campaign_id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = auth.uid() AND role = 'mediator'
  ));

-- Members can view roster
CREATE POLICY "Members can view campaign roster" ON campaign_members FOR SELECT
  USING (campaign_id IN (SELECT campaign_id FROM campaign_members WHERE user_id = auth.uid()));

-- Members can update own role (for self-demotion)
CREATE POLICY "Members can update own role" ON campaign_members FOR UPDATE
  USING (user_id = auth.uid());
```

### Pilot Visibility RLS

```sql
-- Extended pilot SELECT policy: owner OR visible OR same crawler crew
CREATE POLICY "Pilot visibility" ON pilots FOR SELECT
  USING (
    user_id = auth.uid()
    OR visible = true
    OR (
      crawler_id IS NOT NULL
      AND crawler_id IN (
        SELECT crawler_id FROM pilots WHERE user_id = auth.uid() AND crawler_id IS NOT NULL
      )
    )
  );
```

Note: This replaces the simple owner-only SELECT policy from Phase 1. INSERT/UPDATE/DELETE remain owner-only.

### Pattern Visibility RLS

```sql
-- Extended pattern SELECT: owner OR visible
CREATE POLICY "Pattern visibility" ON mech_patterns FOR SELECT
  USING (visible = true OR user_id = auth.uid());
```

---

## Invite Code System

### Generation

```typescript
// Generate a random 8-character invite code
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I/O/0/1 to avoid confusion
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
```

### Join Flow

```typescript
const joinCampaign = async (inviteCode: string) => {
  // 1. Look up campaign by invite code
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('invite_code', inviteCode)
    .eq('archived', false)
    .single()

  // 2. Insert campaign_member with 'player' role
  await supabase.from('campaign_members').insert({
    campaign_id: campaign.id,
    user_id: currentUserId,
    role: 'player',
  })
}
```

---

## Role Management API

### `src/lib/api/campaignMemberApi.ts` (NEW)

```typescript
export const campaignMemberApi = {
  invite: async (campaignId: string, userId: string, role?: 'player' | 'mediator'): Promise<void>
  uninvite: async (campaignId: string, userId: string): Promise<void>
  promote: async (campaignId: string, userId: string): Promise<void>  // player -> mediator
  selfDemote: async (campaignId: string): Promise<void>               // mediator -> player (self only)
  joinByCode: async (inviteCode: string): Promise<void>
}
```

### Promotion/Demotion Logic

```typescript
// Promote: mediator promotes a player
const promote = async (campaignId: string, userId: string) => {
  // Verify caller is mediator (enforced by RLS too)
  await supabase
    .from('campaign_members')
    .update({ role: 'mediator' })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
}

// Self-demote: mediator can only demote themselves
const selfDemote = async (campaignId: string) => {
  await supabase
    .from('campaign_members')
    .update({ role: 'player' })
    .eq('campaign_id', campaignId)
    .eq('user_id', currentUserId)
}
```

---

## Campaign Archiving

```typescript
const archiveCampaign = async (campaignId: string) => {
  await supabase.from('campaigns').update({ archived: true }).eq('id', campaignId)
}
```

Archived campaigns:

- `archived = true` in the database
- Filtered out of the default campaign list query
- Accessible via a separate "Archived" tab or filter
- All relationships preserved (members, crawler, pilot assignments)

---

## Visibility Toggle Components

### `src/components/shared/VisibilityToggle.tsx` (NEW)

```typescript
type VisibilityToggleProps = {
  visible: boolean
  onToggle: (visible: boolean) => void
  label?: string // "Share pilot" | "Share pattern"
}
```

Used on:

- Pilot detail view (Phase 3 component, toggle added in Phase 5)
- Pattern library cards (Phase 2 component, toggle added in Phase 5)

---

## Campaign Detail Enhancements

### Member Roster

The campaign detail view (created in Phase 4) is enhanced with:

- Full member roster with roles (Mediator/Player badges)
- Invite code display + copy button
- "Invite User" button (Mediator only)
- "Regenerate Code" button (Mediator only)
- Per-member actions (promote, uninvite — Mediator only)
- "Demote Self" button (Mediator only, on own row)
- "Archive Campaign" button (Mediator only)

---

## File Summary

### New Files -- 5

```
src/lib/api/campaignMemberApi.ts
src/hooks/useCampaignMembers.ts
src/components/shared/VisibilityToggle.tsx
src/components/campaign/MemberRoster.tsx
src/components/campaign/InviteSection.tsx
```

### Modified Files -- 4

```
src/routes/_authenticated/campaigns/$campaignId.tsx  -- Add member roster, invite UI, archive
src/components/pilot/PilotDetail.tsx                  -- Add visibility toggle
src/components/dashboard/PatternCard.tsx              -- Add visibility toggle
src/lib/api/campaignApi.ts                            -- Add archive method
```

### RLS Changes (Migration)

- Replace simple owner-only SELECT on `pilots` with extended visibility policy
- Replace simple owner-only SELECT on `mech_patterns` with visibility policy
- Add campaign-specific RLS policies on `campaigns` and `campaign_members`

---

## Implementation Order

1. **RLS migration** -- Extended visibility policies, campaign RLS
2. **Campaign member API** -- invite, uninvite, promote, self-demote, joinByCode
3. **Invite code system** -- Generation, lookup, join flow
4. **Member roster component** -- Display members with role badges
5. **Invite UI** -- Code display, copy, regenerate
6. **Role management UI** -- Promote, uninvite, self-demote buttons
7. **Archiving** -- Archive button, archived filter
8. **Visibility toggles** -- VisibilityToggle component on pilot detail + pattern cards
