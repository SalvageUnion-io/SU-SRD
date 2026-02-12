import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPilot,
  fetchPilotRoster,
  createPilot,
  updatePilot,
  deletePilot,
} from '../lib/api/pilots'
import { pilotKeys, mechKeys } from './queryKeys'
import { useAuthStore } from '../stores/authStore'
import type { UpdatePilotInput } from '../lib/validation'

export function usePilotRoster() {
  return useQuery({
    queryKey: pilotKeys.roster,
    queryFn: fetchPilotRoster,
  })
}

export function usePilot(id: string) {
  return useQuery({
    queryKey: pilotKeys.byId(id),
    queryFn: () => fetchPilot(id),
    enabled: !!id,
  })
}

export function useCreatePilot() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (input: { callsign: string; class_ref?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      return createPilot(input, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.all })
    },
  })
}

export function useUpdatePilot(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdatePilotInput) => updatePilot(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(pilotKeys.byId(id), data)
      queryClient.invalidateQueries({ queryKey: pilotKeys.roster })
    },
  })
}

export function useDeletePilot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePilot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.all })
      queryClient.invalidateQueries({ queryKey: mechKeys.all })
    },
  })
}
