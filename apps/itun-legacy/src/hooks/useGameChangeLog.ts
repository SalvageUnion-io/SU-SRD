import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { changeLogApi } from '../lib/api/changeLogApi'
import type { ChangeLogEntry } from '../lib/api/changeLogApi'
import { supabase } from '../lib/supabase'

const changeLogKeys = {
  all: ['changeLog'] as const,
  byGame: (gameId: string) => [...changeLogKeys.all, 'game', gameId] as const,
}

export function useGameChangeLog(gameId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery({
    queryKey: changeLogKeys.byGame(gameId ?? ''),
    queryFn: ({ pageParam }) => changeLogApi.listByGame(gameId!, { before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return undefined
      const last = lastPage[lastPage.length - 1]
      return last ? last.created_at : undefined
    },
    enabled: !!gameId,
  })

  // Realtime: prepend new entries into first page of cache
  useEffect(() => {
    if (!gameId) return

    const channel = supabase
      .channel(`change_log-game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'change_log',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newEntry = payload.new as ChangeLogEntry
          queryClient.setQueryData<InfiniteData<ChangeLogEntry[]>>(
            changeLogKeys.byGame(gameId),
            (old) => {
              if (!old) return old
              const firstPage = old.pages[0] ?? []
              return {
                ...old,
                pages: [[newEntry, ...firstPage], ...old.pages.slice(1)],
              }
            }
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, queryClient])

  const entries = query.data?.pages.flat() ?? []

  return {
    entries,
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
