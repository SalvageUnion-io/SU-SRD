-- Fix RLS Performance Issues - Wrap auth.uid() in subqueries
-- Wraps auth.uid() in a subquery to prevent re-evaluation for each row
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Issue: RLS policies using auth.uid() directly cause it to be re-evaluated for each row,
-- leading to suboptimal query performance at scale.
-- Fix: Wrap auth.uid() in a subquery: (select auth.uid()) so it's only evaluated once per query.

-- ============================================================================
-- MECHS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own mechs" ON mechs;
CREATE POLICY "Users can delete their own mechs"
  ON mechs FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own mechs" ON mechs;
CREATE POLICY "Users can insert their own mechs"
  ON mechs FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Already fixed in previous migration, but keeping for completeness
DROP POLICY IF EXISTS "Users can update their own mechs" ON mechs;
CREATE POLICY "Users can update their own mechs"
  ON mechs FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own mechs" ON mechs;
CREATE POLICY "Users can view their own mechs"
  ON mechs FOR SELECT
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PILOTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own pilots" ON pilots;
CREATE POLICY "Users can delete their own pilots"
  ON pilots FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own pilots" ON pilots;
CREATE POLICY "Users can insert their own pilots"
  ON pilots FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own pilots" ON pilots;
CREATE POLICY "Users can update their own pilots"
  ON pilots FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own pilots" ON pilots;
CREATE POLICY "Users can view their own pilots"
  ON pilots FOR SELECT
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- CRAWLERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own crawlers" ON crawlers;
CREATE POLICY "Users can delete their own crawlers"
  ON crawlers FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own crawlers" ON crawlers;
CREATE POLICY "Users can insert their own crawlers"
  ON crawlers FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own crawlers" ON crawlers;
CREATE POLICY "Users can update their own crawlers"
  ON crawlers FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own crawlers" ON crawlers;
CREATE POLICY "Users can view their own crawlers"
  ON crawlers FOR SELECT
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- GAMES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can create games" ON games;
CREATE POLICY "Users can create games"
  ON games FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- GAME_MEMBERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Mediators can remove members or users can leave" ON game_members;
CREATE POLICY "Mediators can remove members or users can leave"
  ON game_members FOR DELETE
  USING ((user_id = (select auth.uid())) OR is_game_mediator(game_id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can view game members" ON game_members;
CREATE POLICY "Users can view game members"
  ON game_members FOR SELECT
  USING ((user_id = (select auth.uid())) OR is_game_member(game_id, (select auth.uid())));

-- ============================================================================
-- STORAGE.OBJECTS TABLE (User Images)
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
CREATE POLICY "Users can delete their own images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-images' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
CREATE POLICY "Users can update their own images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-images' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'user-images' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
CREATE POLICY "Users can upload their own images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-images' AND
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================================
-- CARGO TABLE (fix auth.uid() in subqueries)
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own cargo" ON cargo;
CREATE POLICY "Users can delete their own cargo"
  ON cargo FOR DELETE
  USING (
    mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert their own cargo" ON cargo;
CREATE POLICY "Users can insert their own cargo"
  ON cargo FOR INSERT
  WITH CHECK (
    mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update their own cargo" ON cargo;
CREATE POLICY "Users can update their own cargo"
  ON cargo FOR UPDATE
  USING (
    mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view their own cargo" ON cargo;
CREATE POLICY "Users can view their own cargo"
  ON cargo FOR SELECT
  USING (
    mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- SUENTITIES TABLE (fix auth.uid() in subqueries)
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete their own entities" ON suentities;
CREATE POLICY "Users can delete their own entities"
  ON suentities FOR DELETE
  USING (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = (select auth.uid()))
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert their own entities" ON suentities;
CREATE POLICY "Users can insert their own entities"
  ON suentities FOR INSERT
  WITH CHECK (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = (select auth.uid()))
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update their own entities" ON suentities;
CREATE POLICY "Users can update their own entities"
  ON suentities FOR UPDATE
  USING (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = (select auth.uid()))
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view their own entities" ON suentities;
CREATE POLICY "Users can view their own entities"
  ON suentities FOR SELECT
  USING (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = (select auth.uid()))
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = (select auth.uid()))
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = (select auth.uid()))
  );

