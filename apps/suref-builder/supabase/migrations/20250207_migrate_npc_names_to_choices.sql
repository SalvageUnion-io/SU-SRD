-- Migrate NPC Names to Choices Migration
-- Move NPC names from crawlers.npc.name and suentities.metadata.npc.name
-- to player_choices table using the Name choice IDs from reference data
-- This normalizes NPC names to use the choices system

-- ============================================================================
-- PART 1: MIGRATE CRAWLER NPC NAMES TO PLAYER_CHOICES
-- ============================================================================
-- For each crawler with an NPC name, find the crawler type entity and
-- create a player_choice entry with the Name choice ID

-- Map crawler type IDs to their Name choice IDs
-- These IDs come from packages/salvageunion-reference/data/crawlers.json
INSERT INTO player_choices (entity_id, choice_ref_id, value, created_at, updated_at)
SELECT 
  se.id as entity_id,
  CASE se.schema_ref_id
    -- Augmented crawler type
    WHEN '8bffb508-8c8f-418d-b6ce-f24f7266e41b' THEN 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b'
    -- Battle crawler type
    WHEN '3d1d9f79-9c56-43fa-a4c9-6dfe10b9aac9' THEN 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c'
    -- Engineering crawler type
    WHEN '4e317382-046b-4a35-bce8-065c6d659a7b' THEN 'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d'
    -- Exploratory crawler type
    WHEN 'd850cd93-f1cc-462b-bfa4-babfb0b2812e' THEN 'b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e'
    -- Trade Caravan crawler type
    WHEN '46e44f56-be78-49d8-bfe4-32628ad4b8ef' THEN 'c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f'
    ELSE NULL
  END as choice_ref_id,
  (c.npc->>'name')::text as value,
  COALESCE(se.created_at, NOW()) as created_at,
  NOW() as updated_at
FROM crawlers c
INNER JOIN suentities se ON se.crawler_id = c.id AND se.schema_name = 'crawlers'
WHERE c.npc IS NOT NULL 
  AND c.npc->>'name' IS NOT NULL 
  AND c.npc->>'name' != ''
  AND CASE se.schema_ref_id
    WHEN '8bffb508-8c8f-418d-b6ce-f24f7266e41b' THEN 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b'
    WHEN '3d1d9f79-9c56-43fa-a4c9-6dfe10b9aac9' THEN 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c'
    WHEN '4e317382-046b-4a35-bce8-065c6d659a7b' THEN 'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d'
    WHEN 'd850cd93-f1cc-462b-bfa4-babfb0b2812e' THEN 'b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e'
    WHEN '46e44f56-be78-49d8-bfe4-32628ad4b8ef' THEN 'c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f'
    ELSE NULL
  END IS NOT NULL
  -- Only insert if a choice doesn't already exist for this entity and choice_ref_id
  AND NOT EXISTS (
    SELECT 1 FROM player_choices pc 
    WHERE pc.entity_id = se.id 
    AND pc.choice_ref_id = CASE se.schema_ref_id
      WHEN '8bffb508-8c8f-418d-b6ce-f24f7266e41b' THEN 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b'
      WHEN '3d1d9f79-9c56-43fa-a4c9-6dfe10b9aac9' THEN 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c'
      WHEN '4e317382-046b-4a35-bce8-065c6d659a7b' THEN 'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d'
      WHEN 'd850cd93-f1cc-462b-bfa4-babfb0b2812e' THEN 'b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e'
      WHEN '46e44f56-be78-49d8-bfe4-32628ad4b8ef' THEN 'c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f'
      ELSE NULL
    END
  );

-- ============================================================================
-- PART 2: MIGRATE BAY NPC NAMES TO PLAYER_CHOICES
-- ============================================================================
-- For each bay entity with an NPC name in metadata, create a player_choice
-- entry with the Name choice ID for that bay type

-- Map bay type IDs to their Name choice IDs
-- These IDs come from packages/salvageunion-reference/data/crawler-bays.json
INSERT INTO player_choices (entity_id, choice_ref_id, value, created_at, updated_at)
SELECT 
  se.id as entity_id,
  CASE se.schema_ref_id
    -- Command Bay
    WHEN '233d7930-1c4d-475d-9ea8-c88a1c70350c' THEN 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    -- Mech Bay
    WHEN '3234f326-0fae-4ec1-a31e-900be859c156' THEN 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
    -- Storage Bay
    WHEN '4522e605-a384-4c3d-b556-c377e4cc2a97' THEN 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'
    -- Armament Bay
    WHEN '6b0e9620-06ed-40ee-9feb-5f635518e48e' THEN 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a'
    -- Crafting Bay
    WHEN 'e4612293-d3a1-4533-889a-977c92ea1313' THEN 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b'
    -- Trading Bay
    WHEN '2a4ac355-95fc-451b-8b46-cf8ba5eec31b' THEN 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c'
    -- Med Bay
    WHEN '0850a891-19e3-4372-af35-0a1679130c8f' THEN 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d'
    -- Pilot Bay
    WHEN '74904a14-92be-41e0-80d9-63fce02b8851' THEN 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e'
    -- Armoury
    WHEN '3075663e-0ee6-4e82-8697-4778f303adc7' THEN 'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f'
    -- Cantina
    WHEN '674a412f-486b-4693-b912-1838cc39b77d' THEN 'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a'
    ELSE NULL
  END as choice_ref_id,
  (se.metadata->'npc'->>'name')::text as value,
  COALESCE(se.created_at, NOW()) as created_at,
  NOW() as updated_at
FROM suentities se
WHERE se.schema_name = 'crawler-bays'
  AND se.metadata IS NOT NULL
  AND se.metadata->'npc' IS NOT NULL
  AND se.metadata->'npc'->>'name' IS NOT NULL
  AND se.metadata->'npc'->>'name' != ''
  AND CASE se.schema_ref_id
    WHEN '233d7930-1c4d-475d-9ea8-c88a1c70350c' THEN 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    WHEN '3234f326-0fae-4ec1-a31e-900be859c156' THEN 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
    WHEN '4522e605-a384-4c3d-b556-c377e4cc2a97' THEN 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'
    WHEN '6b0e9620-06ed-40ee-9feb-5f635518e48e' THEN 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a'
    WHEN 'e4612293-d3a1-4533-889a-977c92ea1313' THEN 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b'
    WHEN '2a4ac355-95fc-451b-8b46-cf8ba5eec31b' THEN 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c'
    WHEN '0850a891-19e3-4372-af35-0a1679130c8f' THEN 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d'
    WHEN '74904a14-92be-41e0-80d9-63fce02b8851' THEN 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e'
    WHEN '3075663e-0ee6-4e82-8697-4778f303adc7' THEN 'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f'
    WHEN '674a412f-486b-4693-b912-1838cc39b77d' THEN 'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a'
    ELSE NULL
  END IS NOT NULL
  -- Only insert if a choice doesn't already exist for this entity and choice_ref_id
  AND NOT EXISTS (
    SELECT 1 FROM player_choices pc 
    WHERE pc.entity_id = se.id 
    AND pc.choice_ref_id = CASE se.schema_ref_id
      WHEN '233d7930-1c4d-475d-9ea8-c88a1c70350c' THEN 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
      WHEN '3234f326-0fae-4ec1-a31e-900be859c156' THEN 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
      WHEN '4522e605-a384-4c3d-b556-c377e4cc2a97' THEN 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'
      WHEN '6b0e9620-06ed-40ee-9feb-5f635518e48e' THEN 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a'
      WHEN 'e4612293-d3a1-4533-889a-977c92ea1313' THEN 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b'
      WHEN '2a4ac355-95fc-451b-8b46-cf8ba5eec31b' THEN 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c'
      WHEN '0850a891-19e3-4372-af35-0a1679130c8f' THEN 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d'
      WHEN '74904a14-92be-41e0-80d9-63fce02b8851' THEN 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e'
      WHEN '3075663e-0ee6-4e82-8697-4778f303adc7' THEN 'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f'
      WHEN '674a412f-486b-4693-b912-1838cc39b77d' THEN 'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a'
      ELSE NULL
    END
  );

-- ============================================================================
-- NOTES
-- ============================================================================
-- After running this migration:
-- 1. NPC names are now stored in player_choices table
-- 2. The name field in crawlers.npc and suentities.metadata.npc can be
--    left as-is for backward compatibility, but will be ignored by the UI
-- 3. Notes and damage remain in metadata as they are game state, not choices
-- 4. Future NPC name updates should use the choices system via onUpdateChoice


