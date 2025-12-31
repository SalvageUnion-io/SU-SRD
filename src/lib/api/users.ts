import { supabase } from '../supabase'
import { logger } from '../logger'

/**
 * Fetch user display name by user ID
 * Returns the Discord username or email-based fallback
 */
export async function fetchUserDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_user_display_name', {
    p_user_id: userId,
  })

  if (error) {
    logger.error('Error fetching user display name:', error)
    return null
  }

  return data as string | null
}
