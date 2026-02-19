import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { getPlayerChoices, upsertPlayerChoice } from '../lib/api/playerChoiceApi'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { useRealtimeSubscription } from './useRealtimeSubscription'

export const playerChoiceKeys = {
  all: ['playerChoices'] as const,
  forParent: (parentId: string) => [...playerChoiceKeys.all, parentId] as const,
}

export function usePlayerChoices(parentId: string | undefined) {
  return useQuery({
    queryKey: playerChoiceKeys.forParent(parentId!),
    queryFn: () => getPlayerChoices(parentId!, 'mech'),
    enabled: !!parentId,
  })
}

export function useUpsertPlayerChoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertPlayerChoice,
    onSuccess: (data) => {
      if (data.parent_id) {
        queryClient.invalidateQueries({
          queryKey: playerChoiceKeys.forParent(data.parent_id),
        })
      }
    },
  })
}

type UseComradeChoicesOptions = {
  mechId?: string
  userId?: string
  readOnly?: boolean
}

export function useComradeChoices({ mechId, userId, readOnly }: UseComradeChoicesOptions) {
  const { data: savedChoices } = usePlayerChoices(mechId)
  const upsert = useUpsertPlayerChoice()
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({})

  useRealtimeSubscription(
    'player_choices',
    mechId ? `parent_id=eq.${mechId}` : undefined,
    mechId ? [playerChoiceKeys.forParent(mechId)] : []
  )

  const choiceMap = useMemo(() => {
    const map = new Map<string, string>()
    if (savedChoices) {
      for (const row of savedChoices) {
        map.set(row.choice_id, row.selected_value ?? '')
      }
    }
    return map
  }, [savedChoices])

  const getLocalValue = useCallback(
    (choiceId: string) => {
      if (choiceId in localEdits) return localEdits[choiceId] ?? ''
      return choiceMap.get(choiceId) ?? ''
    },
    [localEdits, choiceMap]
  )

  const setLocalValue = useCallback((choiceId: string, value: string) => {
    setLocalEdits((prev) => ({ ...prev, [choiceId]: value }))
  }, [])

  const saveChoice = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      if (!mechId || !userId || readOnly) return
      // Skip save if value hasn't changed from server
      const serverValue = choiceMap.get(choice.id) ?? ''
      if (value === serverValue) {
        // Clear local edit since it matches server
        setLocalEdits((prev) => {
          const next = { ...prev }
          delete next[choice.id]
          return next
        })
        return
      }

      upsert.mutate(
        {
          parent_id: mechId,
          parent_type: 'mech' as const,
          choice_id: choice.id,
          choice_type: choice.choiceType ?? 'freeform',
          selected_value: value,
          user_id: userId,
        },
        {
          onSuccess: () => {
            setLocalEdits((prev) => {
              const next = { ...prev }
              delete next[choice.id]
              return next
            })
            showSaveToast()
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mechId, userId, readOnly, choiceMap, upsert]
  )

  return { getLocalValue, setLocalValue, saveChoice }
}
