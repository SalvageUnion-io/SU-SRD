-- Entity Normalization Migration
-- Phase 1: Create normalized tables for entities, cargo, and player choices
-- This migration creates the foundation for the new entity storage system

-- ============================================================================
-- SUENTITIES TABLE
-- ============================================================================
-- Represents a game entity (ability, equipment, system, module, bay)
-- associated with a parent (pilot, mech, crawler)

CREATE TABLE suentities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Parent relationship (exactly one must be set)
  pilot_id UUID REFERENCES pilots(id) ON DELETE CASCADE,
  mech_id UUID REFERENCES mechs(id) ON DELETE CASCADE,
  crawler_id UUID REFERENCES crawlers(id) ON DELETE CASCADE,

  -- Reference to salvageunion-reference data
  schema_name TEXT NOT NULL, -- e.g., 'abilities', 'systems', 'equipment'
  schema_ref_id TEXT NOT NULL, -- e.g., 'bionic-senses', 'railgun'

  -- Entity-specific metadata (optional, for positioning/slot info)
  metadata JSONB, -- e.g., { "slot": 1, "row": 2, "col": 3 }

  -- Constraints
  CONSTRAINT entity_has_one_parent CHECK (
    (pilot_id IS NOT NULL)::int +
    (mech_id IS NOT NULL)::int +
    (crawler_id IS NOT NULL)::int = 1
  )
);

-- Indexes for performance
CREATE INDEX idx_suentities_pilot_id ON suentities(pilot_id);
CREATE INDEX idx_suentities_mech_id ON suentities(mech_id);
CREATE INDEX idx_suentities_crawler_id ON suentities(crawler_id);
CREATE INDEX idx_suentities_schema ON suentities(schema_name, schema_ref_id);

-- ============================================================================
-- CARGO TABLE
-- ============================================================================
-- Represents cargo items stored on mechs or crawlers
-- Can be either a reference to a schema entity OR a custom named item

CREATE TABLE cargo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Parent relationship (exactly one must be set)
  mech_id UUID REFERENCES mechs(id) ON DELETE CASCADE,
  crawler_id UUID REFERENCES crawlers(id) ON DELETE CASCADE,

  -- Required: name of the cargo item
  name TEXT NOT NULL,

  -- Optional: reference to salvageunion-reference data
  schema_name TEXT, -- e.g., 'equipment', 'systems'
  schema_ref_id TEXT, -- e.g., 'medkit', 'spare-parts'

  -- Optional: amount (for stackable items)
  amount INTEGER,

  -- Position metadata (for grid-based cargo holds)
  metadata JSONB, -- e.g., { "row": 2, "col": 3 }

  -- Constraints
  CONSTRAINT cargo_has_one_parent CHECK (
    (mech_id IS NOT NULL)::int +
    (crawler_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT cargo_has_ref_or_amount CHECK (
    amount IS NOT NULL OR (schema_name IS NOT NULL AND schema_ref_id IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_cargo_mech_id ON cargo(mech_id);
CREATE INDEX idx_cargo_crawler_id ON cargo(crawler_id);
CREATE INDEX idx_cargo_schema ON cargo(schema_name, schema_ref_id);

-- ============================================================================
-- PLAYER_CHOICES TABLE
-- ============================================================================
-- Represents a player's choice for a specific entity
-- e.g., selecting "Hearing" for Bionic Senses ability

CREATE TABLE player_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Parent entity
  entity_id UUID NOT NULL REFERENCES suentities(id) ON DELETE CASCADE,

  -- Reference to choice in salvageunion-reference
  choice_ref_id TEXT NOT NULL, -- ID of the choice in the entity's choices array

  -- Player's selected value
  value TEXT NOT NULL, -- e.g., "Hearing", "Vision", or custom text

  -- Ensure one choice per choice_ref_id per entity
  CONSTRAINT unique_entity_choice UNIQUE(entity_id, choice_ref_id)
);

-- Index for performance
CREATE INDEX idx_player_choices_entity_id ON player_choices(entity_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all new tables

ALTER TABLE suentities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_choices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - SUENTITIES
-- ============================================================================

-- Users can view suentities for their own pilots/mechs/crawlers
CREATE POLICY "Users can view their own suentities"
  ON suentities FOR SELECT
  USING (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- Users can insert suentities for their own pilots/mechs/crawlers
CREATE POLICY "Users can insert their own suentities"
  ON suentities FOR INSERT
  WITH CHECK (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- Users can update suentities for their own pilots/mechs/crawlers
CREATE POLICY "Users can update their own suentities"
  ON suentities FOR UPDATE
  USING (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- Users can delete suentities for their own pilots/mechs/crawlers
CREATE POLICY "Users can delete their own suentities"
  ON suentities FOR DELETE
  USING (
    pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
    OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- ============================================================================
-- RLS POLICIES - CARGO
-- ============================================================================

-- Users can view cargo for their own mechs/crawlers
CREATE POLICY "Users can view their own cargo"
  ON cargo FOR SELECT
  USING (
    mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- Users can insert cargo for their own mechs/crawlers
CREATE POLICY "Users can insert their own cargo"
  ON cargo FOR INSERT
  WITH CHECK (
    mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- Users can update cargo for their own mechs/crawlers
CREATE POLICY "Users can update their own cargo"
  ON cargo FOR UPDATE
  USING (
    mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- Users can delete cargo for their own mechs/crawlers
CREATE POLICY "Users can delete their own cargo"
  ON cargo FOR DELETE
  USING (
    mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
    OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
  );

-- ============================================================================
-- RLS POLICIES - PLAYER_CHOICES
-- ============================================================================

-- Users can view choices for suentities they own
CREATE POLICY "Users can view their own player choices"
  ON player_choices FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM suentities WHERE
        pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
        OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
        OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
    )
  );

-- Users can insert choices for suentities they own
CREATE POLICY "Users can insert their own player choices"
  ON player_choices FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM suentities WHERE
        pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
        OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
        OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
    )
  );

-- Users can update choices for suentities they own
CREATE POLICY "Users can update their own player choices"
  ON player_choices FOR UPDATE
  USING (
    entity_id IN (
      SELECT id FROM suentities WHERE
        pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
        OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
        OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
    )
  );

-- Users can delete choices for suentities they own
CREATE POLICY "Users can delete their own player choices"
  ON player_choices FOR DELETE
  USING (
    entity_id IN (
      SELECT id FROM suentities WHERE
        pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
        OR mech_id IN (SELECT id FROM mechs WHERE user_id = auth.uid())
        OR crawler_id IN (SELECT id FROM crawlers WHERE user_id = auth.uid())
    )
  );

