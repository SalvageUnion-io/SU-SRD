import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listGames,
  getGameById,
  getGameByCrawlerId,
  getGameMembers,
  createGame,
  deleteGame,
  joinGame,
  regenerateInviteCode,
  archiveGame,
} from '../lib/api/gameApi'

export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (userId: string, includeArchived = false) =>
    [...gameKeys.lists(), userId, { includeArchived }] as const,
  details: () => [...gameKeys.all, 'detail'] as const,
  detail: (id: string) => [...gameKeys.details(), id] as const,
  members: (gameId: string) => [...gameKeys.all, 'members', gameId] as const,
}

export function useGames(userId: string | undefined, includeArchived = false) {
  return useQuery({
    queryKey: gameKeys.list(userId ?? '', includeArchived),
    queryFn: () => listGames(userId!, includeArchived),
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

export function useGameByCrawlerId(crawlerId: string | undefined) {
  return useQuery({
    queryKey: [...gameKeys.all, 'byCrawler', crawlerId ?? ''] as const,
    queryFn: () => getGameByCrawlerId(crawlerId!),
    enabled: !!crawlerId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    },
  })
}

export function useDeleteGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gameId }: { gameId: string }) => deleteGame(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    },
  })
}

export function useJoinGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, inviteCode }: { userId: string; inviteCode: string }) =>
      joinGame(userId, inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
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

export function useArchiveGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gameId, archived }: { gameId: string; archived: boolean }) =>
      archiveGame(gameId, archived),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
      queryClient.setQueryData(gameKeys.detail(data.id), data)
    },
  })
}
