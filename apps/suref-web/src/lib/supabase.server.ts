import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-generated.types'
import { getSupabaseUrl, getSupabaseAnonKey } from './env'

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

/**
 * Get Supabase client for server-side operations
 * This creates a new client instance for each request
 */
export function getSupabaseServerClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * Server function to fetch current user
 * Returns null if not authenticated
 */
export const fetchCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  }
})

/**
 * Server function to check if user is authenticated
 */
export const isAuthenticated = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await fetchCurrentUser()
  return !!user
})
