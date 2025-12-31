import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'
import { logger } from '../logger'

/**
 * Get the current authenticated user
 */
export async function getUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user || null
}

/**
 * Get the current session
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Sign in with Discord OAuth
 */
export async function signInWithDiscord(redirectUrl: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: false,
    },
  })

  if (error) {
    logger.error('OAuth error:', error)
    throw error
  }

  logger.log('OAuth initiated:', data)
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return subscription
}
