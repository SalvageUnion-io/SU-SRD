-- ============================================================================
-- GAME MEMBER ENTITY VISIBILITY
-- ============================================================================
-- Allows game members to view SUEntities and PlayerChoices belonging to
-- pilots, mechs, and crawlers in games they are members of.
--
-- Relationship chain:
-- - Crawlers belong to games (crawler.game_id)
-- - Pilots belong to crawlers (pilot.crawler_id)
-- - Mechs belong to pilots (mech.pilot_id)
-- - SUEntities belong to pilots/mechs/crawlers
-- - PlayerChoices belong to SUEntities
--
-- Migration Date: 2025-02-05
-- ============================================================================

-- ============================================================================
-- SUENTITIES: Game member visibility
-- ============================================================================

-- Game members can view suentities for pilots/mechs/crawlers in their games
CREATE POLICY "Game members can view game suentities"
  ON suentities FOR SELECT
  TO authenticated
  USING (
    -- Entities belonging to crawlers in games the user is a member of
    (crawler_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM crawlers c
      WHERE c.id = suentities.crawler_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, auth.uid())
    ))
    OR
    -- Entities belonging to pilots whose crawler is in a game the user is a member of
    (pilot_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM pilots p
      JOIN crawlers c ON c.id = p.crawler_id
      WHERE p.id = suentities.pilot_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, auth.uid())
    ))
    OR
    -- Entities belonging to mechs whose pilot's crawler is in a game the user is a member of
    (mech_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM mechs m
      JOIN pilots p ON p.id = m.pilot_id
      JOIN crawlers c ON c.id = p.crawler_id
      WHERE m.id = suentities.mech_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, auth.uid())
    ))
  );

-- ============================================================================
-- PLAYER_CHOICES: Game member visibility
-- ============================================================================

-- Game members can view player choices for entities in their games
CREATE POLICY "Game members can view game player choices"
  ON player_choices FOR SELECT
  TO authenticated
  USING (
    -- Choices for entities in games the user is a member of
    entity_id IN (
      SELECT se.id FROM suentities se
      WHERE
        -- Entities belonging to crawlers in games the user is a member of
        (se.crawler_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM crawlers c
          WHERE c.id = se.crawler_id
            AND c.game_id IS NOT NULL
            AND is_game_member(c.game_id, auth.uid())
        ))
        OR
        -- Entities belonging to pilots whose crawler is in a game the user is a member of
        (se.pilot_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM pilots p
          JOIN crawlers c ON c.id = p.crawler_id
          WHERE p.id = se.pilot_id
            AND c.game_id IS NOT NULL
            AND is_game_member(c.game_id, auth.uid())
        ))
        OR
        -- Entities belonging to mechs whose pilot's crawler is in a game the user is a member of
        (se.mech_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM mechs m
          JOIN pilots p ON p.id = m.pilot_id
          JOIN crawlers c ON c.id = p.crawler_id
          WHERE m.id = se.mech_id
            AND c.game_id IS NOT NULL
            AND is_game_member(c.game_id, auth.uid())
        ))
    )
  );

-- ============================================================================
-- CARGO: Game member visibility
-- ============================================================================

-- Game members can view cargo for mechs/crawlers in their games
CREATE POLICY "Game members can view game cargo"
  ON cargo FOR SELECT
  TO authenticated
  USING (
    -- Cargo belonging to crawlers in games the user is a member of
    (crawler_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM crawlers c
      WHERE c.id = cargo.crawler_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, auth.uid())
    ))
    OR
    -- Cargo belonging to mechs whose pilot's crawler is in a game the user is a member of
    (mech_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM mechs m
      JOIN pilots p ON p.id = m.pilot_id
      JOIN crawlers c ON c.id = p.crawler_id
      WHERE m.id = cargo.mech_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, auth.uid())
    ))
  );

-- ============================================================================
-- PILOTS: Game member visibility
-- ============================================================================

-- Game members can view pilots in their games
CREATE POLICY "Game members can view game pilots"
  ON pilots FOR SELECT
  TO authenticated
  USING (
    crawler_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM crawlers c
      WHERE c.id = pilots.crawler_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, auth.uid())
    )
  );

-- ============================================================================
-- MECHS: Game member visibility
-- ============================================================================

-- Game members can view mechs in their games
CREATE POLICY "Game members can view game mechs"
  ON mechs FOR SELECT
  TO authenticated
  USING (
    pilot_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM pilots p
      JOIN crawlers c ON c.id = p.crawler_id
      WHERE p.id = mechs.pilot_id
        AND c.game_id IS NOT NULL
        AND is_game_member(c.game_id, auth.uid())
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Verify policies are created for suentities
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'suentities'
-- ORDER BY policyname;

-- Verify policies are created for player_choices
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'player_choices'
-- ORDER BY policyname;

-- Verify policies are created for cargo
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'cargo'
-- ORDER BY policyname;

-- Verify policies are created for pilots
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'pilots'
-- ORDER BY policyname;

-- Verify policies are created for mechs
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'mechs'
-- ORDER BY policyname;

-- Test: Check what suentities a specific user can see
-- SELECT se.id, se.schema_name, se.schema_ref_id, se.pilot_id, se.mech_id, se.crawler_id
-- FROM suentities se
-- WHERE (
--   -- Own entities
--   se.pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
--   OR se.mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
--   OR se.crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
--   OR
--   -- Entities in games the user is a member of
--   (se.crawler_id IS NOT NULL AND EXISTS (
--     SELECT 1 FROM crawlers c
--     WHERE c.id = se.crawler_id AND c.game_id IS NOT NULL AND is_game_member(c.game_id, auth.uid())
--   ))
--   OR (se.pilot_id IS NOT NULL AND EXISTS (
--     SELECT 1 FROM pilots p JOIN crawlers c ON c.id = p.crawler_id
--     WHERE p.id = se.pilot_id AND c.game_id IS NOT NULL AND is_game_member(c.game_id, auth.uid())
--   ))
--   OR (se.mech_id IS NOT NULL AND EXISTS (
--     SELECT 1 FROM mechs m JOIN pilots p ON p.id = m.pilot_id JOIN crawlers c ON c.id = p.crawler_id
--     WHERE m.id = se.mech_id AND c.game_id IS NOT NULL AND is_game_member(c.game_id, auth.uid())
--   ))
-- );

