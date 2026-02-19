import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to Postgres changes on a table and invalidate TanStack Query cache.
 *
 * Design: purely additive — existing API → TanStack Query → components data flow
 * is unchanged. Realtime just triggers cache invalidation, which causes refetch.
 *
 * @param table - The table to subscribe to
 * @param filter - PostgREST-style filter (e.g., "crawler_id=eq.abc123")
 * @param queryKeys - TanStack Query keys to invalidate on change
 */
export function useRealtimeSubscription(
  table: string,
  filter: string | undefined,
  queryKeys: QueryKey[]
) {
  const queryClient = useQueryClient()
  const serializedKeys = JSON.stringify(queryKeys)

  useEffect(() => {
    if (!filter) return

    const keys: QueryKey[] = JSON.parse(serializedKeys)

    const channel = supabase
      .channel(`${table}-${filter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        () => {
          keys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key })
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter, queryClient, serializedKeys])
}
