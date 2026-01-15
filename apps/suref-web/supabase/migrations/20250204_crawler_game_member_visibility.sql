-- ============================================================================
-- CRAWLER GAME MEMBER VISIBILITY
-- ============================================================================
-- Ensures that users can see crawlers from games they are members of
-- This allows pilots to be assigned to crawlers in their game
--
-- Migration Date: 2025-02-04
-- ============================================================================

-- Drop existing policies if they exist (to ensure clean state)
DROP POLICY IF EXISTS "Game members can view game crawlers" ON crawlers;
DROP POLICY IF EXISTS "Game members can view other members' crawlers" ON crawlers;

-- ============================================================================
-- POLICY: Game members can view crawlers assigned to their games
-- ============================================================================
-- Users can view crawlers that have a game_id if they are members of that game
CREATE POLICY "Game members can view game crawlers"
  ON crawlers FOR SELECT
  TO authenticated
  USING (
    game_id IS NOT NULL 
    AND is_game_member(game_id, auth.uid())
  );

-- ============================================================================
-- NOTE: Removed "Game members can view other members' crawlers" policy
-- ============================================================================
-- Users can ONLY see other users' crawlers if they are assigned to a shared game
-- This prevents seeing crawlers owned by game members unless explicitly assigned to the game

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Verify policies are created
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'crawlers'
-- ORDER BY policyname;

-- Test: Check what crawlers a specific user can see
-- SELECT c.id, c.name, c.game_id, c.user_id
-- FROM crawlers c
-- WHERE (
--   -- Own crawlers
--   c.user_id = auth.uid()
--   OR
--   -- Crawlers assigned to games the user is a member of
--   (c.game_id IS NOT NULL AND is_game_member(c.game_id, auth.uid()))
-- );

