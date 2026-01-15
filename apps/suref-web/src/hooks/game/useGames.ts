/**
 * TanStack Query hooks for game management
 *
 * Provides hooks for fetching, creating, updating, and deleting games with optimistic updates.
 * All queries require network updates - NO local mode support.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TablesUpdate } from '../../types/database-generated.types'
import { fetchGame, updateGame, deleteGame, fetchUserGamesWithRoles } from '../../lib/api/games'
import { fetchGameCrawler } from '../../lib/api/crawlers'
import type { Tables } from '../../types/database-generated.types'
import { getUser } from '../../lib/api'

type Game = Tables<'games'>

/**
 * Query key factory for games
 * Ensures consistent cache keys across the app
 */
export const gamesKeys = {
  all: ['games'] as const,
  byId: (id: string) => [...gamesKeys.all, id] as const,
  byUser: (userId: string) => [...gamesKeys.all, 'user', userId] as const,
  userGamesList: (userId: string) => [...gamesKeys.all, 'user', userId, 'list'] as const,
  gameCrawler: (gameId: string) => [...gamesKeys.all, gameId, 'crawler'] as const,
}

/**
 * Hook to fetch user's game IDs and roles (lightweight)
 *
 * @returns Query object with array of { game_id, role }
 *
 * @example
 * ```tsx
 * const { data: games, isLoading } = useUserGamesList()
 * ```
 */
export function useUserGamesList() {
  return useQuery({
    queryKey: ['user-games-list'],
    queryFn: async () => {
      const user = await getUser()
      if (!user) throw new Error('Not authenticated')
      return fetchUserGamesWithRoles(user.id)
    },
  })
}

/**
 * Hook to fetch a single game by ID
 *
 * @param id - Game ID to fetch
 * @returns Query object with game data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: game, isLoading, error } = useGame(gameId)
 * ```
 */
export function useGame(id: string | undefined) {
  return useQuery({
    queryKey: id ? gamesKeys.byId(id) : ['games', 'undefined'],
    queryFn: () => {
      if (!id) throw new Error('Game ID is required')
      return fetchGame(id)
    },
    enabled: !!id,
  })
}

/**
 * Hook to fetch game crawler
 *
 * @param gameId - Game ID to fetch crawler for
 * @returns Query object with crawler data or null
 */
export function useGameCrawler(gameId: string | undefined) {
  return useQuery({
    queryKey: gameId ? gamesKeys.gameCrawler(gameId) : ['games', 'undefined', 'crawler'],
    queryFn: () => {
      if (!gameId) throw new Error('Game ID is required')
      return fetchGameCrawler(gameId)
    },
    enabled: !!gameId,
  })
}

/**
 * Hook to update a game
 *
 * Supports optimistic updates for immediate UI feedback.
 * Automatically invalidates the game cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const updateGameMutation = useUpdateGame()
 *
 * await updateGameMutation.mutate({
 *   id: gameId,
 *   updates: { name: 'New Game Name' },
 * })
 * ```
 */
export function useUpdateGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'games'> }) => {
      await updateGame(id, updates)
      return { id, updates }
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: gamesKeys.byId(id) })

      const previousGame = queryClient.getQueryData<Game>(gamesKeys.byId(id))

      if (previousGame) {
        queryClient.setQueryData<Game>(gamesKeys.byId(id), {
          ...previousGame,
          ...updates,
        })
      }

      return { previousGame }
    },
    onError: (_err, { id }, context) => {
      if (context?.previousGame) {
        queryClient.setQueryData(gamesKeys.byId(id), context.previousGame)
      }
    },
  })
}

/**
 * Hook to delete a game
 *
 * Automatically invalidates the game cache on success.
 * Removes the game from cache immediately for optimistic UI.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteGameMutation = useDeleteGame()
 *
 * await deleteGameMutation.mutate(gameId)
 * ```
 */
export function useDeleteGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteGame(id)
      return id
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: gamesKeys.byId(id) })

      const previousGame = queryClient.getQueryData<Game>(gamesKeys.byId(id))

      queryClient.removeQueries({ queryKey: gamesKeys.byId(id) })

      return { previousGame }
    },
    onError: (_err, id, context) => {
      if (context?.previousGame) {
        queryClient.setQueryData(gamesKeys.byId(id), context.previousGame)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gamesKeys.all,
      })
    },
  })
}
