import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCargo, createCargoItem, updateCargoItem, deleteCargoItem } from '../lib/api/cargo'
import { cargoKeys } from './queryKeys'
import { useAuthStore } from '../stores/authStore'
import type { ParentType } from '../types/common'
import type { UpdateCargoInput } from '../lib/validation'

export function useCargo(parentType: ParentType, parentId: string) {
  return useQuery({
    queryKey: cargoKeys.byParent(parentType, parentId),
    queryFn: () => fetchCargo(parentType, parentId),
    enabled: !!parentId,
  })
}

export function useCreateCargoItem(parentType: 'mech' | 'crawler', parentId: string) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (input: {
      name?: string | null
      schema_name?: string | null
      schema_ref_id?: string | null
      amount?: number
    }) => {
      if (!user) throw new Error('Not authenticated')
      return createCargoItem({ ...input, parent_type: parentType, parent_id: parentId }, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cargoKeys.byParent(parentType, parentId),
      })
    },
  })
}

export function useUpdateCargoItem(parentType: ParentType, parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCargoInput }) =>
      updateCargoItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cargoKeys.byParent(parentType, parentId),
      })
    },
  })
}

export function useDeleteCargoItem(parentType: ParentType, parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCargoItem,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cargoKeys.byParent(parentType, parentId),
      })
    },
  })
}
