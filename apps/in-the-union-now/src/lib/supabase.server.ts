import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-generated.types'
import { getSupabaseUrl, getSupabaseAnonKey } from './env'

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

export function getSupabaseServerClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

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
