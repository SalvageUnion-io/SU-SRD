/**
 * TanStack Query hooks for game member management
 *
 * Provides hooks for fetching game members and user roles.
 */

import { useQuery } from '@tanstack/react-query'
import { fetchGameMembers, getUserGameRole } from '../../lib/api/games'

/**
 * Query key factory for game members
 */
export const gameMembersKeys = {
  all: ['game-members'] as const,
  byGame: (gameId: string) => [...gameMembersKeys.all, 'game', gameId] as const,
  role: (gameId: string, userId: string) =>
    [...gameMembersKeys.all, 'role', gameId, userId] as const,
}

/**
 * Hook to fetch all members of a game
 *
 * @param gameId - Game ID to fetch members for
 * @returns Query object with members data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: members, isLoading } = useGameMembers(gameId)
 * ```
 */
export function useGameMembers(gameId: string | undefined) {
  return useQuery({
    queryKey: gameId ? gameMembersKeys.byGame(gameId) : ['game-members', 'undefined'],
    queryFn: () => {
      if (!gameId) throw new Error('Game ID is required')
      return fetchGameMembers(gameId)
    },
    enabled: !!gameId,
  })
}

/**
 * Hook to fetch a user's role in a game
 *
 * @param gameId - Game ID
 * @param userId - User ID
 * @returns Query object with role data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: role, isLoading } = useUserGameRole(gameId, userId)
 * ```
 */
export function useUserGameRole(gameId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey:
      gameId && userId
        ? gameMembersKeys.role(gameId, userId)
        : ['game-members', 'role', 'undefined'],
    queryFn: () => {
      if (!gameId || !userId) throw new Error('Game ID and User ID are required')
      return getUserGameRole(gameId, userId)
    },
    enabled: !!gameId && !!userId,
  })
}
