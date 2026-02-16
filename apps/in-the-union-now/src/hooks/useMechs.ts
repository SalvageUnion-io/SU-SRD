import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  instantiateMechFromPattern,
  getMechById,
  getMechEntityRefs,
  updateMechEntityRefs,
} from '../lib/api/mechApi'
import { pilotKeys } from './usePilots'
import type { EntityRefInsert, InstantiateMechInput } from '../types/common'

export const mechKeys = {
  all: ['mechs'] as const,
  lists: () => [...mechKeys.all, 'list'] as const,
  list: (userId: string) => [...mechKeys.lists(), userId] as const,
  details: () => [...mechKeys.all, 'detail'] as const,
  detail: (id: string) => [...mechKeys.details(), id] as const,
  entityRefs: (mechId: string) => [...mechKeys.all, 'entityRefs', mechId] as const,
}

export function useMech(mechId: string | undefined) {
  return useQuery({
    queryKey: mechKeys.detail(mechId ?? ''),
    queryFn: () => getMechById(mechId!),
    enabled: !!mechId,
  })
}

export function useMechEntityRefs(mechId: string | undefined) {
  return useQuery({
    queryKey: mechKeys.entityRefs(mechId ?? ''),
    queryFn: () => getMechEntityRefs(mechId!),
    enabled: !!mechId,
  })
}

export function useInstantiateMech() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      pilotId,
      input,
    }: {
      userId: string
      pilotId: string
      input: InstantiateMechInput
    }) => instantiateMechFromPattern(userId, pilotId, input),
    onSuccess: (_data, { userId, pilotId }) => {
      // Invalidate pilot detail (now has mech_id)
      queryClient.invalidateQueries({ queryKey: pilotKeys.detail(pilotId) })
      queryClient.invalidateQueries({ queryKey: pilotKeys.list(userId) })
    },
  })
}

export function useUpdateMechLoadout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      mechId,
      inserts,
      deleteIds,
    }: {
      mechId: string
      inserts: EntityRefInsert[]
      deleteIds: string[]
    }) => updateMechEntityRefs(mechId, inserts, deleteIds),
    onSuccess: (_data, { mechId }) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.entityRefs(mechId) })
    },
  })
}
