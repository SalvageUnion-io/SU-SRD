import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getPlayerChoices, upsertPlayerChoice } from '../lib/api/playerChoiceApi'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { useRealtimeSubscription } from './useRealtimeSubscription'

const COMRADE_EP_PREFIX = 'comrade-ep:'

export const comradeEpKeys = {
  forPilot: (pilotId: string) => ['playerChoices', pilotId, 'comradeEp'] as const,
}

type UseComradeEpOptions = {
  pilotId?: string
  userId?: string
  readOnly?: boolean
}

export function useComradeEp({ pilotId, userId, readOnly }: UseComradeEpOptions) {
  const queryClient = useQueryClient()
  const { data: savedChoices } = useQuery({
    queryKey: comradeEpKeys.forPilot(pilotId!),
    queryFn: () => getPlayerChoices(pilotId!, 'pilot'),
    enabled: !!pilotId,
  })

  useRealtimeSubscription(
    'player_choices',
    pilotId ? `parent_id=eq.${pilotId}` : undefined,
    pilotId ? [comradeEpKeys.forPilot(pilotId)] : []
  )

  const upsert = useMutation({
    mutationFn: upsertPlayerChoice,
    onSuccess: () => {
      if (pilotId) {
        queryClient.invalidateQueries({ queryKey: comradeEpKeys.forPilot(pilotId) })
      }
    },
  })

  const [localEp, setLocalEp] = useState<Record<string, number>>({})

  const savedEpMap = useMemo(() => {
    const map = new Map<string, number>()
    if (savedChoices) {
      for (const row of savedChoices) {
        if (row.choice_id.startsWith(COMRADE_EP_PREFIX)) {
          const entityId = row.choice_id.slice(COMRADE_EP_PREFIX.length)
          const val = parseInt(row.selected_value ?? '0', 10)
          if (!isNaN(val)) map.set(entityId, val)
        }
      }
    }
    return map
  }, [savedChoices])

  const getComradeCurrentEp = useCallback(
    (entityId: string, maxEp: number): number => {
      if (entityId in localEp) return localEp[entityId]!
      const saved = savedEpMap.get(entityId)
      return saved ?? maxEp
    },
    [localEp, savedEpMap]
  )

  const updateComradeEp = useCallback(
    (entityId: string, newValue: number, comradeName: string) => {
      if (!pilotId || !userId || readOnly) return
      setLocalEp((prev) => ({ ...prev, [entityId]: newValue }))
      upsert.mutate(
        {
          parent_id: pilotId,
          parent_type: 'pilot' as const,
          choice_id: `${COMRADE_EP_PREFIX}${entityId}`,
          choice_type: 'stat',
          selected_value: String(newValue),
          user_id: userId,
        },
        {
          onSuccess: () => {
            setLocalEp((prev) => {
              const next = { ...prev }
              delete next[entityId]
              return next
            })
            showSaveToast(`${comradeName} EP updated`)
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [pilotId, userId, readOnly, upsert]
  )

  return { getComradeCurrentEp, updateComradeEp }
}
