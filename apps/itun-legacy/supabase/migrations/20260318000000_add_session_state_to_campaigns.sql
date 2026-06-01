-- Adds nullable JSONB column session_state to campaigns for live-session tracking
-- of round number, initiative winner, and active encounter reference.
-- Policy: only three keys ever go in this column:
--   round_number: integer (default 0)
--   initiative_winner: 'players' | 'npcs' | null
--   active_encounter_id: string | null
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT NULL;
