-- Combine Multiple Permissive RLS Policies
-- Merges multiple permissive policies for the same role/action into single policies
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#performance
--
-- Issue: Multiple permissive policies for the same role and action cause PostgreSQL
-- to evaluate all policies for every query, leading to suboptimal performance.
-- Fix: Combine multiple permissive policies into a single policy using OR logic.

-- ============================================================================
-- CARGO TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game cargo" ON cargo;
DROP POLICY IF EXISTS "Users can view their own cargo" ON cargo;

CREATE POLICY "Users can view cargo"
  ON cargo FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own cargo
    (
      mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
      OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
    )
    OR
    -- Game members can view cargo in their games
    (
      -- Cargo belonging to crawlers in games the user is a member of
      (crawler_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM crawlers c
        WHERE c.id = cargo.crawler_id
          AND c.game_id IS NOT NULL
          AND is_game_member(c.game_id, (select auth.uid()))
      ))
      OR
      -- Cargo belonging to mechs whose pilot's crawler is in a game the user is a member of
      (mech_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM mechs m
        JOIN pilots p ON p.id = m.pilot_id
        JOIN crawlers c ON c.id = p.crawler_id
        WHERE m.id = cargo.mech_id
          AND c.game_id IS NOT NULL
          AND is_game_member(c.game_id, (select auth.uid()))
      ))
    )
  );

-- ============================================================================
-- CRAWLERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game crawlers" ON crawlers;
DROP POLICY IF EXISTS "Users can view their own crawlers" ON crawlers;

CREATE POLICY "Users can view crawlers"
  ON crawlers FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own crawlers
    ((select auth.uid()) = user_id)
    OR
    -- Game members can view crawlers in their games
    ((game_id IS NOT NULL) AND is_game_member(game_id, (select auth.uid())))
  );

-- ============================================================================
-- MECHS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game mechs" ON mechs;
DROP POLICY IF EXISTS "Game members can view other members' mechs" ON mechs;
DROP POLICY IF EXISTS "Users can view their own mechs" ON mechs;

CREATE POLICY "Users can view mechs"
  ON mechs FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own mechs
    ((select auth.uid()) = user_id)
    OR
    -- Game members can view mechs in their games
    (
      pilot_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM pilots p
        JOIN crawlers c ON c.id = p.crawler_id
        WHERE p.id = mechs.pilot_id
          AND c.game_id IS NOT NULL
          AND is_game_member(c.game_id, (select auth.uid()))
      )
    )
    OR
    -- Game members can view other members' mechs in shared games
    (
      user_id IN (
        SELECT DISTINCT gm.user_id
        FROM game_members gm
        WHERE gm.game_id IN (
          SELECT game_members.game_id
          FROM game_members
          WHERE game_members.user_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- PILOTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game pilots" ON pilots;
DROP POLICY IF EXISTS "Game members can view other members' pilots" ON pilots;
DROP POLICY IF EXISTS "Users can view their own pilots" ON pilots;

CREATE POLICY "Users can view pilots"
  ON pilots FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own pilots
    ((select auth.uid()) = user_id)
    OR
    -- Game members can view pilots in their games
    (
      crawler_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM crawlers c
        WHERE c.id = pilots.crawler_id
          AND c.game_id IS NOT NULL
          AND is_game_member(c.game_id, (select auth.uid()))
      )
    )
    OR
    -- Game members can view other members' pilots in shared games
    (
      user_id IN (
        SELECT DISTINCT gm.user_id
        FROM game_members gm
        WHERE gm.game_id IN (
          SELECT game_members.game_id
          FROM game_members
          WHERE game_members.user_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- PLAYER_CHOICES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game player choices" ON player_choices;
DROP POLICY IF EXISTS "Users can view their own player choices" ON player_choices;

CREATE POLICY "Users can view player choices"
  ON player_choices FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own player choices
    user_owns_choice(id, (select auth.uid()))
    OR
    -- Game members can view player choices for entities in their games
    (
      entity_id IN (
        SELECT se.id FROM suentities se
        WHERE
          -- Entities belonging to crawlers in games the user is a member of
          (se.crawler_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM crawlers c
            WHERE c.id = se.crawler_id
              AND c.game_id IS NOT NULL
              AND is_game_member(c.game_id, (select auth.uid()))
          ))
          OR
          -- Entities belonging to pilots whose crawler is in a game the user is a member of
          (se.pilot_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM pilots p
            JOIN crawlers c ON c.id = p.crawler_id
            WHERE p.id = se.pilot_id
              AND c.game_id IS NOT NULL
              AND is_game_member(c.game_id, (select auth.uid()))
          ))
          OR
          -- Entities belonging to mechs whose pilot's crawler is in a game the user is a member of
          (se.mech_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM mechs m
            JOIN pilots p ON p.id = m.pilot_id
            JOIN crawlers c ON c.id = p.crawler_id
            WHERE m.id = se.mech_id
              AND c.game_id IS NOT NULL
              AND is_game_member(c.game_id, (select auth.uid()))
          ))
      )
    )
  );

-- ============================================================================
-- SUENTITIES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game suentities" ON suentities;
DROP POLICY IF EXISTS "Users can view their own entities" ON suentities;

CREATE POLICY "Users can view suentities"
  ON suentities FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own entities
    (
      pilot_id IN (SELECT id FROM pilots WHERE user_id = (select auth.uid()))
      OR mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
      OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
    )
    OR
    -- Game members can view entities in their games
    (
      -- Entities belonging to crawlers in games the user is a member of
      (crawler_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM crawlers c
        WHERE c.id = suentities.crawler_id
          AND c.game_id IS NOT NULL
          AND is_game_member(c.game_id, (select auth.uid()))
      ))
      OR
      -- Entities belonging to pilots whose crawler is in a game the user is a member of
      (pilot_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM pilots p
        JOIN crawlers c ON c.id = p.crawler_id
        WHERE p.id = suentities.pilot_id
          AND c.game_id IS NOT NULL
          AND is_game_member(c.game_id, (select auth.uid()))
      ))
      OR
      -- Entities belonging to mechs whose pilot's crawler is in a game the user is a member of
      (mech_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM mechs m
        JOIN pilots p ON p.id = m.pilot_id
        JOIN crawlers c ON c.id = p.crawler_id
        WHERE m.id = suentities.mech_id
          AND c.game_id IS NOT NULL
          AND is_game_member(c.game_id, (select auth.uid()))
      ))
    )
  );

