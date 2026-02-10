-- Fix Player Choices Game Member Permissions
-- Allows game members to insert/update/delete player choices for entities in their games
-- 
-- Issue: INSERT/UPDATE/DELETE policies only checked for direct ownership (user_id = auth.uid()),
-- not game membership. This caused 403 errors when game members tried to modify choices for
-- entities belonging to crawlers in games they're members of.
-- 
-- Fix: Update INSERT/UPDATE/DELETE policies to also allow game members, matching the SELECT policy
-- behavior. This ensures game members can modify choices for entities in their games.

-- ============================================================================
-- PLAYER_CHOICES TABLE - INSERT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own player choices" ON player_choices;

CREATE POLICY "Users can insert player choices"
  ON player_choices FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can insert choices for entities they own directly
    (
      entity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM suentities su
        WHERE su.id = entity_id AND (
          su.pilot_id IN (SELECT id FROM pilots WHERE user_id = (select auth.uid()))
          OR su.mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
          OR su.crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
        )
      )
    )
    OR
    -- Game members can insert choices for entities in their games
    (
      entity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM suentities se
        WHERE se.id = entity_id AND (
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
    )
    OR
    -- Users can insert nested choices for choices they own
    (
      player_choice_id IS NOT NULL AND user_owns_choice(player_choice_id, (select auth.uid()))
    )
  );

-- ============================================================================
-- PLAYER_CHOICES TABLE - UPDATE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can update their own player choices" ON player_choices;

CREATE POLICY "Users can update player choices"
  ON player_choices FOR UPDATE
  TO authenticated
  USING (
    -- Users can update choices they own directly (via user_owns_choice - handles nested choices recursively)
    user_owns_choice(id, (select auth.uid()))
    OR
    -- Game members can update choices for entities in their games
    (
      entity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM suentities se
        WHERE se.id = player_choices.entity_id AND (
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
    )
  );

-- ============================================================================
-- PLAYER_CHOICES TABLE - DELETE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own player choices" ON player_choices;

CREATE POLICY "Users can delete player choices"
  ON player_choices FOR DELETE
  TO authenticated
  USING (
    -- Users can delete choices they own directly (via user_owns_choice - handles nested choices recursively)
    user_owns_choice(id, (select auth.uid()))
    OR
    -- Game members can delete choices for entities in their games
    (
      entity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM suentities se
        WHERE se.id = player_choices.entity_id AND (
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
    )
  );

