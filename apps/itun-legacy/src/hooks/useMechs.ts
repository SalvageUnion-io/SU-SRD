import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  instantiateMechFromPattern,
  getMechById,
  getMechEntityRefs,
  updateMechEntityRefs,
  updateMech,
} from '../lib/api/mechApi'
import { offloadMechCargo } from '../lib/api/cargoApi'
import { useCargoQuery, useAddCargo, useDeleteCargo } from './useCargo'
import { updateEntityRef, batchRepairEntityRefs } from '../lib/api/entityRefApi'
import { pilotKeys } from './usePilots'
import { crawlerKeys } from './useCrawlers'
import type {
  EntityRefInsert,
  EntityRefUpdate,
  InstantiateMechInput,
  MechRow,
  MechUpdate,
} from '../types/common'

export const mechKeys = {
  all: ['mechs'] as const,
  lists: () => [...mechKeys.all, 'list'] as const,
  list: (userId: string) => [...mechKeys.lists(), userId] as const,
  details: () => [...mechKeys.all, 'detail'] as const,
  detail: (id: string) => [...mechKeys.details(), id] as const,
  entityRefs: (mechId: string) => [...mechKeys.all, 'entityRefs', mechId] as const,
  cargo: (mechId: string) => [...mechKeys.all, 'cargo', mechId] as const,
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

export function useUpdateMech() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ mechId, input }: { mechId: string; input: MechUpdate }) =>
      updateMech(mechId, input),
    onMutate: async ({ mechId, input }) => {
      await queryClient.cancelQueries({ queryKey: mechKeys.detail(mechId) })
      const previous = queryClient.getQueryData<MechRow>(mechKeys.detail(mechId))
      if (previous) {
        queryClient.setQueryData(mechKeys.detail(mechId), { ...previous, ...input })
      }
      return { previous }
    },
    onError: (_err, { mechId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(mechKeys.detail(mechId), context.previous)
      }
    },
    onSuccess: (data: MechRow) => {
      queryClient.setQueryData(mechKeys.detail(data.id), data)
    },
  })
}

export function useUpdateMechEntityRef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ refId, input }: { refId: string; input: EntityRefUpdate; mechId: string }) =>
      updateEntityRef(refId, input),
    onSuccess: (_data, { mechId }) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.entityRefs(mechId) })
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

export function useOffloadMechCargo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      mechId,
      crawlerId,
      storageCargoIds,
      scrapAdditions,
    }: {
      mechId: string
      crawlerId: string
      storageCargoIds: string[]
      scrapAdditions: Record<string, number>
    }) => offloadMechCargo(mechId, crawlerId, storageCargoIds, scrapAdditions),
    onSuccess: (_, { mechId, crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.cargo(mechId) })
      queryClient.invalidateQueries({ queryKey: crawlerKeys.detail(crawlerId) })
      queryClient.invalidateQueries({ queryKey: crawlerKeys.cargo(crawlerId) })
    },
  })
}

export function useBatchRepairEntityRefs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ refIds }: { refIds: string[]; mechId: string }) => batchRepairEntityRefs(refIds),
    onSuccess: (_, { mechId }) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.entityRefs(mechId) })
    },
  })
}

// --- Cargo hooks (delegated to shared useCargo) ---

export function useMechCargo(
  mechId: string | undefined,
  extraOptions?: Parameters<typeof useCargoQuery>[3]
) {
  return useCargoQuery(mechId, 'mech', mechKeys.cargo(mechId ?? ''), extraOptions)
}

export function useAddMechCargo() {
  return useAddCargo((parentId) => mechKeys.cargo(parentId), 'mech')
}

export function useDeleteMechCargo() {
  return useDeleteCargo((parentId) => mechKeys.cargo(parentId))
}
