import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { getPlayerChoices } from '../lib/api/playerChoiceApi'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { usePlayerChoiceValue, playerChoiceKeys } from './usePlayerChoiceValue'

export function usePlayerChoices(parentId: string | undefined) {
  return useQuery({
    queryKey: playerChoiceKeys.forParent(parentId!),
    queryFn: () => getPlayerChoices(parentId!, 'mech'),
    enabled: !!parentId,
  })
}

type UseComradeChoicesOptions = {
  mechId?: string
  userId?: string
  readOnly?: boolean
}

export function useComradeChoices({ mechId, userId, readOnly }: UseComradeChoicesOptions) {
  const { choiceMap, localEdits, setLocalEdit, clearLocalEdit, saveEdit } = usePlayerChoiceValue({
    parentId: mechId,
    parentType: 'mech',
  })

  const getLocalValue = useCallback(
    (choiceId: string) => {
      if (choiceId in localEdits) return localEdits[choiceId] ?? ''
      return choiceMap.get(choiceId) ?? ''
    },
    [localEdits, choiceMap]
  )

  const setLocalValue = useCallback(
    (choiceId: string, value: string) => {
      setLocalEdit(choiceId, value)
    },
    [setLocalEdit]
  )

  const saveChoice = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      if (!userId || readOnly) return
      // Skip save if value hasn't changed from server
      const serverValue = choiceMap.get(choice.id) ?? ''
      if (value === serverValue) {
        clearLocalEdit(choice.id)
        return
      }
      saveEdit(choice.id, choice.choiceType ?? 'freeform', value, userId, {
        onSuccess: () => showSaveToast(),
        onError: (err) => toast.error(getErrorMessage(err)),
      })
    },
    [userId, readOnly, choiceMap, clearLocalEdit, saveEdit]
  )

  const saveStat = useCallback(
    (choiceId: string, value: string) => {
      if (!userId || readOnly) return
      const serverValue = choiceMap.get(choiceId) ?? ''
      if (value === serverValue) {
        clearLocalEdit(choiceId)
        return
      }
      saveEdit(choiceId, 'stat', value, userId, {
        onSuccess: () => showSaveToast(),
        onError: (err) => toast.error(getErrorMessage(err)),
      })
    },
    [userId, readOnly, choiceMap, clearLocalEdit, saveEdit]
  )

  return { getLocalValue, setLocalValue, saveChoice, saveStat }
}
