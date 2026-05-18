import { useMutation, useQueryClient } from '@tanstack/react-query'
import { promoteMember, selfDemote, uninviteMember } from '../lib/api/campaignMemberApi'
import { gameKeys } from './useGames'

export function usePromoteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ campaignId, userId }: { campaignId: string; userId: string }) =>
      promoteMember(campaignId, userId),
    onSuccess: (_data, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.members(campaignId) })
    },
  })
}

export function useSelfDemote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ campaignId }: { campaignId: string }) => selfDemote(campaignId),
    onSuccess: (_data, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.members(campaignId) })
    },
  })
}

export function useUninviteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ campaignId, userId }: { campaignId: string; userId: string }) =>
      uninviteMember(campaignId, userId),
    onSuccess: (_data, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.members(campaignId) })
    },
  })
}
