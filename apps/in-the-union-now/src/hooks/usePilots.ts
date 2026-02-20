import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listPilots,
  getPilotById,
  createPilot,
  updatePilot,
  deletePilot,
  getPilotEntityRefs,
  listAbilityCountsByPilotIds,
  listPilotsByCrawlerId,
  assignPilotToCrawler,
} from '../lib/api/pilotApi'
import { updateEntityRef, deleteEntityRef, createEntityRef } from '../lib/api/entityRefApi'
import type {
  CreatePilotInput,
  EntityRefInsert,
  EntityRefUpdate,
  PilotRow,
  PilotUpdate,
} from '../types/common'

export const pilotKeys = {
  all: ['pilots'] as const,
  lists: () => [...pilotKeys.all, 'list'] as const,
  list: (userId: string) => [...pilotKeys.lists(), userId] as const,
  details: () => [...pilotKeys.all, 'detail'] as const,
  detail: (id: string) => [...pilotKeys.details(), id] as const,
  entityRefs: (pilotId: string) => [...pilotKeys.all, 'entityRefs', pilotId] as const,
  abilityCounts: (pilotIds: string[]) => [...pilotKeys.all, 'abilityCounts', ...pilotIds] as const,
  forCrawler: (crawlerId: string) => [...pilotKeys.all, 'crawler', crawlerId] as const,
}

export function usePilots(userId: string | undefined) {
  return useQuery({
    queryKey: pilotKeys.list(userId ?? ''),
    queryFn: () => listPilots(userId!),
    enabled: !!userId,
  })
}

export function usePilot(pilotId: string | undefined) {
  return useQuery({
    queryKey: pilotKeys.detail(pilotId ?? ''),
    queryFn: () => getPilotById(pilotId!),
    enabled: !!pilotId,
  })
}

export function usePilotAbilityCounts(pilotIds: string[]) {
  return useQuery({
    queryKey: pilotKeys.abilityCounts(pilotIds),
    queryFn: () => listAbilityCountsByPilotIds(pilotIds),
    enabled: pilotIds.length > 0,
  })
}

export function usePilotEntityRefs(pilotId: string | undefined) {
  return useQuery({
    queryKey: pilotKeys.entityRefs(pilotId ?? ''),
    queryFn: () => getPilotEntityRefs(pilotId!),
    enabled: !!pilotId,
  })
}

export function useCreatePilot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: CreatePilotInput }) =>
      createPilot(userId, input),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.list(userId) })
    },
  })
}

export function useUpdatePilot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pilotId, input }: { pilotId: string; input: PilotUpdate; userId: string }) =>
      updatePilot(pilotId, input),
    onSuccess: (data: PilotRow, { userId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.list(userId) })
      queryClient.setQueryData(pilotKeys.detail(data.id), data)
    },
  })
}

export function useUpdateEntityRef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ refId, input }: { refId: string; input: EntityRefUpdate; pilotId: string }) =>
      updateEntityRef(refId, input),
    onSuccess: (_data, { pilotId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.entityRefs(pilotId) })
    },
  })
}

export function useDeletePilot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pilotId }: { pilotId: string; userId: string }) => deletePilot(pilotId),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.list(userId) })
    },
  })
}

export function useDeleteEntityRef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ refId }: { refId: string; pilotId: string }) => deleteEntityRef(refId),
    onSuccess: (_data, { pilotId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.entityRefs(pilotId) })
    },
  })
}

export function useCreateEntityRef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ input }: { input: EntityRefInsert; pilotId: string }) => createEntityRef(input),
    onSuccess: (_data, { pilotId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.entityRefs(pilotId) })
    },
  })
}

export function usePilotsForCrawler(crawlerId: string | undefined) {
  return useQuery({
    queryKey: pilotKeys.forCrawler(crawlerId ?? ''),
    queryFn: () => listPilotsByCrawlerId(crawlerId!),
    enabled: !!crawlerId,
  })
}

export function useAssignPilotToCrawler() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      pilotId,
      crawlerId,
    }: {
      pilotId: string
      crawlerId: string | null
      userId: string
      oldCrawlerId?: string
    }) => assignPilotToCrawler(pilotId, crawlerId),
    onSuccess: (data: PilotRow, { userId, crawlerId, oldCrawlerId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.list(userId) })
      queryClient.setQueryData(pilotKeys.detail(data.id), data)
      if (crawlerId) {
        queryClient.invalidateQueries({ queryKey: pilotKeys.forCrawler(crawlerId) })
      }
      if (oldCrawlerId) {
        queryClient.invalidateQueries({ queryKey: pilotKeys.forCrawler(oldCrawlerId) })
      }
    },
  })
}
