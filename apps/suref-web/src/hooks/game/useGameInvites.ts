/**
 * TanStack Query hooks for game invite management
 *
 * Provides hooks for fetching, creating, and expiring game invites with optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchGameInvites,
  createGameInvite,
  expireGameInvite,
  redeemInviteCode,
} from '../../lib/api/games'
import type { GameInvite } from '../../lib/api/games'
import { gamesKeys } from './useGames'

/**
 * Query key factory for game invites
 */
export const gameInvitesKeys = {
  all: ['game-invites'] as const,
  byGame: (gameId: string) => [...gameInvitesKeys.all, 'game', gameId] as const,
}

/**
 * Hook to fetch all invites for a game
 *
 * @param gameId - Game ID to fetch invites for
 * @returns Query object with invites data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: invites, isLoading } = useGameInvites(gameId)
 * ```
 */
export function useGameInvites(gameId: string | undefined) {
  return useQuery({
    queryKey: gameId ? gameInvitesKeys.byGame(gameId) : ['game-invites', 'undefined'],
    queryFn: () => {
      if (!gameId) throw new Error('Game ID is required')
      return fetchGameInvites(gameId)
    },
    enabled: !!gameId,
  })
}

/**
 * Hook to create a new game invite
 *
 * Automatically invalidates the game invites cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const createInvite = useCreateGameInvite()
 *
 * await createInvite.mutate(gameId)
 * ```
 */
export function useCreateGameInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (gameId: string) => {
      return createGameInvite(gameId)
    },
    onSuccess: (newInvite) => {
      queryClient.invalidateQueries({
        queryKey: gameInvitesKeys.byGame(newInvite.game_id),
      })
    },
  })
}

/**
 * Hook to expire a game invite
 *
 * Supports optimistic updates for immediate UI feedback.
 * Automatically invalidates the game invites cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const expireInvite = useExpireGameInvite()
 *
 * await expireInvite.mutate({ inviteId, gameId })
 * ```
 */
export function useExpireGameInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ inviteId }: { inviteId: string; gameId: string }) => {
      await expireGameInvite(inviteId)
      return inviteId
    },
    onMutate: async ({ inviteId, gameId }) => {
      await queryClient.cancelQueries({ queryKey: gameInvitesKeys.byGame(gameId) })

      const previousInvites = queryClient.getQueryData<GameInvite[]>(gameInvitesKeys.byGame(gameId))

      if (previousInvites) {
        queryClient.setQueryData<GameInvite[]>(
          gameInvitesKeys.byGame(gameId),
          previousInvites.filter((invite) => invite.id !== inviteId)
        )
      }

      return { previousInvites }
    },
    onError: (_err, { gameId }, context) => {
      if (context?.previousInvites) {
        queryClient.setQueryData(gameInvitesKeys.byGame(gameId), context.previousInvites)
      }
    },
    onSuccess: (_data, { gameId }) => {
      queryClient.invalidateQueries({
        queryKey: gameInvitesKeys.byGame(gameId),
      })
    },
  })
}

/**
 * Hook to redeem an invite code
 *
 * Returns the game ID on success.
 * Invalidates all games queries to update the user's game list.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const redeemInvite = useRedeemInviteCode()
 *
 * const gameId = await redeemInvite.mutateAsync(inviteCode)
 * ```
 */
export function useRedeemInviteCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      return redeemInviteCode(inviteCode)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gamesKeys.all,
      })
    },
  })
}
