import { useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to change_log inserts and show toast notifications for other users' actions.
 *
 * Designed for multiplayer views (crawler detail, game detail) where crew members
 * need awareness of each other's edits. Filters out the current user's own changes.
 *
 * @param currentUserId - The current user's ID (skips own changes)
 * @param relevantEntityIds - Optional set of entity IDs to scope notifications to.
 *   When provided, only change_log entries whose target_id matches are shown.
 *   Without this, ALL change_log inserts are displayed (noisy in multiplayer).
 */
export function useActivityFeed(
  currentUserId: string | undefined,
  relevantEntityIds?: Set<string>
) {
  useEffect(() => {
    if (!currentUserId) return

    // Use a stable channel name per user to prevent duplicate subscriptions
    const channel = supabase
      .channel(`activity-feed:${currentUserId}`)
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
            target_id: string | null
            description: string | null
          }
          // Only show notifications for other users' actions
          if (entry.user_id === currentUserId) return
          if (!entry.description) return

          // Client-side scoping: skip entries for unrelated entities
          if (relevantEntityIds && entry.target_id && !relevantEntityIds.has(entry.target_id)) {
            return
          }

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
    // relevantEntityIds is a Set — callers should memoize it for stable identity
  }, [currentUserId, relevantEntityIds])
}
