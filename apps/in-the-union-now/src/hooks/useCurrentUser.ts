import { useAuthStore } from '../stores/authStore'
import type { User } from '@supabase/supabase-js'

export function useCurrentUser(): User {
  const user = useAuthStore((s) => s.user)
  if (!user) throw new Error('useCurrentUser must be used within an authenticated route')
  return user
}
