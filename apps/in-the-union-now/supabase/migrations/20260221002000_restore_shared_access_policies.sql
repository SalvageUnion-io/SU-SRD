-- Restore shared-access RLS policies that were accidentally dropped.
-- The previous cleanup migration (20260221001000) removed old policies by name,
-- but some of those were shared-access policies for multiplayer, not just
-- owner-based policies. This migration restores them with the optimized
-- (select auth.uid()) pattern.
--
-- The owner-based CRUD policies from 20260221000000 remain in place.
-- This migration adds the SHARED ACCESS policies on top.

-- =============================================================================
-- CAMPAIGNS — Shared read access for campaign members
-- =============================================================================

-- Drop the owner-only SELECT policy (too restrictive — members need access)
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;

-- Unified campaign read: creator OR member
CREATE POLICY "Campaign access" ON campaigns FOR SELECT
  USING (
    created_by = (select auth.uid())
    OR id IN (SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid()))
  );

-- Mediators can update campaigns (name, crawler, archive, invite code)
CREATE POLICY "Mediators can update campaign" ON campaigns FOR UPDATE
  USING (id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = (select auth.uid()) AND role = 'mediator'
  ));

-- =============================================================================
-- CAMPAIGN_MEMBERS — Shared roster visibility + mediator management
-- =============================================================================

-- Drop the owner-only SELECT policy (too restrictive — members need roster)
DROP POLICY IF EXISTS "Users can view own memberships" ON campaign_members;

-- Members can view the full roster of their campaigns
CREATE POLICY "Members can view campaign roster" ON campaign_members FOR SELECT
  USING (campaign_id IN (
    SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid())
  ));

-- Mediators can update member roles (promote/demote)
CREATE POLICY "Mediators can update members" ON campaign_members FOR UPDATE
  USING (campaign_id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = (select auth.uid()) AND role = 'mediator'
  ));

-- Mediators can remove members
CREATE POLICY "Mediators can remove members" ON campaign_members FOR DELETE
  USING (campaign_id IN (
    SELECT campaign_id FROM campaign_members
    WHERE user_id = (select auth.uid()) AND role = 'mediator'
  ));

-- Drop the basic owner-only DELETE (replaced by mediator policy above)
DROP POLICY IF EXISTS "Users can delete own memberships" ON campaign_members;

-- =============================================================================
-- PILOTS — Shared visibility for crawler crew
-- =============================================================================

-- Drop the owner-only SELECT policy (too restrictive)
DROP POLICY IF EXISTS "Users can view own pilots" ON pilots;

-- Owner OR visible OR same crawler crew
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

-- =============================================================================
-- MECHS — Visible if parent pilot is visible
-- =============================================================================

-- Drop the owner-only SELECT (too restrictive)
DROP POLICY IF EXISTS "Users can view own mechs" ON mechs;

-- Owner OR mech belongs to a visible pilot on the same crawler
CREATE POLICY "Mech visibility" ON mechs FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR id IN (
      SELECT mech_id FROM pilots
      WHERE visible = true
        OR (
          crawler_id IS NOT NULL
          AND crawler_id IN (
            SELECT crawler_id FROM pilots
            WHERE user_id = (select auth.uid()) AND crawler_id IS NOT NULL
          )
        )
    )
  );

-- =============================================================================
-- CRAWLERS — Visible to all campaign members
-- =============================================================================

-- Drop the owner-only SELECT (too restrictive)
DROP POLICY IF EXISTS "Users can view own crawlers" ON crawlers;

-- Owner OR crawler is linked to a campaign the user is a member of
CREATE POLICY "Crawler visibility" ON crawlers FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR id IN (
      SELECT crawler_id FROM campaigns
      WHERE id IN (SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid()))
    )
  );

-- =============================================================================
-- ENTITY_REFS — Visible if parent is visible
-- =============================================================================

-- Drop the owner-only SELECT (too restrictive)
DROP POLICY IF EXISTS "Users can view own entity refs" ON entity_refs;

-- Owner OR parent entity belongs to a shared crawler context
CREATE POLICY "Entity ref visibility" ON entity_refs FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR parent_id IN (
      SELECT id FROM pilots WHERE visible = true
        OR (crawler_id IS NOT NULL AND crawler_id IN (
          SELECT crawler_id FROM pilots WHERE user_id = (select auth.uid()) AND crawler_id IS NOT NULL
        ))
    )
    OR parent_id IN (
      SELECT id FROM crawlers WHERE id IN (
        SELECT crawler_id FROM campaigns
        WHERE id IN (SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid()))
      )
    )
  );

-- =============================================================================
-- CARGO — Visible if parent is visible
-- =============================================================================

-- Drop the owner-only SELECT (too restrictive)
DROP POLICY IF EXISTS "Users can view own cargo" ON cargo;

-- Same visibility as entity_refs
CREATE POLICY "Cargo visibility" ON cargo FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR parent_id IN (
      SELECT id FROM crawlers WHERE id IN (
        SELECT crawler_id FROM campaigns
        WHERE id IN (SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid()))
      )
    )
  );

-- =============================================================================
-- PLAYER_CHOICES — Visible if parent is visible
-- =============================================================================

-- Drop the owner-only SELECT (too restrictive)
DROP POLICY IF EXISTS "Users can view own player choices" ON player_choices;

-- Owner OR parent is a shared pilot/crawler
CREATE POLICY "Player choice visibility" ON player_choices FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR parent_id IN (
      SELECT id FROM pilots WHERE visible = true
        OR (crawler_id IS NOT NULL AND crawler_id IN (
          SELECT crawler_id FROM pilots WHERE user_id = (select auth.uid()) AND crawler_id IS NOT NULL
        ))
    )
    OR parent_id IN (
      SELECT id FROM crawlers WHERE id IN (
        SELECT crawler_id FROM campaigns
        WHERE id IN (SELECT campaign_id FROM campaign_members WHERE user_id = (select auth.uid()))
      )
    )
  );

-- =============================================================================
-- MECH_PATTERNS — Visible if marked visible
-- =============================================================================

-- Drop the owner-only SELECT (too restrictive)
DROP POLICY IF EXISTS "Users can view own mech patterns" ON mech_patterns;

-- Owner OR marked visible
CREATE POLICY "Pattern visibility" ON mech_patterns FOR SELECT
  USING (visible = true OR user_id = (select auth.uid()));
