-- ============================================================================
-- USER DISPLAY NAME FUNCTION
-- ============================================================================
-- Creates a function to fetch user display names from auth.users metadata
-- This allows clients to display Discord usernames for entity owners
--
-- Migration Date: 2025-02-06
-- ============================================================================

-- Create function to get user display name
CREATE OR REPLACE FUNCTION get_user_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_display_name(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Test the function with your own user ID
-- SELECT get_user_display_name(auth.uid());

-- Test with a specific user ID
-- SELECT get_user_display_name('00000000-0000-0000-0000-000000000000'::UUID);

