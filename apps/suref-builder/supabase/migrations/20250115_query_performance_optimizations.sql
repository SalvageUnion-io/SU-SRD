-- Query Performance Optimizations
-- Addresses performance issues identified in Supabase query performance report
--
-- Optimizations:
-- 1. Composite indexes for suentities queries that filter and order by created_at
-- 2. Index on game_members.game_id for get_game_members function
-- 3. Indexes on user_id columns for RLS policy performance
-- 4. Index on crawlers.game_id for game membership checks
--
-- Migration Date: 2025-01-15

-- ============================================================================
-- SUENTITIES TABLE - Composite Indexes for ORDER BY created_at
-- ============================================================================
-- Queries filter by pilot_id/mech_id and order by created_at ASC
-- These composite indexes allow efficient index-only scans

CREATE INDEX IF NOT EXISTS idx_suentities_pilot_id_created_at 
  ON suentities(pilot_id, created_at)
  WHERE pilot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suentities_mech_id_created_at 
  ON suentities(mech_id, created_at)
  WHERE mech_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suentities_crawler_id_created_at 
  ON suentities(crawler_id, created_at)
  WHERE crawler_id IS NOT NULL;

-- ============================================================================
-- GAME_MEMBERS TABLE - Index for get_game_members function
-- ============================================================================
-- The get_game_members function filters by game_id, so an index here
-- will significantly improve performance

CREATE INDEX IF NOT EXISTS idx_game_members_game_id 
  ON game_members(game_id);

-- ============================================================================
-- MECHS TABLE - Index on user_id for RLS policy performance
-- ============================================================================
-- RLS policies frequently check mechs.user_id = auth.uid()
-- This index speeds up those checks

CREATE INDEX IF NOT EXISTS idx_mechs_user_id 
  ON mechs(user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- CRAWLERS TABLE - Indexes for RLS policy performance
-- ============================================================================
-- RLS policies frequently check crawlers.user_id and crawlers.game_id
-- These indexes speed up those checks

CREATE INDEX IF NOT EXISTS idx_crawlers_user_id 
  ON crawlers(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crawlers_game_id 
  ON crawlers(game_id)
  WHERE game_id IS NOT NULL;

-- ============================================================================
-- PILOTS TABLE - Index on user_id for RLS policy performance
-- ============================================================================
-- RLS policies frequently check pilots.user_id = auth.uid()
-- This index speeds up those checks

CREATE INDEX IF NOT EXISTS idx_pilots_user_id 
  ON pilots(user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- PILOTS TABLE - Index on crawler_id for join performance
-- ============================================================================
-- Many queries join pilots with crawlers via crawler_id
-- This index improves join performance

CREATE INDEX IF NOT EXISTS idx_pilots_crawler_id 
  ON pilots(crawler_id)
  WHERE crawler_id IS NOT NULL;

-- ============================================================================
-- MECHS TABLE - Index on pilot_id for join performance
-- ============================================================================
-- Many queries join mechs with pilots via pilot_id
-- This index improves join performance

CREATE INDEX IF NOT EXISTS idx_mechs_pilot_id 
  ON mechs(pilot_id)
  WHERE pilot_id IS NOT NULL;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update statistics so the query planner can make better decisions

ANALYZE suentities;
ANALYZE game_members;
ANALYZE mechs;
ANALYZE crawlers;
ANALYZE pilots;
ANALYZE cargo;


