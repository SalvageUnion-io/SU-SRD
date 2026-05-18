import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlayerChoices, upsertPlayerChoice } from '../lib/api/playerChoiceApi'
import { useRealtimeSubscription } from './useRealtimeSubscription'

export const playerChoiceKeys = {
  all: ['playerChoices'] as const,
  forParent: (parentId: string) => [...playerChoiceKeys.all, parentId] as const,
}

type UsePlayerChoiceValueOptions = {
  parentId?: string
  parentType: 'pilot' | 'mech'
}

/**
 * Generic hook for reading/writing player_choices rows.
 * Provides query + realtime subscription + mutation + local optimistic state.
 *
 * Domain-specific hooks (useComradeEp, useComradeChoices) wrap this with
 * their own key-prefix logic and return-value shaping.
 */
export function usePlayerChoiceValue({ parentId, parentType }: UsePlayerChoiceValueOptions) {
  const queryClient = useQueryClient()

  const { data: savedChoices } = useQuery({
    queryKey: playerChoiceKeys.forParent(parentId!),
    queryFn: () => getPlayerChoices(parentId!, parentType),
    enabled: !!parentId,
  })

  useRealtimeSubscription(
    'player_choices',
    parentId ? `parent_id=eq.${parentId}` : undefined,
    parentId ? [playerChoiceKeys.forParent(parentId)] : []
  )

  const upsert = useMutation({
    mutationFn: upsertPlayerChoice,
    onSuccess: () => {
      if (parentId) {
        queryClient.invalidateQueries({ queryKey: playerChoiceKeys.forParent(parentId) })
      }
    },
  })

  const [localEdits, setLocalEdits] = useState<Record<string, string>>({})

  const choiceMap = useMemo(() => {
    const map = new Map<string, string>()
    if (savedChoices) {
      for (const row of savedChoices) {
        map.set(row.choice_id, row.selected_value ?? '')
      }
    }
    return map
  }, [savedChoices])

  const setLocalEdit = useCallback((choiceId: string, value: string) => {
    setLocalEdits((prev) => ({ ...prev, [choiceId]: value }))
  }, [])

  const clearLocalEdit = useCallback((choiceId: string) => {
    setLocalEdits((prev) => {
      const next = { ...prev }
      delete next[choiceId]
      return next
    })
  }, [])

  type SaveEditCallbacks = {
    onSuccess?: () => void
    onError?: (err: Error) => void
  }

  const saveEdit = useCallback(
    (
      choiceId: string,
      choiceType: string,
      value: string,
      userId: string,
      callbacks?: SaveEditCallbacks
    ) => {
      if (!parentId) return
      setLocalEdit(choiceId, value)
      upsert.mutate(
        {
          parent_id: parentId,
          parent_type: parentType,
          choice_id: choiceId,
          choice_type: choiceType,
          selected_value: value,
          user_id: userId,
        },
        {
          onSuccess: () => {
            clearLocalEdit(choiceId)
            callbacks?.onSuccess?.()
          },
          onError: (err) => {
            clearLocalEdit(choiceId)
            callbacks?.onError?.(err as Error)
          },
        }
      )
    },
    [parentId, parentType, upsert, setLocalEdit, clearLocalEdit]
  )

  return { savedChoices, choiceMap, localEdits, setLocalEdit, clearLocalEdit, saveEdit }
}
