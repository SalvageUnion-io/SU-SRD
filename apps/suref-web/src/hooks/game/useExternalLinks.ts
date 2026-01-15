/**
 * TanStack Query hooks for external link management
 *
 * Provides hooks for fetching, creating, and deleting external links with optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchGameExternalLinks, createExternalLink, deleteExternalLink } from '../../lib/api/games'
import type { ExternalLink } from '../../lib/api/games'

/**
 * Query key factory for external links
 */
export const externalLinksKeys = {
  all: ['external-links'] as const,
  byGame: (gameId: string) => [...externalLinksKeys.all, 'game', gameId] as const,
}

/**
 * Hook to fetch all external links for a game
 *
 * @param gameId - Game ID to fetch links for
 * @returns Query object with links data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: links, isLoading } = useExternalLinks(gameId)
 * ```
 */
export function useExternalLinks(gameId: string | undefined) {
  return useQuery({
    queryKey: gameId ? externalLinksKeys.byGame(gameId) : ['external-links', 'undefined'],
    queryFn: () => {
      if (!gameId) throw new Error('Game ID is required')
      return fetchGameExternalLinks(gameId)
    },
    enabled: !!gameId,
  })
}

/**
 * Hook to create a new external link
 *
 * Automatically invalidates the external links cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const createLink = useCreateExternalLink()
 *
 * await createLink.mutate({
 *   gameId,
 *   url: 'https://example.com',
 *   name: 'Example Link'
 * })
 * ```
 */
export function useCreateExternalLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ gameId, url, name }: { gameId: string; url: string; name: string }) => {
      return createExternalLink(gameId, url, name)
    },
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({
        queryKey: externalLinksKeys.byGame(newLink.game_id),
      })
    },
  })
}

/**
 * Hook to delete an external link
 *
 * Supports optimistic updates for immediate UI feedback.
 * Automatically invalidates the external links cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteLink = useDeleteExternalLink()
 *
 * await deleteLink.mutate({ linkId, gameId })
 * ```
 */
export function useDeleteExternalLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ linkId }: { linkId: string; gameId: string }) => {
      await deleteExternalLink(linkId)
      return linkId
    },
    onMutate: async ({ linkId, gameId }) => {
      await queryClient.cancelQueries({ queryKey: externalLinksKeys.byGame(gameId) })

      const previousLinks = queryClient.getQueryData<ExternalLink[]>(
        externalLinksKeys.byGame(gameId)
      )

      if (previousLinks) {
        queryClient.setQueryData<ExternalLink[]>(
          externalLinksKeys.byGame(gameId),
          previousLinks.filter((link) => link.id !== linkId)
        )
      }

      return { previousLinks }
    },
    onError: (_err, { gameId }, context) => {
      if (context?.previousLinks) {
        queryClient.setQueryData(externalLinksKeys.byGame(gameId), context.previousLinks)
      }
    },
    onSuccess: (_data, { gameId }) => {
      queryClient.invalidateQueries({
        queryKey: externalLinksKeys.byGame(gameId),
      })
    },
  })
}
