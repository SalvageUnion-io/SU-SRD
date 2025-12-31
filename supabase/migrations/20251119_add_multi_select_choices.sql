-- ============================================================================
-- MULTI-SELECT CHOICES MIGRATION
-- ============================================================================
-- Adds support for choices that can be selected multiple times
-- (e.g., Custom Sniper Rifle modifications - one per tech level)
--
-- Migration Date: 2025-11-19
-- ============================================================================

-- Remove unique constraint on (entity_id, choice_ref_id) to allow multiple selections
-- Single-select enforcement will be handled in application logic
ALTER TABLE player_choices
  DROP CONSTRAINT IF EXISTS unique_entity_choice;

-- Add index for performance when querying choices by entity and choice_ref_id
-- This helps with queries that need to fetch all selections for a specific choice
CREATE INDEX IF NOT EXISTS idx_player_choices_entity_choice_ref 
  ON player_choices(entity_id, choice_ref_id) 
  WHERE entity_id IS NOT NULL;

-- Add index for nested choices as well
CREATE INDEX IF NOT EXISTS idx_player_choices_choice_choice_ref 
  ON player_choices(player_choice_id, choice_ref_id) 
  WHERE player_choice_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_player_choices_entity_choice_ref IS 
  'Index for efficiently querying all selections for a choice_ref_id on an entity (supports multi-select)';
COMMENT ON INDEX idx_player_choices_choice_choice_ref IS 
  'Index for efficiently querying all selections for a choice_ref_id on a nested choice (supports multi-select)';





