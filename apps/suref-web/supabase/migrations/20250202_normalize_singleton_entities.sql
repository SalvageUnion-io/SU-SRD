-- Normalize Singleton Entities Migration
-- Convert class_id, advanced_class_id, chassis_id, crawler_type_id, and bays
-- from simple ID fields and JSON to normalized suentities
-- This enables these entities to have player choices

-- ============================================================================
-- PART 1: MIGRATE PILOT CLASS_ID TO SUENTITIES
-- ============================================================================

-- Create Entity for each pilot with a class_id
INSERT INTO suentities (pilot_id, schema_name, schema_ref_id, created_at, updated_at)
SELECT 
  id as pilot_id,
  'classes.core' as schema_name,
  class_id as schema_ref_id,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at
FROM pilots
WHERE class_id IS NOT NULL;

-- ============================================================================
-- PART 2: MIGRATE PILOT ADVANCED_CLASS_ID TO SUENTITIES
-- ============================================================================

-- We need to determine if each advanced_class_id is an advanced or hybrid class
-- This requires checking against the salvageunion-reference data
-- For now, we'll try advanced first, then hybrid

-- Create a temporary function to determine class type
CREATE OR REPLACE FUNCTION get_class_schema_name(class_ref_id TEXT) 
RETURNS TEXT AS $$
DECLARE
  schema_name TEXT;
BEGIN
  -- List of known advanced class IDs from salvageunion-reference
  -- Advanced classes: ace, commander, engineer, hacker, heavy, medic, recon, scavenger, sniper
  IF class_ref_id IN ('ace', 'commander', 'engineer', 'hacker', 'heavy', 'medic', 'recon', 'scavenger', 'sniper') THEN
    RETURN 'classes.advanced';
  -- Hybrid classes: all others (typically combinations like 'ace-commander')
  ELSE
    RETURN 'classes.hybrid';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create Entity for each pilot with an advanced_class_id
INSERT INTO suentities (pilot_id, schema_name, schema_ref_id, created_at, updated_at)
SELECT 
  id as pilot_id,
  get_class_schema_name(advanced_class_id) as schema_name,
  advanced_class_id as schema_ref_id,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at
FROM pilots
WHERE advanced_class_id IS NOT NULL;

-- Drop the temporary function
DROP FUNCTION get_class_schema_name(TEXT);

-- ============================================================================
-- PART 3: MIGRATE MECH CHASSIS_ID TO SUENTITIES
-- ============================================================================

-- Create Entity for each mech with a chassis_id
INSERT INTO suentities (mech_id, schema_name, schema_ref_id, created_at, updated_at)
SELECT 
  id as mech_id,
  'chassis' as schema_name,
  chassis_id as schema_ref_id,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at
FROM mechs
WHERE chassis_id IS NOT NULL;

-- ============================================================================
-- PART 4: MIGRATE CRAWLER CRAWLER_TYPE_ID TO SUENTITIES
-- ============================================================================

-- Create Entity for each crawler with a crawler_type_id
INSERT INTO suentities (crawler_id, schema_name, schema_ref_id, created_at, updated_at)
SELECT 
  id as crawler_id,
  'crawlers' as schema_name,
  crawler_type_id as schema_ref_id,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at
FROM crawlers
WHERE crawler_type_id IS NOT NULL;

-- ============================================================================
-- PART 5: MIGRATE CRAWLER BAYS TO SUENTITIES
-- ============================================================================

-- Bays are stored as JSON array on crawlers
-- Each bay has: { id, bayId, damaged, npc: { name, notes, hitPoints, damage } }
-- We need to convert each bay to a Entity with metadata

-- Create suentities for each bay in each crawler
INSERT INTO suentities (crawler_id, schema_name, schema_ref_id, metadata, created_at, updated_at)
SELECT 
  c.id as crawler_id,
  'crawler-bays' as schema_name,
  bay->>'bayId' as schema_ref_id,
  jsonb_build_object(
    'damaged', (bay->>'damaged')::boolean,
    'npc', jsonb_build_object(
      'name', bay->'npc'->>'name',
      'notes', bay->'npc'->>'notes',
      'hitPoints', (bay->'npc'->>'hitPoints')::integer,
      'damage', (bay->'npc'->>'damage')::integer
    )
  ) as metadata,
  COALESCE(c.created_at, NOW()) as created_at,
  COALESCE(c.updated_at, NOW()) as updated_at
FROM crawlers c,
     jsonb_array_elements(c.bays::jsonb) as bay
WHERE c.bays IS NOT NULL;

-- ============================================================================
-- PART 6: MIGRATE BAY CHOICES TO PLAYER_CHOICES
-- ============================================================================

-- Bay choices are currently stored in crawler.choices with keys that reference bay NPCs
-- We need to identify which choices belong to which bay and migrate them to player_choices
-- This is complex because we need to match choice keys to bay entities

-- For now, we'll skip this step as it requires knowledge of the choice key structure
-- Bay choices will need to be manually recreated or handled in application code
-- TODO: Implement bay choice migration if choice key structure is known

-- ============================================================================
-- PART 7: DROP OLD COLUMNS
-- ============================================================================

-- Drop class_id and advanced_class_id from pilots
ALTER TABLE pilots DROP COLUMN IF EXISTS class_id;
ALTER TABLE pilots DROP COLUMN IF EXISTS advanced_class_id;

-- Drop chassis_id from mechs
ALTER TABLE mechs DROP COLUMN IF EXISTS chassis_id;

-- Drop crawler_type_id from crawlers
ALTER TABLE crawlers DROP COLUMN IF EXISTS crawler_type_id;

-- Drop bays from crawlers
ALTER TABLE crawlers DROP COLUMN IF EXISTS bays;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Verify pilot class entities
-- SELECT COUNT(*) FROM suentities WHERE schema_name IN ('classes.core', 'classes.advanced', 'classes.hybrid');

-- Verify mech chassis entities
-- SELECT COUNT(*) FROM suentities WHERE schema_name = 'chassis';

-- Verify crawler type entities
-- SELECT COUNT(*) FROM suentities WHERE schema_name = 'crawlers';

-- Verify bay entities
-- SELECT COUNT(*) FROM suentities WHERE schema_name = 'crawler-bays';

-- Check for any orphaned data
-- SELECT * FROM suentities WHERE pilot_id IS NULL AND mech_id IS NULL AND crawler_id IS NULL;

