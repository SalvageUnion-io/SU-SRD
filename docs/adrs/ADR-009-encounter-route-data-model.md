# ADR-009: Encounter Route Data Model

## Status

Proposed

## Context

The encounter route (`/games/:gameId/encounter`) is the largest structural gap in ITUN's live-play surface. It requires two new Supabase tables — `encounters` and `encounter_participants` — that sit at the intersection of campaign membership, Mediator authority, and realtime multiplayer sync. Before any implementation begins, four structural decisions must be resolved. Leaving these to implementation-time judgment risks incompatible RLS policies, a data model that cannot support the required visibility rules, and duplication of state that is actively managed elsewhere.

The proposed route allows the Mediator to create an encounter, track initiative (Group Initiative roll resolves to `players` or `npcs`), add enemy participants from the `salvageunion-reference` entity catalog, track HP/SP per participant, and share a live read-only view with players at the table. Player mechs may also appear as participants for Mediator reference.

The `entity_refs` table is the established pattern for row-per-tracked-item data in this codebase (`schema_name` + `schema_ref_id` + runtime state columns). `encounter_participants` follows the same shape.

## Decisions

### 1. Encounter Concurrency

**Decision:** One active encounter per campaign at a time.

The `encounters` table has an `is_active` boolean column. Creating a new encounter sets `is_active = false` on any prior active encounter for the same campaign. There is no concurrent multi-encounter model in this version.

**Rationale:** Salvage Union's structure is one crawler per campaign; encounters occur at a specific hex or zone and are resolved before the crew moves on. The game does not have simultaneous combats in different zones as a routine event. One active encounter per campaign matches the actual play pattern and is the simplest possible RLS shape — the Mediator's write policies need only check campaign membership, not manage a multi-encounter context.

The `campaigns.session_state` JSONB field (introduced in the Session Anchor story) includes an `active_encounter_id` stub precisely because one-at-a-time was the assumed model from the start. This ADR formalizes that assumption.

**Deferred:** A future story could support multiple named encounters (e.g., simultaneous combats in Zone A and Zone B during a complex narrative beat). That would require a more complex UI and separate RLS contexts. It is explicitly out of scope here.

---

### 2. Enemy HP Visibility Model

**Decision:** `is_visible BOOLEAN NOT NULL DEFAULT true` on `encounter_participants`. The Mediator controls visibility per participant. Players see only participants where `is_visible = true` OR where `is_player = true` (players always see their own mech row).

**Rationale:** The ticket's assumption — a simple boolean per participant — is the right granularity. The two simpler alternatives are both worse UX:

- All participants visible by default (no toggle): removes Mediator control entirely. The Mediator cannot withhold an enemy's HP from players before a reveal.
- All participants hidden by default (Mediator reveals): forces the Mediator to explicitly reveal every participant at encounter start, including ones that should obviously be visible (e.g., the charging enemy that just attacked).

The per-participant `is_visible` flag gives the Mediator the minimum necessary control without building a positional fog-of-war system, which would require tile/hex data that this codebase does not have and does not need.

This is not a fog-of-war model. It is a simple reveal flag. The Mediator view shows all participants; the player view filters by `is_visible = true OR is_player = true`.

**Consequence for RLS:** The player SELECT policy on `encounter_participants` must apply the visibility filter at the database layer. See Decision 4 for the exact policy.

---

### 3. Player Mech Representation in `encounter_participants`

**Decision:** Player mechs are represented as rows in `encounter_participants` with `is_player = true`. HP and SP values are duplicated from the `mechs` table at the time the Mediator adds them. Subsequent mutations to a player's mech sheet do not automatically propagate to the encounter row.

**Rationale:** The `mechs` table's HP and SP columns are live player-managed state. They mutate frequently via the character sheet's inline editing, damage cascade hooks, and AP/EP tracking. Querying them directly from the encounter view would require the encounter's RLS to reach through `encounter_participants` → `encounters` → `campaigns` → `mechs`, crossing two ownership boundaries (Mediator-owned encounter, player-owned mech). That cross-boundary query is not supported cleanly by the current RLS model and would require a security-definer RPC or a view — both of which add complexity that is not warranted here.

The encounter is a Mediator-managed snapshot, not a live mirror of player character state. The Mediator adds players at encounter start; from that point, the encounter row is the Mediator's working reference for HP/SP during combat. The player manages their own sheet in parallel via the character sheet surface.

The trade-off (data drift if a player updates their mech sheet mid-encounter) is acceptable: the Mediator is expected to be the source of truth for encounter state. If a player takes damage and updates their sheet, the Mediator can update the encounter row to match.

The `entity_refs` pattern is the precedent: `entity_refs` rows carry runtime state (`condition`) independently of the reference data they point to. `encounter_participants` extends this pattern to carry HP/SP state independently of either the reference entity (for enemies) or the mech row (for player mechs).

**Add-players flow:** The Mediator's "Add Players" flow must query the `mechs` table to seed initial HP/SP values into `encounter_participants` rows. This is the only point of direct data transfer between the two tables.

---

### 4. RLS Policy Shape

**Decision:** Both tables use the `(select auth.uid())` subquery pattern established in `20260221002000_restore_shared_access_policies.sql`. The policy shapes are as follows.

**For `encounters`:**

```sql
-- SELECT: any campaign member
CREATE POLICY "Campaign members can view encounters" ON encounters FOR SELECT
  USING (
    campaign_id IN (
      SELECT campaign_id FROM campaign_members
      WHERE user_id = (select auth.uid())
    )
  );

-- INSERT: mediator only
CREATE POLICY "Mediators can create encounters" ON encounters FOR INSERT
  WITH CHECK (
    campaign_id IN (
      SELECT campaign_id FROM campaign_members
      WHERE user_id = (select auth.uid()) AND role = 'mediator'
    )
  );

-- UPDATE: mediator only
CREATE POLICY "Mediators can update encounters" ON encounters FOR UPDATE
  USING (
    campaign_id IN (
      SELECT campaign_id FROM campaign_members
      WHERE user_id = (select auth.uid()) AND role = 'mediator'
    )
  );

-- DELETE: mediator only
CREATE POLICY "Mediators can delete encounters" ON encounters FOR DELETE
  USING (
    campaign_id IN (
      SELECT campaign_id FROM campaign_members
      WHERE user_id = (select auth.uid()) AND role = 'mediator'
    )
  );
```

**For `encounter_participants`:**

```sql
-- SELECT (mediator): all participants in encounters the mediator controls
-- SELECT (player): only visible participants OR their own mech row
CREATE POLICY "Encounter participant visibility" ON encounter_participants FOR SELECT
  USING (
    (is_visible = true OR is_player = true)
    AND encounter_id IN (
      SELECT id FROM encounters
      WHERE campaign_id IN (
        SELECT campaign_id FROM campaign_members
        WHERE user_id = (select auth.uid())
      )
    )
  );

-- Mediators see all participants, including hidden ones
CREATE POLICY "Mediators can view all participants" ON encounter_participants FOR SELECT
  USING (
    encounter_id IN (
      SELECT id FROM encounters
      WHERE campaign_id IN (
        SELECT campaign_id FROM campaign_members
        WHERE user_id = (select auth.uid()) AND role = 'mediator'
      )
    )
  );

-- INSERT/UPDATE/DELETE: mediator only
CREATE POLICY "Mediators can manage participants" ON encounter_participants
  FOR ALL
  USING (
    encounter_id IN (
      SELECT id FROM encounters
      WHERE campaign_id IN (
        SELECT campaign_id FROM campaign_members
        WHERE user_id = (select auth.uid()) AND role = 'mediator'
      )
    )
  );
```

**Required indexes:** The subquery chain is non-trivial. The following indexes are required for acceptable query performance:

```sql
CREATE INDEX idx_encounters_campaign_id ON encounters(campaign_id);
CREATE INDEX idx_encounter_participants_encounter_id ON encounter_participants(encounter_id);
CREATE INDEX idx_encounter_participants_is_visible ON encounter_participants(is_visible);
```

**Rationale:** The `(select auth.uid())` form (subquery, not bare function call) is the established pattern in this codebase for performance — PostgreSQL can cache the subquery result within a query plan, whereas `auth.uid()` as a bare call is evaluated per-row. All existing shared-access policies in `20260221002000_restore_shared_access_policies.sql` use this form. The encounter policies must follow the same convention.

The participant visibility policy has two SELECT policies on the same table (one for players with the visibility filter, one for mediators without it). This is intentional: Supabase/PostgreSQL evaluates RLS policies with OR between them for SELECT, so a mediator (who satisfies the mediator policy) sees all rows, while a player (who does not satisfy the mediator policy) is constrained to the visibility-filtered policy.

## Consequences

- The encounter route implementation can proceed once this ADR is approved by both maintainers. No implementation decisions of structural significance should be made before approval.
- The `campaigns.session_state.active_encounter_id` stub (from the Session Anchor story) is confirmed as the correct integration point. When creating an encounter, the implementation must set this field; when closing an encounter, it must clear it.
- The `item_condition` enum (`intact` / `damaged` / `destroyed`) is reused on `encounter_participants.condition`. No new enum is needed.
- The `encounter_participants` table does not have a `user_id` column. Ownership is mediated entirely through `encounter_id` → `encounters.campaign_id` → `campaign_members`. This is a departure from other tables (pilots, mechs, entity_refs) that carry direct `user_id` foreign keys. The RLS consequences are captured in Decision 4 above.
- The one-at-a-time concurrency model means the encounter route cannot support Mediator-run simultaneous combats. This is an accepted constraint for the initial story. The `is_active` flag leaves the door open for a multi-encounter model without a schema change — it would require new UI and RLS extensions only.
- AP/EP turn reset, reaction triggers, NPC morale tables, and end-of-encounter salvage integration are not in scope for the initial encounter route story. They are enabled by this model and belong in follow-on stories.
