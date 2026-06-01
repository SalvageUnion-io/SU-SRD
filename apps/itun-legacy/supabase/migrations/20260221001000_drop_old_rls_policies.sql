-- Drop old RLS policies that use bare auth.uid() instead of (select auth.uid()).
-- The previous migration created new optimized policies but the old ones remain
-- because they had different names. This dynamically finds and drops any policy
-- on each table that doesn't match our new naming convention.

DO $$
DECLARE
  _rec RECORD;
  _new_prefixes TEXT[] := ARRAY[
    'Users can view own',
    'Users can insert own',
    'Users can update own',
    'Users can delete own'
  ];
  _is_new BOOLEAN;
  _prefix TEXT;
BEGIN
  FOR _rec IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'pilots', 'mechs', 'crawlers', 'entity_refs', 'cargo',
        'player_choices', 'campaigns', 'campaign_members',
        'mech_patterns', 'change_log'
      )
  LOOP
    _is_new := FALSE;
    FOREACH _prefix IN ARRAY _new_prefixes LOOP
      IF _rec.policyname LIKE _prefix || '%' THEN
        _is_new := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF NOT _is_new THEN
      RAISE NOTICE 'Dropping old policy "%" on table "%"', _rec.policyname, _rec.tablename;
      EXECUTE format('DROP POLICY %I ON %I', _rec.policyname, _rec.tablename);
    END IF;
  END LOOP;
END;
$$;
