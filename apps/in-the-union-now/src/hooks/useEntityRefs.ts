import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchEntityRefs,
  createEntityRef,
  updateEntityRef,
  deleteEntityRef,
  reorderEntityRefs,
} from '../lib/api/entityRefs'
import { entityRefKeys } from './queryKeys'
import { useAuthStore } from '../stores/authStore'
import type { ParentType } from '../types/common'
import type { CreateEntityRefInput, UpdateEntityRefInput } from '../lib/validation'

export function useEntityRefs(parentType: ParentType, parentId: string) {
  return useQuery({
    queryKey: entityRefKeys.byParent(parentType, parentId),
    queryFn: () => fetchEntityRefs(parentType, parentId),
    enabled: !!parentId,
  })
}

export function useCreateEntityRef(parentType: ParentType, parentId: string) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (input: Omit<CreateEntityRefInput, 'parent_type' | 'parent_id'>) => {
      if (!user) throw new Error('Not authenticated')
      return createEntityRef({ ...input, parent_type: parentType, parent_id: parentId }, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: entityRefKeys.byParent(parentType, parentId),
      })
    },
  })
}

export function useUpdateEntityRef(parentType: ParentType, parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEntityRefInput }) =>
      updateEntityRef(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: entityRefKeys.byParent(parentType, parentId),
      })
    },
  })
}

export function useDeleteEntityRef(parentType: ParentType, parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteEntityRef,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: entityRefKeys.byParent(parentType, parentId),
      })
    },
  })
}

export function useReorderEntityRefs(parentType: ParentType, parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reorderEntityRefs,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: entityRefKeys.byParent(parentType, parentId),
      })
    },
  })
}
