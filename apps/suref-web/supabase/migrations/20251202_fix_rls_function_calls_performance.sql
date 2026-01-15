-- Fix RLS Performance Issues - Wrap auth.uid() in function calls
-- Wraps auth.uid() in subqueries when passed to functions to prevent re-evaluation
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Issue: RLS policies passing auth.uid() to functions cause it to be re-evaluated for each row.
-- Fix: Wrap auth.uid() in a subquery: (select auth.uid()) when passing to functions.

-- ============================================================================
-- CRAWLERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game crawlers" ON crawlers;
CREATE POLICY "Game members can view game crawlers"
  ON crawlers FOR SELECT
  TO authenticated
  USING (
    (game_id IS NOT NULL) AND is_game_member(game_id, (select auth.uid()))
  );

-- ============================================================================
-- MECHS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game mechs" ON mechs;
CREATE POLICY "Game members can view game mechs"
  ON mechs FOR SELECT
  TO authenticated
  USING (
    pilot_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM pilots p
      JOIN crawlers c ON c.id = p.crawler_id
      WHERE p.id = mechs.pilot_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Game members can view other members' mechs" ON mechs;
CREATE POLICY "Game members can view other members' mechs"
  ON mechs FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT DISTINCT gm.user_id
      FROM game_members gm
      WHERE gm.game_id IN (
        SELECT game_members.game_id
        FROM game_members
        WHERE game_members.user_id = (select auth.uid())
      )
    )
  );

-- ============================================================================
-- PILOTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game pilots" ON pilots;
CREATE POLICY "Game members can view game pilots"
  ON pilots FOR SELECT
  TO authenticated
  USING (
    crawler_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM crawlers c
      WHERE c.id = pilots.crawler_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Game members can view other members' pilots" ON pilots;
CREATE POLICY "Game members can view other members' pilots"
  ON pilots FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT DISTINCT gm.user_id
      FROM game_members gm
      WHERE gm.game_id IN (
        SELECT game_members.game_id
        FROM game_members
        WHERE game_members.user_id = (select auth.uid())
      )
    )
  );

-- ============================================================================
-- GAMES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Mediators can delete games" ON games;
CREATE POLICY "Mediators can delete games"
  ON games FOR DELETE
  TO authenticated
  USING (is_game_mediator(id, (select auth.uid())));

DROP POLICY IF EXISTS "Mediators can update games" ON games;
CREATE POLICY "Mediators can update games"
  ON games FOR UPDATE
  TO authenticated
  USING (is_game_mediator(id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can view their games" ON games;
CREATE POLICY "Users can view their games"
  ON games FOR SELECT
  TO authenticated
  USING (
    is_game_member(id, (select auth.uid())) OR (created_by = (select auth.uid()))
  );

-- ============================================================================
-- GAME_MEMBERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Mediators can add members" ON game_members;
CREATE POLICY "Mediators can add members"
  ON game_members FOR INSERT
  TO authenticated
  WITH CHECK (is_game_mediator(game_id, (select auth.uid())));

DROP POLICY IF EXISTS "Mediators can update member roles" ON game_members;
CREATE POLICY "Mediators can update member roles"
  ON game_members FOR UPDATE
  TO authenticated
  USING (is_game_mediator(game_id, (select auth.uid())));

-- ============================================================================
-- GAME_INVITES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Mediators can create invites" ON game_invites;
CREATE POLICY "Mediators can create invites"
  ON game_invites FOR INSERT
  TO authenticated
  WITH CHECK (is_game_mediator(game_id, (select auth.uid())));

DROP POLICY IF EXISTS "Mediators can delete invites" ON game_invites;
CREATE POLICY "Mediators can delete invites"
  ON game_invites FOR DELETE
  TO authenticated
  USING (is_game_mediator(game_id, (select auth.uid())));

DROP POLICY IF EXISTS "Members can view invites for their games" ON game_invites;
CREATE POLICY "Members can view invites for their games"
  ON game_invites FOR SELECT
  TO authenticated
  USING (is_game_member(game_id, (select auth.uid())));

-- ============================================================================
-- EXTERNAL_LINKS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view external links" ON external_links;
CREATE POLICY "Game members can view external links"
  ON external_links FOR SELECT
  TO authenticated
  USING (is_game_member(game_id, (select auth.uid())));

DROP POLICY IF EXISTS "Mediators can create external links" ON external_links;
CREATE POLICY "Mediators can create external links"
  ON external_links FOR INSERT
  TO authenticated
  WITH CHECK (is_game_mediator(game_id, (select auth.uid())));

DROP POLICY IF EXISTS "Mediators can delete external links" ON external_links;
CREATE POLICY "Mediators can delete external links"
  ON external_links FOR DELETE
  TO authenticated
  USING (is_game_mediator(game_id, (select auth.uid())));

DROP POLICY IF EXISTS "Mediators can update external links" ON external_links;
CREATE POLICY "Mediators can update external links"
  ON external_links FOR UPDATE
  TO authenticated
  USING (is_game_mediator(game_id, (select auth.uid())));

-- ============================================================================
-- SUENTITIES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game suentities" ON suentities;
CREATE POLICY "Game members can view game suentities"
  ON suentities FOR SELECT
  TO authenticated
  USING (
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
  );

-- ============================================================================
-- CARGO TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Game members can view game cargo" ON cargo;
CREATE POLICY "Game members can view game cargo"
  ON cargo FOR SELECT
  TO authenticated
  USING (
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
  );

-- ============================================================================
-- PLAYER_CHOICES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own player choices" ON player_choices;
CREATE POLICY "Users can delete their own player choices"
  ON player_choices FOR DELETE
  TO authenticated
  USING (user_owns_choice(id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can update their own player choices" ON player_choices;
CREATE POLICY "Users can update their own player choices"
  ON player_choices FOR UPDATE
  TO authenticated
  USING (user_owns_choice(id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can view their own player choices" ON player_choices;
CREATE POLICY "Users can view their own player choices"
  ON player_choices FOR SELECT
  TO authenticated
  USING (user_owns_choice(id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own player choices" ON player_choices;
CREATE POLICY "Users can insert their own player choices"
  ON player_choices FOR INSERT
  TO authenticated
  WITH CHECK (
    -- If entity_id is set, check entity ownership
    (entity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM suentities
      WHERE suentities.id = player_choices.entity_id AND (
        suentities.pilot_id IN (SELECT pilots.id FROM pilots WHERE pilots.user_id = (select auth.uid()))
        OR suentities.mech_id IN (SELECT mechs.id FROM mechs WHERE mechs.user_id = (select auth.uid()))
        OR suentities.crawler_id IN (SELECT crawlers.id FROM crawlers WHERE crawlers.user_id = (select auth.uid()))
      )
    ))
    OR
    -- If player_choice_id is set, check choice ownership
    (player_choice_id IS NOT NULL AND user_owns_choice(player_choice_id, (select auth.uid())))
  );

DROP POLICY IF EXISTS "Game members can view game player choices" ON player_choices;
CREATE POLICY "Game members can view game player choices"
  ON player_choices FOR SELECT
  TO authenticated
  USING (
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
  );

