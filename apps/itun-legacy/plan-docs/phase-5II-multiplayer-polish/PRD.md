# Phase 5II — Multiplayer, Live Play & Polish

## Scope

Combines the remaining Phase 5 (Invites & Roles) and Phase 6 (Late Improvements) into one final phase, plus a codebase-wide cleanup pass. This phase makes campaigns fully multiplayer, adds live sheet editing with real-time sync, builds the downtime/progression systems, and pays down technical debt.

**What ships:**

### Track A — Multiplayer Foundation (ex-Phase 5)

- Campaign invite system (invite codes)
- Campaign role management (Mediator / Player)
- Mediator powers: invite, uninvite, promote, self-demote, edit crawler, archive
- Player powers: assign pilots, view campaign
- Pilot and pattern visibility toggles
- Crawler crew visibility (pilots on same crawler see each other's data)
- Campaign archiving (soft delete)

### Track B — Live Play (ex-Phase 6, scoped down)

- Real-time data sync via Supabase Realtime
- Change tracking (DB logging — NO rollback UI)
- Live sheet editing (pilot HP/AP/TP, mech SP/EP/Heat, component conditions)
- Ability training/progression with tree prerequisites
- Crawler tech level upgrading via scrap
- Campaign activity feed (toast notifications for crewmate actions)

### Track C — Cleanup & Best Practices

- RLS policy performance fix (wrap `auth.uid()` in `(select ...)`)
- Consolidate duplicate RLS SELECT policies on campaigns
- Add missing foreign key indexes
- Codebase DRY pass (extract repeated patterns, consolidate utilities)
- EntityDisplayContent decomposition (700+ line component)
- suref-react barrel export audit (remove unused exports)
- Test coverage gaps

**What does NOT ship:**

- Rollback UI (change_log is write-only infrastructure — no undo buttons)
- Crawler downtime flow (full interactive 10-step wizard — too complex, defer to v2)
- Action execution & roll integration (entity display onClick for AP/EP deduction — defer)
- Class advancement/hybridization UI (prerequisite logic ships, but no dedicated class-change flow)

---

## User Stories

### Campaign Roles (Track A)

- **US-M1**: As a user, when I create a campaign, I am automatically assigned as its **Mediator**.
- **US-M2**: As a Mediator, I can invite users to my campaign. Default role: Player. Can also invite as Mediator.
- **US-M3**: As a Mediator, I can remove (uninvite) players from the campaign.
- **US-M4**: As a Mediator, I can promote a Player to Mediator.
- **US-M5**: As a Mediator, I can demote **only myself** from Mediator to Player (cannot demote other Mediators).
- **US-M6**: As a Mediator, I can edit the campaign's crawler.
- **US-M7**: As a Mediator, I can archive a campaign (soft delete — hides from active list, preserves data).
- **US-M8**: As a Player, I can assign one of my pilots to the campaign's crawler.
- **US-M9**: As a campaign member, I can see the pilot and mech sheets of other pilots on the same crawler.

### Visibility & Sharing (Track A)

- **US-M10**: As a player, I can toggle my pilot's visibility so other users can view my pilot sheet.
- **US-M11**: As a player, I can toggle a pattern's visibility so other users can browse it.
- **US-M12**: As a crawler crewmate, I can see other crew members' pilot and mech data regardless of their visibility toggle.

### Real-Time Data (Track B)

- **US-L1**: As a crawler crewmate, when another player modifies their pilot/mech data, I see the change in real time without refreshing.
- **US-L2**: As a user with multiple tabs, changes made in one tab are reflected in all other tabs.

### Change Tracking (Track B)

- **US-L3**: As a player, every edit I make to pilots, mechs, and crawlers is logged to the change_log table with a human-readable description.
- **US-L4**: Related changes are grouped by session_id for auditability.

### Live Sheet Editing (Track B)

- **US-L5**: As a player, I can directly edit my pilot's HP, AP, and TP values on the pilot detail view.
- **US-L6**: As a player, I can mark identity fields (background, motto, keepsake) as "used" during gameplay.
- **US-L7**: As a player, I can edit my mech's SP, EP, and Heat values.
- **US-L8**: As a player, I can change the condition of individual systems/modules (intact -> damaged -> destroyed).

### Progression (Track B)

- **US-L9**: As a player, I can train new abilities following the per-tree prerequisite chain. Training costs TP.
- **US-L10**: As a player, I can unlearn an ability (costs TP, respects dependency chain).
- **US-L11**: As a player, I can upgrade my crawler's tech level by spending scrap from the upgrade pool.

### Campaign Activity Feed (Track B)

- **US-L12**: As a crawler crewmate, I see real-time toast notifications for actions other players take.
- **US-L13**: Toast notifications are non-intrusive and auto-dismiss. Only shows other players' actions.

---

## Role Rules

| Role         | Invite/Uninvite | Edit Crawler | Promote to Mediator | Demote    | Archive |
| ------------ | --------------- | ------------ | ------------------- | --------- | ------- |
| **Mediator** | Yes             | Yes          | Yes (any Player)    | Self only | Yes     |
| **Player**   | No              | No           | No                  | No        | No      |

- Multiple Mediators allowed per campaign.
- Users can be invited as Player (default) or Mediator.
- Mediators can only demote **themselves** (cannot demote other Mediators).

---

## Invite System

- Campaigns already have `invite_code` column (added in Phase 4).
- `campaign_members` table already exists with `role` column (default: `'player'`).
- Mediators can generate/regenerate invite codes.
- Users join a campaign by entering the invite code.
- Joining assigns the user as Player by default.

---

## Visibility Rules

| Entity  | `visible=false`                     | `visible=true`                 | Same Crawler                        |
| ------- | ----------------------------------- | ------------------------------ | ----------------------------------- |
| Pilot   | Owner only                          | All authenticated users (read) | Crew can view regardless of visible |
| Mech    | Same as pilot (via pilot ownership) | Same as pilot                  | Same as pilot                       |
| Pattern | Owner only                          | All authenticated users (read) | N/A                                 |

---

## Campaign Archiving

- `campaigns.archived` column already exists (default: `false`).
- Archived campaigns hidden from active campaign list.
- All data preserved (members, crawler, pilot assignments).
- Only Mediators can archive.
- Accessible via an "Archived" filter on the dashboard.

---

## Deferred Items (v2)

These items from the original Phase 6 PRD are explicitly deferred:

| Item                                        | Reason                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rollback UI                                 | Adds significant complexity for marginal user value. change_log is sufficient as an audit trail. |
| Crawler Downtime flow                       | 10-step interactive wizard touching every system. Too large for this phase.                      |
| Action execution (AP/EP deduction on click) | Requires deep integration with every entity display. Better as a dedicated effort.               |
| Class advancement/hybridization UI          | Prerequisite logic ships, but the class-change ceremony UX is deferred.                          |

---

## Acceptance Criteria

### AC-1: Invite System

- [ ] Campaigns have unique invite codes (already in DB)
- [ ] Mediators can generate/regenerate invite codes
- [ ] Users can join a campaign via invite code
- [ ] Joining assigns Player role by default
- [ ] Duplicate join attempts handled gracefully

### AC-2: Role Management

- [ ] Campaign creator is automatically Mediator
- [ ] Mediators can promote Players to Mediator
- [ ] Mediators can only demote themselves
- [ ] Mediators can uninvite players
- [ ] Mediators can edit the campaign crawler
- [ ] Players cannot invite, uninvite, or edit crawler

### AC-3: Visibility

- [ ] Pilots have a "visible" toggle
- [ ] Patterns have a "visible" toggle
- [ ] Visible entities viewable by all authenticated users (read-only)
- [ ] Crawler crewmates see each other's pilot/mech data regardless of visible flag

### AC-4: Campaign Archiving

- [ ] Mediators can archive campaigns
- [ ] Archived campaigns hidden from active list
- [ ] Archived campaigns viewable via filter
- [ ] Data preserved after archiving

### AC-5: Permissions Enforcement

- [ ] RLS policies enforce role-based access
- [ ] Only owners can edit their own entities
- [ ] Crew visibility via RLS (not client-side filtering)

### AC-6: Real-Time

- [ ] Changes by one user visible to crewmates in real time
- [ ] Multi-tab sync works
- [ ] TanStack Query cache invalidated via Supabase Realtime

### AC-7: Change Tracking

- [ ] Every stat edit creates a change_log entry
- [ ] Each entry has a human-readable description
- [ ] Related changes grouped by session_id

### AC-8: Live Sheet Editing

- [ ] Pilot HP/AP/TP directly editable
- [ ] Identity fields can be marked "used"
- [ ] Mech SP/EP/Heat directly editable
- [ ] System/module conditions changeable (intact/damaged/destroyed)

### AC-9: Progression

- [ ] Ability tree prerequisites enforced during training
- [ ] Core -> Advanced -> Legendary unlock chain works
- [ ] Abilities can be unlearned (costs TP, respects dependency chain)
- [ ] Crawler tech level upgradeable via scrap pool

### AC-10: Activity Feed

- [ ] Real-time toast notifications for crewmate actions
- [ ] Toasts show human-readable descriptions
- [ ] Toasts auto-dismiss after 5 seconds
- [ ] Only shows other players' actions

### AC-11: Cleanup & Best Practices

- [ ] All RLS policies use `(select auth.uid())` pattern
- [ ] Duplicate campaigns SELECT policies consolidated
- [ ] Missing FK indexes added
- [ ] No unused exports in suref-react barrel
- [ ] EntityDisplayContent decomposed into focused sub-components
- [ ] DRY violations addressed (repeated hook/utility patterns extracted)
- [ ] Typecheck, lint, and test pass cleanly

---

## Implementation Order

### Wave 1 — Infrastructure & Cleanup

1. **RLS performance migration** — Wrap all `auth.uid()` in `(select ...)`, consolidate duplicate policies, add missing FK indexes
2. **Codebase DRY pass** — Extract repeated patterns, consolidate utilities, decompose large components
3. **Change log API + hook** — changeLogApi, useChangeLog (infrastructure for Track B)
4. **Realtime subscription hook** — useRealtimeSubscription

### Wave 2 — Multiplayer (Track A)

5. **Campaign member API** — invite, uninvite, promote, self-demote, joinByCode
6. **Invite code system** — Generation, lookup, join flow
7. **RLS migration** — Extended visibility policies for pilots, mechs, mech_patterns, campaigns
8. **Member roster component** — Display members with role badges
9. **Invite UI** — Code display, copy, regenerate
10. **Role management UI** — Promote, uninvite, self-demote buttons
11. **Archiving** — Archive button, archived filter
12. **Visibility toggles** — On pilot detail + pattern cards

### Wave 3 — Live Play (Track B)

13. **Inline editing components** — StatEditor, ConditionToggle, UsedToggle
14. **Wire editing into pilot/mech detail** — Editable stats with change logging
15. **Wire realtime into existing hooks** — Pilot, mech, crawler subscriptions
16. **Ability training** — Training UI with tree prerequisites
17. **Crawler upgrading** — Tech level progression UI
18. **Campaign activity feed** — Toast notifications from change_log via Realtime
