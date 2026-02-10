import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-generated.types'
import { getSupabaseUrl, getSupabaseAnonKey } from './env'

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: false,
  },
})
