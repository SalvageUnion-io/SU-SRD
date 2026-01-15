-- Remove Legacy JSON Fields Migration
-- Drop choices and cargo JSON columns from pilots, mechs, and crawlers
-- These have been replaced by normalized tables (player_choices and cargo)

-- ============================================================================
-- PART 1: DROP CHOICES COLUMNS
-- ============================================================================

-- Drop choices from pilots
ALTER TABLE pilots DROP COLUMN IF EXISTS choices;

-- Drop choices from mechs
ALTER TABLE mechs DROP COLUMN IF EXISTS choices;

-- Drop choices from crawlers
ALTER TABLE crawlers DROP COLUMN IF EXISTS choices;

-- ============================================================================
-- PART 2: DROP CARGO COLUMNS
-- ============================================================================

-- Drop cargo from mechs
ALTER TABLE mechs DROP COLUMN IF EXISTS cargo;

-- Drop cargo from crawlers
ALTER TABLE crawlers DROP COLUMN IF EXISTS cargo;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Verify columns are dropped from pilots
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'pilots' AND table_schema = 'public';

-- Verify columns are dropped from mechs
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'mechs' AND table_schema = 'public';

-- Verify columns are dropped from crawlers
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'crawlers' AND table_schema = 'public';

