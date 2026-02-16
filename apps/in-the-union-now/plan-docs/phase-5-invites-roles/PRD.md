# Phase 5 — User Invites & Roles

## Scope

Campaign role management, user invitations, visibility/sharing, and crawler crew access. This phase makes campaigns fully multiplayer.

**What ships:**

- Campaign invite system (invite codes)
- Campaign role management (Mediator / Player)
- Mediator powers: invite, uninvite, promote, self-demote, edit crawler, archive
- Player powers: assign pilots, view campaign
- Pilot and pattern visibility toggles
- Crawler crew visibility (pilots on same crawler see each other's data)
- Campaign archiving (soft delete)

**What does NOT ship:**

- Live editing, change tracking, real-time, downtime, progression (Phase 6)

---

## User Stories

### Campaign Roles

- **US-R1**: As a user, when I create a campaign, I am automatically assigned as its **Mediator**.
- **US-R2**: As a Mediator, I can invite users to my campaign. Default role: Player. Can also invite as Mediator.
- **US-R3**: As a Mediator, I can remove (uninvite) players from the campaign.
- **US-R4**: As a Mediator, I can promote a Player to Mediator.
- **US-R5**: As a Mediator, I can demote **only myself** from Mediator to Player (cannot demote other Mediators).
- **US-R6**: As a Mediator, I can edit the campaign's crawler.
- **US-R7**: As a Mediator, I can archive a campaign (soft delete — hides from active list, preserves data).
- **US-R8**: As a Player, I can assign one of my pilots to the campaign's crawler.
- **US-R9**: As a campaign member, I can see the pilot and mech sheets of other pilots on the same crawler.

### Visibility & Sharing

- **US-R10**: As a player, I can toggle my pilot's visibility so other users can view my pilot sheet.
- **US-R11**: As a player, I can toggle a pattern's visibility so other users can browse it.
- **US-R12**: As a crawler crewmate, I can see other crew members' pilot and mech data regardless of their visibility toggle.

---

## Role Rules

| Role         | Invite/Uninvite | Edit Crawler | Promote to Mediator | Demote    | Archive |
| ------------ | --------------- | ------------ | ------------------- | --------- | ------- |
| **Mediator** | Yes             | Yes          | Yes (any Player)    | Self only | Yes     |
| **Player**   | No              | No           | No                  | No        | No      |

- Multiple Mediators allowed per campaign.
- Users can be invited as Player (default) or Mediator.
- Mediators can promote Players to Mediator.
- Mediators can only demote **themselves** (cannot demote other Mediators).

---

## Invite System

- Campaigns have an `invite_code` (unique text string).
- Mediators can generate/regenerate invite codes.
- Users join a campaign by entering the invite code.
- Joining assigns the user as Player by default.
- Mediators can also directly invite by user email/ID.

---

## Visibility Rules

| Entity  | `visible=false`                     | `visible=true`                 | Same Crawler                        |
| ------- | ----------------------------------- | ------------------------------ | ----------------------------------- |
| Pilot   | Owner only                          | All authenticated users (read) | Crew can view regardless of visible |
| Mech    | Same as pilot (via pilot ownership) | Same as pilot                  | Same as pilot                       |
| Pattern | Owner only                          | All authenticated users (read) | N/A                                 |

---

## Campaign Archiving

- Archiving sets `campaigns.archived = true`.
- Archived campaigns are hidden from the active campaign list.
- All data is preserved (pilots remain assigned, history intact).
- Only Mediators can archive.
- Archived campaigns can still be viewed in a "History" or "Archived" section.

---

## Acceptance Criteria

### AC-1: Invite System

- [ ] Campaigns have unique invite codes
- [ ] Mediators can generate/regenerate invite codes
- [ ] Users can join a campaign via invite code
- [ ] Joining assigns Player role by default

### AC-2: Role Management

- [ ] Mediators can promote Players to Mediator
- [ ] Mediators can only demote themselves
- [ ] Mediators can uninvite players
- [ ] Mediators can edit the campaign crawler
- [ ] Players cannot invite, uninvite, or edit crawler

### AC-3: Visibility

- [ ] Pilots have a "visible" toggle
- [ ] Patterns have a "visible" toggle
- [ ] Visible entities are viewable by all authenticated users (read-only)
- [ ] Crawler crewmates can see each other's pilot/mech data regardless of visible flag

### AC-4: Campaign Archiving

- [ ] Mediators can archive campaigns
- [ ] Archived campaigns hidden from active list
- [ ] Archived campaigns viewable in history
- [ ] Data preserved after archiving

### AC-5: Permissions Enforcement

- [ ] RLS policies enforce role-based access
- [ ] Only owners can edit their own entities
- [ ] Crew visibility via RLS (not client-side filtering)
