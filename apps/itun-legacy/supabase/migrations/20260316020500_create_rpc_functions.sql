-- Migration: Create RPC functions for atomic multi-table operations
-- These replace sequential client-side mutations with transactional server-side functions.

-- ---------------------------------------------------------------------------
-- 1. create_game: Insert campaign + campaign_member (mediator) atomically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_game(
  p_user_id uuid,
  p_name text,
  p_invite_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_campaign campaigns%ROWTYPE;
BEGIN
  INSERT INTO campaigns (name, created_by, invite_code)
  VALUES (p_name, p_user_id, p_invite_code)
  RETURNING * INTO v_campaign;

  INSERT INTO campaign_members (campaign_id, user_id, role)
  VALUES (v_campaign.id, p_user_id, 'mediator');

  RETURN to_jsonb(v_campaign);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. join_game: Find campaign by invite code, check membership, insert member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_game(
  p_user_id uuid,
  p_invite_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_campaign campaigns%ROWTYPE;
  v_existing_id uuid;
BEGIN
  SELECT * INTO v_campaign
  FROM campaigns
  WHERE invite_code = p_invite_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found for invite code %', p_invite_code
      USING ERRCODE = 'P0002';
  END IF;

  -- Check if already a member
  SELECT id INTO v_existing_id
  FROM campaign_members
  WHERE campaign_id = v_campaign.id AND user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO campaign_members (campaign_id, user_id, role)
    VALUES (v_campaign.id, p_user_id, 'player');
  END IF;

  RETURN to_jsonb(v_campaign);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. create_pilot: Insert pilot + entity_refs atomically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_pilot(
  p_user_id uuid,
  p_callsign text,
  p_class_ref text,
  p_hp int,
  p_max_hp int,
  p_ap int,
  p_max_ap int,
  p_tp int,
  p_background text DEFAULT NULL,
  p_motto text DEFAULT NULL,
  p_keepsake text DEFAULT NULL,
  p_appearance text DEFAULT NULL,
  p_entity_refs jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_pilot pilots%ROWTYPE;
  v_ref jsonb;
BEGIN
  INSERT INTO pilots (user_id, callsign, class_ref, hp, max_hp, ap, max_ap, tp, background, motto, keepsake, appearance)
  VALUES (p_user_id, p_callsign, p_class_ref, p_hp, p_max_hp, p_ap, p_max_ap, p_tp, p_background, p_motto, p_keepsake, p_appearance)
  RETURNING * INTO v_pilot;

  FOR v_ref IN SELECT * FROM jsonb_array_elements(p_entity_refs)
  LOOP
    INSERT INTO entity_refs (parent_id, parent_type, schema_name, schema_ref_id, sort_order, user_id)
    VALUES (
      v_pilot.id,
      (v_ref->>'parent_type')::parent_type,
      v_ref->>'schema_name',
      v_ref->>'schema_ref_id',
      (v_ref->>'sort_order')::int,
      p_user_id
    );
  END LOOP;

  RETURN to_jsonb(v_pilot);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. create_crawler: Insert crawler + entity_refs + link to campaign
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_crawler(
  p_user_id uuid,
  p_game_id uuid,
  p_crawler_ref text,
  p_name text DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_max_sp int DEFAULT 20,
  p_upkeep int DEFAULT 5,
  p_bay_npcs jsonb DEFAULT '{}'::jsonb,
  p_weapon_refs jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_crawler crawlers%ROWTYPE;
  v_ref jsonb;
  v_index int := 0;
BEGIN
  INSERT INTO crawlers (user_id, crawler_ref, name, tag, max_sp, current_sp, tech_level, upkeep, bay_npcs)
  VALUES (p_user_id, p_crawler_ref, p_name, p_tag, p_max_sp, p_max_sp, 1, p_upkeep, p_bay_npcs)
  RETURNING * INTO v_crawler;

  FOR v_ref IN SELECT * FROM jsonb_array_elements(p_weapon_refs)
  LOOP
    INSERT INTO entity_refs (parent_id, parent_type, schema_name, schema_ref_id, sort_order, user_id)
    VALUES (
      v_crawler.id,
      'crawler'::parent_type,
      v_ref->>'schema_name',
      v_ref->>'schema_ref_id',
      v_index,
      p_user_id
    );
    v_index := v_index + 1;
  END LOOP;

  UPDATE campaigns SET crawler_id = v_crawler.id WHERE id = p_game_id;

  RETURN to_jsonb(v_crawler);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. instantiate_mech: Insert mech + entity_refs + link to pilot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION instantiate_mech(
  p_user_id uuid,
  p_pilot_id uuid,
  p_chassis_ref text,
  p_pattern_name text DEFAULT NULL,
  p_max_sp int DEFAULT 0,
  p_max_ep int DEFAULT 0,
  p_heat_capacity int DEFAULT 0,
  p_cargo_capacity int DEFAULT 0,
  p_source_pattern_id uuid DEFAULT NULL,
  p_source_ref_pattern_id text DEFAULT NULL,
  p_entity_refs jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_mech mechs%ROWTYPE;
  v_ref jsonb;
BEGIN
  INSERT INTO mechs (user_id, chassis_ref, pattern_name, max_sp, current_sp, max_ep, current_ep, heat_capacity, current_heat, cargo_capacity, source_pattern_id, source_ref_pattern_id)
  VALUES (p_user_id, p_chassis_ref, p_pattern_name, p_max_sp, p_max_sp, p_max_ep, p_max_ep, p_heat_capacity, 0, p_cargo_capacity, p_source_pattern_id, p_source_ref_pattern_id)
  RETURNING * INTO v_mech;

  FOR v_ref IN SELECT * FROM jsonb_array_elements(p_entity_refs)
  LOOP
    INSERT INTO entity_refs (parent_id, parent_type, schema_name, schema_ref_id, sort_order, user_id)
    VALUES (
      v_mech.id,
      'mech'::parent_type,
      v_ref->>'schema_name',
      v_ref->>'schema_ref_id',
      (v_ref->>'sort_order')::int,
      p_user_id
    );
  END LOOP;

  UPDATE pilots SET mech_id = v_mech.id WHERE id = p_pilot_id;

  RETURN to_jsonb(v_mech);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. update_mech_entity_refs: Delete + insert entity_refs atomically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_mech_entity_refs(
  p_mech_id uuid,
  p_delete_ids uuid[] DEFAULT '{}'::uuid[],
  p_inserts jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_ref jsonb;
BEGIN
  IF array_length(p_delete_ids, 1) > 0 THEN
    DELETE FROM entity_refs
    WHERE id = ANY(p_delete_ids)
      AND parent_id = p_mech_id;
  END IF;

  FOR v_ref IN SELECT * FROM jsonb_array_elements(p_inserts)
  LOOP
    INSERT INTO entity_refs (parent_id, parent_type, schema_name, schema_ref_id, sort_order, user_id)
    VALUES (
      (v_ref->>'parent_id')::uuid,
      (v_ref->>'parent_type')::parent_type,
      v_ref->>'schema_name',
      v_ref->>'schema_ref_id',
      (v_ref->>'sort_order')::int,
      (v_ref->>'user_id')::uuid
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. update_crawler_weapon: Delete old + insert new entity_ref atomically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_crawler_weapon(
  p_crawler_id uuid,
  p_user_id uuid,
  p_old_ref_id uuid DEFAULT NULL,
  p_new_schema_name text DEFAULT 'systems',
  p_new_schema_ref_id text DEFAULT '',
  p_sort_order int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF p_old_ref_id IS NOT NULL THEN
    DELETE FROM entity_refs
    WHERE id = p_old_ref_id
      AND parent_id = p_crawler_id;
  END IF;

  INSERT INTO entity_refs (parent_id, parent_type, schema_name, schema_ref_id, sort_order, user_id)
  VALUES (p_crawler_id, 'crawler'::parent_type, p_new_schema_name, p_new_schema_ref_id, p_sort_order, p_user_id);
END;
$$;
