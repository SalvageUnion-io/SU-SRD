import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchChoicesByEntityRef, upsertChoice, deleteChoice } from '../lib/api/choices'
import { choiceKeys } from './queryKeys'
import { useAuthStore } from '../stores/authStore'

export function useChoices(entityRefId: string) {
  return useQuery({
    queryKey: choiceKeys.byEntityRef(entityRefId),
    queryFn: () => fetchChoicesByEntityRef(entityRefId),
    enabled: !!entityRefId,
  })
}

export function useUpsertChoice(entityRefId: string) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ choiceRefId, value }: { choiceRefId: string; value: string }) => {
      if (!user) throw new Error('Not authenticated')
      return upsertChoice(entityRefId, choiceRefId, value, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choiceKeys.byEntityRef(entityRefId) })
    },
  })
}

export function useDeleteChoice(entityRefId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteChoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choiceKeys.byEntityRef(entityRefId) })
    },
  })
}
