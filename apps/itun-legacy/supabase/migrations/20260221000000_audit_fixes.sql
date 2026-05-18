-- Monorepo Audit: Database fixes
-- Applied: 2026-02-20
--
-- 1. Add missing indexes on FK columns
-- 2. Fix RLS auth.uid() → (select auth.uid()) for per-query evaluation
-- 3. Add polymorphic cleanup trigger for orphaned child rows
-- 4. Add unique constraint on player_choices for upsert support

-- =============================================================================
-- 1. MISSING INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_crawler ON campaigns(crawler_id);
CREATE INDEX IF NOT EXISTS idx_player_choices_parent_choice ON player_choices(parent_choice_id);

-- Verify composite indexes exist (from Phase 5II ARCHITECTURE.md)
CREATE INDEX IF NOT EXISTS idx_cargo_parent ON cargo(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_entity_refs_parent ON entity_refs(parent_id, parent_type);

-- =============================================================================
-- 2. FIX RLS auth.uid() → (select auth.uid())
-- =============================================================================
-- Wrapping auth.uid() in a subquery forces Postgres to evaluate it once per
-- query instead of once per row. This is a significant performance improvement
-- for tables with many rows.
--
-- Strategy: Drop and recreate each policy with the corrected pattern.
-- We handle each table individually.
--
-- IMPORTANT: Before running, verify your actual policy names in Supabase Dashboard
-- (Authentication > Policies). If your policy names differ from these, update the
-- DROP POLICY statements accordingly. The IF EXISTS clause ensures mismatched names
-- are safely skipped, but old policies with different names will remain and should
-- be manually dropped.

-- --- pilots ---
DROP POLICY IF EXISTS "Users can view own pilots" ON pilots;
CREATE POLICY "Users can view own pilots" ON pilots
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own pilots" ON pilots;
CREATE POLICY "Users can insert own pilots" ON pilots
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own pilots" ON pilots;
CREATE POLICY "Users can update own pilots" ON pilots
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own pilots" ON pilots;
CREATE POLICY "Users can delete own pilots" ON pilots
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- mechs ---
DROP POLICY IF EXISTS "Users can view own mechs" ON mechs;
CREATE POLICY "Users can view own mechs" ON mechs
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own mechs" ON mechs;
CREATE POLICY "Users can insert own mechs" ON mechs
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own mechs" ON mechs;
CREATE POLICY "Users can update own mechs" ON mechs
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own mechs" ON mechs;
CREATE POLICY "Users can delete own mechs" ON mechs
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- crawlers ---
DROP POLICY IF EXISTS "Users can view own crawlers" ON crawlers;
CREATE POLICY "Users can view own crawlers" ON crawlers
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own crawlers" ON crawlers;
CREATE POLICY "Users can insert own crawlers" ON crawlers
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own crawlers" ON crawlers;
CREATE POLICY "Users can update own crawlers" ON crawlers
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own crawlers" ON crawlers;
CREATE POLICY "Users can delete own crawlers" ON crawlers
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- entity_refs ---
DROP POLICY IF EXISTS "Users can view own entity refs" ON entity_refs;
CREATE POLICY "Users can view own entity refs" ON entity_refs
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own entity refs" ON entity_refs;
CREATE POLICY "Users can insert own entity refs" ON entity_refs
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own entity refs" ON entity_refs;
CREATE POLICY "Users can update own entity refs" ON entity_refs
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own entity refs" ON entity_refs;
CREATE POLICY "Users can delete own entity refs" ON entity_refs
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- cargo ---
DROP POLICY IF EXISTS "Users can view own cargo" ON cargo;
CREATE POLICY "Users can view own cargo" ON cargo
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own cargo" ON cargo;
CREATE POLICY "Users can insert own cargo" ON cargo
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own cargo" ON cargo;
CREATE POLICY "Users can update own cargo" ON cargo
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own cargo" ON cargo;
CREATE POLICY "Users can delete own cargo" ON cargo
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- player_choices ---
DROP POLICY IF EXISTS "Users can view own player choices" ON player_choices;
CREATE POLICY "Users can view own player choices" ON player_choices
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own player choices" ON player_choices;
CREATE POLICY "Users can insert own player choices" ON player_choices
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own player choices" ON player_choices;
CREATE POLICY "Users can update own player choices" ON player_choices
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own player choices" ON player_choices;
CREATE POLICY "Users can delete own player choices" ON player_choices
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- campaigns ---
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
CREATE POLICY "Users can view own campaigns" ON campaigns
  FOR SELECT USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
CREATE POLICY "Users can insert own campaigns" ON campaigns
  FOR INSERT WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
CREATE POLICY "Users can update own campaigns" ON campaigns
  FOR UPDATE USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;
CREATE POLICY "Users can delete own campaigns" ON campaigns
  FOR DELETE USING (created_by = (select auth.uid()));

-- --- campaign_members ---
DROP POLICY IF EXISTS "Users can view own memberships" ON campaign_members;
CREATE POLICY "Users can view own memberships" ON campaign_members
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own memberships" ON campaign_members;
CREATE POLICY "Users can insert own memberships" ON campaign_members
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own memberships" ON campaign_members;
CREATE POLICY "Users can delete own memberships" ON campaign_members
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- mech_patterns ---
DROP POLICY IF EXISTS "Users can view own mech patterns" ON mech_patterns;
CREATE POLICY "Users can view own mech patterns" ON mech_patterns
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own mech patterns" ON mech_patterns;
CREATE POLICY "Users can insert own mech patterns" ON mech_patterns
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own mech patterns" ON mech_patterns;
CREATE POLICY "Users can update own mech patterns" ON mech_patterns
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own mech patterns" ON mech_patterns;
CREATE POLICY "Users can delete own mech patterns" ON mech_patterns
  FOR DELETE USING (user_id = (select auth.uid()));

-- --- change_log ---
DROP POLICY IF EXISTS "Users can insert own change log" ON change_log;
CREATE POLICY "Users can insert own change log" ON change_log
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own change log" ON change_log;
CREATE POLICY "Users can view own change log" ON change_log
  FOR SELECT USING (user_id = (select auth.uid()));

-- =============================================================================
-- 3. POLYMORPHIC CLEANUP TRIGGER
-- =============================================================================
-- When a pilot, mech, or crawler is deleted, clean up orphaned child rows in
-- entity_refs, cargo, and player_choices (which use polymorphic parent_id).

CREATE OR REPLACE FUNCTION cleanup_polymorphic_children()
RETURNS trigger AS $$
BEGIN
  DELETE FROM entity_refs WHERE parent_id = OLD.id;
  DELETE FROM cargo WHERE parent_id = OLD.id;
  DELETE FROM player_choices WHERE parent_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS trg_cleanup_pilot_children ON pilots;
DROP TRIGGER IF EXISTS trg_cleanup_mech_children ON mechs;
DROP TRIGGER IF EXISTS trg_cleanup_crawler_children ON crawlers;

CREATE TRIGGER trg_cleanup_pilot_children
  AFTER DELETE ON pilots
  FOR EACH ROW EXECUTE FUNCTION cleanup_polymorphic_children();

CREATE TRIGGER trg_cleanup_mech_children
  AFTER DELETE ON mechs
  FOR EACH ROW EXECUTE FUNCTION cleanup_polymorphic_children();

CREATE TRIGGER trg_cleanup_crawler_children
  AFTER DELETE ON crawlers
  FOR EACH ROW EXECUTE FUNCTION cleanup_polymorphic_children();

-- =============================================================================
-- 4. UNIQUE CONSTRAINT FOR PLAYER_CHOICES UPSERT
-- =============================================================================
-- Enables Supabase .upsert() with onConflict instead of manual SELECT+INSERT/UPDATE.

ALTER TABLE player_choices
  ADD CONSTRAINT uq_player_choices_parent_choice
  UNIQUE (parent_id, parent_type, choice_id);
