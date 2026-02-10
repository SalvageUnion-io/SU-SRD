-- ============================================================================
-- NESTED PLAYER CHOICES MIGRATION
-- ============================================================================
-- Adds support for nested choices: a player_choice can belong to either
-- an entity OR another player_choice (but not both)
--
-- Example: Ability grants choice of System → System grants choice of Module
--
-- Migration Date: 2025-01-31
-- ============================================================================

-- Add new column for nested choices
ALTER TABLE player_choices
  ADD COLUMN player_choice_id UUID REFERENCES player_choices(id) ON DELETE CASCADE;

-- Make entity_id nullable (since nested choices don't have entity_id)
ALTER TABLE player_choices
  ALTER COLUMN entity_id DROP NOT NULL;

-- Add constraint: exactly one parent (entity OR choice)
ALTER TABLE player_choices
  ADD CONSTRAINT choice_has_one_parent CHECK (
    (entity_id IS NOT NULL)::int +
    (player_choice_id IS NOT NULL)::int = 1
  );

-- Add unique constraint for choice-based choices
-- Ensures one choice per choice_ref_id per parent choice
ALTER TABLE player_choices
  ADD CONSTRAINT unique_choice_choice UNIQUE(player_choice_id, choice_ref_id);

-- Add index for performance when querying nested choices
CREATE INDEX idx_player_choices_player_choice_id ON player_choices(player_choice_id);

-- ============================================================================
-- UPDATE RLS POLICIES
-- ============================================================================
-- Need to update RLS policies to handle nested choices

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own player choices" ON player_choices;
DROP POLICY IF EXISTS "Users can insert their own player choices" ON player_choices;
DROP POLICY IF EXISTS "Users can update their own player choices" ON player_choices;
DROP POLICY IF EXISTS "Users can delete their own player choices" ON player_choices;

-- Helper function to check if user owns a choice (recursively)
CREATE OR REPLACE FUNCTION user_owns_choice(choice_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  choice_record RECORD;
BEGIN
  -- Get the choice
  SELECT entity_id, player_choice_id INTO choice_record
  FROM player_choices
  WHERE id = choice_id;
  
  -- If not found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If choice has entity_id, check if user owns the entity
  IF choice_record.entity_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM entities WHERE id = choice_record.entity_id AND (
        pilot_id IN (SELECT id FROM pilots WHERE pilots.user_id = user_owns_choice.user_id)
        OR mech_id IN (SELECT id FROM mechs WHERE mechs.user_id = user_owns_choice.user_id)
        OR crawler_id IN (SELECT id FROM crawlers WHERE crawlers.user_id = user_owns_choice.user_id)
      )
    );
  END IF;
  
  -- If choice has player_choice_id, recursively check parent
  IF choice_record.player_choice_id IS NOT NULL THEN
    RETURN user_owns_choice(choice_record.player_choice_id, user_owns_choice.user_id);
  END IF;
  
  -- Should never reach here due to constraint, but return false to be safe
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New RLS policies using recursive ownership check

-- Users can view choices they own (including nested)
CREATE POLICY "Users can view their own player choices"
  ON player_choices FOR SELECT
  USING (user_owns_choice(id, auth.uid()));

-- Users can insert choices for entities/choices they own
CREATE POLICY "Users can insert their own player choices"
  ON player_choices FOR INSERT
  WITH CHECK (
    -- If entity_id is set, check entity ownership
    (entity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM entities WHERE id = entity_id AND (
        pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
        OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
        OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
      )
    ))
    OR
    -- If player_choice_id is set, check choice ownership
    (player_choice_id IS NOT NULL AND user_owns_choice(player_choice_id, auth.uid()))
  );

-- Users can update choices they own
CREATE POLICY "Users can update their own player choices"
  ON player_choices FOR UPDATE
  USING (user_owns_choice(id, auth.uid()));

-- Users can delete choices they own
CREATE POLICY "Users can delete their own player choices"
  ON player_choices FOR DELETE
  USING (user_owns_choice(id, auth.uid()));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN player_choices.entity_id IS 'Parent entity (mutually exclusive with player_choice_id)';
COMMENT ON COLUMN player_choices.player_choice_id IS 'Parent choice for nested choices (mutually exclusive with entity_id)';
COMMENT ON CONSTRAINT choice_has_one_parent ON player_choices IS 'Ensures exactly one parent: entity_id OR player_choice_id';
COMMENT ON CONSTRAINT unique_choice_choice ON player_choices IS 'Ensures one choice per choice_ref_id per parent choice';

