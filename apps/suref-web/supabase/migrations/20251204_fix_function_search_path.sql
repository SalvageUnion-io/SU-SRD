-- Fix Function Search Path Security Issue
-- Sets search_path for all functions to prevent search path injection attacks
-- See: https://supabase.com/docs/guides/database/postgres/security#function-search-path
--
-- Issue: Functions without an explicit search_path are vulnerable to search path injection.
-- An attacker could manipulate the search_path to execute malicious code, especially
-- in SECURITY DEFINER functions which run with elevated privileges.
-- Fix: Add SET search_path = '' or SET search_path = pg_catalog to all functions.

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS (Critical - run with elevated privileges)
-- ============================================================================

-- get_user_display_name
CREATE OR REPLACE FUNCTION public.get_user_display_name(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_display_name TEXT;
  v_email TEXT;
BEGIN
  -- Fetch user metadata from auth.users
  SELECT 
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      raw_user_meta_data->>'user_name',
      raw_user_meta_data->>'username',
      email
    ),
    email
  INTO v_display_name, v_email
  FROM auth.users
  WHERE id = p_user_id;

  -- If we got an email but no display name, use the part before @
  IF v_display_name IS NULL AND v_email IS NOT NULL THEN
    v_display_name := split_part(v_email, '@', 1);
  END IF;

  RETURN v_display_name;
END;
$function$;

-- user_owns_choice
CREATE OR REPLACE FUNCTION public.user_owns_choice(choice_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  choice_record RECORD;
BEGIN
  -- Get the choice
  SELECT entity_id, player_choice_id INTO choice_record
  FROM public.player_choices
  WHERE id = choice_id;
  
  -- If not found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If choice has entity_id, check if user owns the entity
  IF choice_record.entity_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.suentities WHERE id = choice_record.entity_id AND (
        pilot_id IN (SELECT id FROM public.pilots WHERE public.pilots.user_id = user_owns_choice.user_id)
        OR mech_id IN (SELECT id FROM public.mechs WHERE public.mechs.user_id = user_owns_choice.user_id)
        OR crawler_id IN (SELECT id FROM public.crawlers WHERE public.crawlers.user_id = user_owns_choice.user_id)
      )
    );
  END IF;
  
  -- If choice has player_choice_id, recursively check parent
  IF choice_record.player_choice_id IS NOT NULL THEN
    RETURN public.user_owns_choice(choice_record.player_choice_id, user_owns_choice.user_id);
  END IF;
  
  -- Should never reach here due to constraint, but return false to be safe
  RETURN FALSE;
END;
$function$;

-- is_game_member
CREATE OR REPLACE FUNCTION public.is_game_member(game_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.game_members
    WHERE game_id = game_uuid
    AND user_id = user_uuid
  );
END;
$function$;

-- is_game_mediator
CREATE OR REPLACE FUNCTION public.is_game_mediator(game_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.game_members
    WHERE game_id = game_uuid
    AND user_id = user_uuid
    AND role = 'mediator'
  );
END;
$function$;

-- create_game_invite
CREATE OR REPLACE FUNCTION public.create_game_invite(p_game_id uuid, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_max_uses integer DEFAULT NULL::integer)
RETURNS public.game_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_code TEXT;
  v_user UUID := auth.uid();
  v_invite public.game_invites;
  v_expires_at TIMESTAMPTZ := COALESCE(p_expires_at, NOW() + INTERVAL '48 hours');
  v_max_uses INTEGER := COALESCE(p_max_uses, 8);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  -- Ensure caller is mediator
  IF NOT public.is_game_mediator(p_game_id, v_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Generate a unique code from UUID
  LOOP
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.game_invites WHERE code = v_code);
  END LOOP;

  INSERT INTO public.game_invites (game_id, code, created_by, expires_at, max_uses)
  VALUES (p_game_id, v_code, v_user, v_expires_at, v_max_uses)
  RETURNING * INTO v_invite;

  RETURN v_invite;
END;
$function$;

-- expire_invite
CREATE OR REPLACE FUNCTION public.expire_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_game UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT game_id INTO v_game FROM public.game_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF NOT public.is_game_mediator(v_game, v_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.game_invites SET expires_at = NOW() WHERE id = p_invite_id;
END;
$function$;

-- redeem_invite_code
CREATE OR REPLACE FUNCTION public.redeem_invite_code(invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_inv public.game_invites%rowtype;
  v_game_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Lock invite row for update to avoid race on uses
  SELECT * INTO v_inv
  FROM public.game_invites
  WHERE code = invite_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  -- Check expiry and max uses
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'expired_invite';
  END IF;
  IF v_inv.max_uses IS NOT NULL AND COALESCE(v_inv.uses, 0) >= v_inv.max_uses THEN
    RAISE EXCEPTION 'invite_max_uses_reached';
  END IF;

  v_game_id := v_inv.game_id;

  -- If already a member, just return
  IF public.is_game_member(v_game_id, v_user) THEN
    RETURN v_game_id;
  END IF;

  -- Insert membership explicitly as player
  INSERT INTO public.game_members (game_id, user_id, role)
  VALUES (v_game_id, v_user, 'player');

  -- Increment uses
  UPDATE public.game_invites SET uses = COALESCE(uses, 0) + 1 WHERE id = v_inv.id;

  RETURN v_game_id;
END;
$function$;

-- get_game_members
CREATE OR REPLACE FUNCTION public.get_game_members(p_game_id uuid)
RETURNS TABLE(id uuid, user_id uuid, role text, user_name text, user_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_game_member(p_game_id, v_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    gm.id,
    gm.user_id,
    gm.role::text,
    COALESCE(
      (u.raw_user_meta_data ->> 'user_name')::text,
      (u.raw_user_meta_data ->> 'full_name')::text,
      (u.email)::text
    )::text AS user_name,
    (u.email)::text AS user_email
  FROM public.game_members gm
  JOIN auth.users u ON u.id = gm.user_id
  WHERE gm.game_id = p_game_id;
END;
$function$;

-- handle_new_game (trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_game()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.game_members (game_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'mediator');
  RETURN NEW;
END;
$function$;

-- test_auth_uid (testing function)
CREATE OR REPLACE FUNCTION public.test_auth_uid()
RETURNS TABLE(uid uuid, jwt_sub text, jwt_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY SELECT 
    auth.uid() AS uid,
    current_setting('request.jwt.claim.sub', true) AS jwt_sub,
    current_setting('request.jwt.claim.role', true) AS jwt_role;
END;
$function$;

-- ============================================================================
-- REGULAR FUNCTIONS (Non-SECURITY DEFINER, but still should be fixed)
-- ============================================================================

-- set_game_created_by (trigger function)
CREATE OR REPLACE FUNCTION public.set_game_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$function$;

-- update_updated_at_column (trigger function)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- generate_invite_code (utility function)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar looking chars
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$function$;

