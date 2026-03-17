-- Migration: Atomic downtime receipt merge RPC
-- Adds merge_downtime_receipt to atomically write a per-pilot receipt key into
-- a JSONB column on downtime_records using jsonb_set, eliminating the
-- read-modify-write race condition present in client-side receipt saves.

-- ---------------------------------------------------------------------------
-- 1. merge_downtime_receipt: Atomically set one pilot's receipt in a JSONB column
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION merge_downtime_receipt(
  p_record_id uuid,
  p_field text,
  p_pilot_id text,
  p_receipt jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_row downtime_records%ROWTYPE;
BEGIN
  -- Allowlist guard: prevent arbitrary column injection
  IF p_field NOT IN (
    'offload_receipts',
    'restore_receipts',
    'craft_receipts',
    'training_receipts',
    'equipment_receipts',
    'customise_acknowledged',
    'rumour_receipts'
  ) THEN
    RAISE EXCEPTION 'Invalid field name: %', p_field
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE downtime_records
  SET (offload_receipts,
       restore_receipts,
       craft_receipts,
       training_receipts,
       equipment_receipts,
       customise_acknowledged,
       rumour_receipts) = (
    CASE WHEN p_field = 'offload_receipts'
      THEN jsonb_set(COALESCE(offload_receipts, '{}'::jsonb), ARRAY[p_pilot_id], p_receipt, true)
      ELSE offload_receipts END,
    CASE WHEN p_field = 'restore_receipts'
      THEN jsonb_set(COALESCE(restore_receipts, '{}'::jsonb), ARRAY[p_pilot_id], p_receipt, true)
      ELSE restore_receipts END,
    CASE WHEN p_field = 'craft_receipts'
      THEN jsonb_set(COALESCE(craft_receipts, '{}'::jsonb), ARRAY[p_pilot_id], p_receipt, true)
      ELSE craft_receipts END,
    CASE WHEN p_field = 'training_receipts'
      THEN jsonb_set(COALESCE(training_receipts, '{}'::jsonb), ARRAY[p_pilot_id], p_receipt, true)
      ELSE training_receipts END,
    CASE WHEN p_field = 'equipment_receipts'
      THEN jsonb_set(COALESCE(equipment_receipts, '{}'::jsonb), ARRAY[p_pilot_id], p_receipt, true)
      ELSE equipment_receipts END,
    CASE WHEN p_field = 'customise_acknowledged'
      THEN jsonb_set(COALESCE(customise_acknowledged, '{}'::jsonb), ARRAY[p_pilot_id], p_receipt, true)
      ELSE customise_acknowledged END,
    CASE WHEN p_field = 'rumour_receipts'
      THEN jsonb_set(COALESCE(rumour_receipts, '{}'::jsonb), ARRAY[p_pilot_id], p_receipt, true)
      ELSE rumour_receipts END
  )
  WHERE id = p_record_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'downtime_records row not found: %', p_record_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;
