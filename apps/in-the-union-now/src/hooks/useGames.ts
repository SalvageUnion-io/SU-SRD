import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listGames,
  getGameById,
  getGameMembers,
  createGame,
  updateGame,
  deleteGame,
  joinGame,
  regenerateInviteCode,
} from '../lib/api/gameApi'
import type { CampaignUpdate } from '../types/common'

export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (userId: string) => [...gameKeys.lists(), userId] as const,
  details: () => [...gameKeys.all, 'detail'] as const,
  detail: (id: string) => [...gameKeys.details(), id] as const,
  members: (gameId: string) => [...gameKeys.all, 'members', gameId] as const,
}

export function useGames(userId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.list(userId ?? ''),
    queryFn: () => listGames(userId!),
    enabled: !!userId,
  })
}

export function useGame(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.detail(gameId ?? ''),
    queryFn: () => getGameById(gameId!),
    enabled: !!gameId,
  })
}

export function useGameMembers(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.members(gameId ?? ''),
    queryFn: () => getGameMembers(gameId!),
    enabled: !!gameId,
  })
}

export function useCreateGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) => createGame(userId, name),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.list(userId) })
    },
  })
}

export function useUpdateGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gameId, input }: { gameId: string; input: CampaignUpdate; userId: string }) =>
      updateGame(gameId, input),
    onSuccess: (data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.list(userId) })
      queryClient.setQueryData(gameKeys.detail(data.id), data)
    },
  })
}

export function useDeleteGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gameId }: { gameId: string; userId: string }) => deleteGame(gameId),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.list(userId) })
    },
  })
}

export function useJoinGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, inviteCode }: { userId: string; inviteCode: string }) =>
      joinGame(userId, inviteCode),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.list(userId) })
    },
  })
}

export function useRegenerateInviteCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gameId }: { gameId: string }) => regenerateInviteCode(gameId),
    onSuccess: (_data, { gameId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) })
    },
  })
}
