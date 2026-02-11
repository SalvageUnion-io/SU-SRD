import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchMech,
  fetchUserMechs,
  fetchMechsByPilot,
  createMech,
  updateMech,
  setActiveMech,
  deleteMech,
} from '../lib/api/mechs'
import { mechKeys, pilotKeys } from './queryKeys'
import { useAuthStore } from '../stores/authStore'
import type { UpdateMechInput } from '../lib/validation'

export function useMech(id: string) {
  return useQuery({
    queryKey: mechKeys.byId(id),
    queryFn: () => fetchMech(id),
    enabled: !!id,
  })
}

export function useUserMechs() {
  return useQuery({
    queryKey: mechKeys.userMechs,
    queryFn: fetchUserMechs,
  })
}

export function useMechsByPilot(pilotId: string) {
  return useQuery({
    queryKey: mechKeys.byPilot(pilotId),
    queryFn: () => fetchMechsByPilot(pilotId),
    enabled: !!pilotId,
  })
}

export function useCreateMech() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (input: {
      name?: string
      chassis_ref?: string | null
      pilot_id?: string | null
    }) => {
      if (!user) throw new Error('Not authenticated')
      return createMech(input, user.id)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.all })
      if (variables.pilot_id) {
        queryClient.invalidateQueries({ queryKey: pilotKeys.roster })
      }
    },
  })
}

export function useUpdateMech(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateMechInput) => updateMech(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(mechKeys.byId(id), data)
      if (data.pilot_id) {
        queryClient.invalidateQueries({ queryKey: mechKeys.byPilot(data.pilot_id) })
      }
      queryClient.invalidateQueries({ queryKey: pilotKeys.roster })
    },
  })
}

export function useSetActiveMech() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pilotId, mechId }: { pilotId: string; mechId: string }) =>
      setActiveMech(pilotId, mechId),
    onSuccess: (_data, { pilotId }) => {
      queryClient.invalidateQueries({ queryKey: mechKeys.byPilot(pilotId) })
      queryClient.invalidateQueries({ queryKey: pilotKeys.roster })
    },
  })
}

export function useDeleteMech() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteMech,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mechKeys.all })
      queryClient.invalidateQueries({ queryKey: pilotKeys.roster })
    },
  })
}
