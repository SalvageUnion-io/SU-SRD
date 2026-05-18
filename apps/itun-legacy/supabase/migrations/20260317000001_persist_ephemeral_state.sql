-- Story 10: Persist trade roll state to DB
-- Adds trade roll columns so the mediator's Trading Bay roll survives page refresh.
ALTER TABLE downtime_records ADD COLUMN IF NOT EXISTS trade_roll_key text;
ALTER TABLE downtime_records ADD COLUMN IF NOT EXISTS trade_roll_value integer;

-- Story 11: Persist deterioration state + idempotency guard
-- Stores the UpkeepResult snapshot before consequences are applied so that
-- a page refresh mid-deterioration can restore the mediator's roll result.
ALTER TABLE downtime_records ADD COLUMN IF NOT EXISTS deterioration_pending jsonb;
