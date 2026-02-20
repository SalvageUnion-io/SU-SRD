import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  instantiateMechFromPattern,
  getMechById,
  getMechEntityRefs,
  updateMechEntityRefs,
  updateMech,
  listCargoForMech,
  addCargoToMech,
  deleteMechCargoItem,
} from '../lib/api/mechApi'
import { updateEntityRef } from '../lib/api/entityRefApi'
import { pilotKeys } from './usePilots'
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

// --- Cargo hooks ---

export function useMechCargo(mechId: string | undefined) {
  return useQuery({
    queryKey: mechKeys.cargo(mechId ?? ''),
    queryFn: () => listCargoForMech(mechId!),
    enabled: !!mechId,
  })
}

export function useAddMechCargo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      mechId,
      userId,
      input,
    }: {
      mechId: string
      userId: string
      input: {
        name: string
        amount?: number
        schema_name?: string
        schema_ref_id?: string
        metadata?: Record<string, unknown>
      }
    }) => addCargoToMech(mechId, userId, input),
    onSuccess: (_data, { mechId }) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.cargo(mechId) })
    },
  })
}

export function useDeleteMechCargo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cargoId }: { cargoId: string; mechId: string }) => deleteMechCargoItem(cargoId),
    onSuccess: (_data, { mechId }) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.cargo(mechId) })
    },
  })
}
