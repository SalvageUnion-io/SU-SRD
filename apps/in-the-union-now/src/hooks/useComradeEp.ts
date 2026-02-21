import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { usePlayerChoiceValue } from './usePlayerChoiceValue'

const COMRADE_EP_PREFIX = 'comrade-ep:'

type UseComradeEpOptions = {
  pilotId?: string
  userId?: string
  readOnly?: boolean
}

export function useComradeEp({ pilotId, userId, readOnly }: UseComradeEpOptions) {
  const { choiceMap, localEdits, saveEdit } = usePlayerChoiceValue({
    parentId: pilotId,
    parentType: 'pilot',
  })

  const savedEpMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const [key, value] of choiceMap) {
      if (key.startsWith(COMRADE_EP_PREFIX)) {
        const entityId = key.slice(COMRADE_EP_PREFIX.length)
        const val = parseInt(value, 10)
        if (!isNaN(val)) map.set(entityId, val)
      }
    }
    return map
  }, [choiceMap])

  const getComradeCurrentEp = useCallback(
    (entityId: string, maxEp: number): number => {
      const prefixedKey = `${COMRADE_EP_PREFIX}${entityId}`
      if (prefixedKey in localEdits) {
        const val = parseInt(localEdits[prefixedKey]!, 10)
        if (!isNaN(val)) return val
      }
      const saved = savedEpMap.get(entityId)
      return saved ?? maxEp
    },
    [localEdits, savedEpMap]
  )

  const updateComradeEp = useCallback(
    (entityId: string, newValue: number, comradeName: string) => {
      if (!userId || readOnly) return
      saveEdit(`${COMRADE_EP_PREFIX}${entityId}`, 'stat', String(newValue), userId, {
        onSuccess: () => showSaveToast(`${comradeName} EP updated`),
        onError: (err) => toast.error(getErrorMessage(err)),
      })
    },
    [userId, readOnly, saveEdit]
  )

  return { getComradeCurrentEp, updateComradeEp }
}
