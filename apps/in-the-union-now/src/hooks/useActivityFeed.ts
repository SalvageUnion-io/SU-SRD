import { useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to change_log inserts and show toast notifications for other users' actions.
 *
 * Designed for multiplayer views (crawler detail, game detail) where crew members
 * need awareness of each other's edits. Filters out the current user's own changes.
 */
export function useActivityFeed(currentUserId: string | undefined) {
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'change_log',
        },
        (payload) => {
          const entry = payload.new as {
            user_id: string
            description: string | null
          }
          // Only show notifications for other users' actions
          if (entry.user_id === currentUserId) return
          if (!entry.description) return

          toast.info(entry.description, {
            duration: 4000,
            position: 'bottom-left',
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])
}
