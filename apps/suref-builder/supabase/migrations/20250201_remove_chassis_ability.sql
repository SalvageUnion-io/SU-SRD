-- Remove chassis_ability column from mechs table
-- This field is no longer needed as chassis abilities are derived from the chassis reference data

ALTER TABLE mechs DROP COLUMN IF EXISTS chassis_ability;

