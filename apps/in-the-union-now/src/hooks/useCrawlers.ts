import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCrawler,
  deleteCrawler,
  getActiveDowntimeRecord,
  getCrawlerById,
  getCrawlerEntityRefs,
  updateCrawler,
  updateCrawlerWeapon,
  upgradeTechLevel,
  translateScrap,
  setCrawlerDowntime,
  payUpkeep,
  updateDowntimeRecord,
} from '../lib/api/crawlerApi'
import { useCargoQuery, useAddCargo, useUpdateCargo, useDeleteCargo } from './useCargo'
import { pilotKeys } from './usePilots'
import { updateEntityRef } from '../lib/api/entityRefApi'
import { gameKeys } from './useGames'
import type {
  CreateCrawlerInput,
  CrawlerRow,
  CrawlerUpdate,
  EntityRefUpdate,
} from '../types/common'

export const crawlerKeys = {
  all: ['crawlers'] as const,
  details: () => [...crawlerKeys.all, 'detail'] as const,
  detail: (id: string) => [...crawlerKeys.details(), id] as const,
  entityRefs: (crawlerId: string) => [...crawlerKeys.all, 'entityRefs', crawlerId] as const,
  cargo: (crawlerId: string) => [...crawlerKeys.all, 'cargo', crawlerId] as const,
  activeDowntime: (crawlerId: string) => [...crawlerKeys.all, 'activeDowntime', crawlerId] as const,
}

export function useCrawler(crawlerId: string | undefined) {
  return useQuery({
    queryKey: crawlerKeys.detail(crawlerId ?? ''),
    queryFn: () => getCrawlerById(crawlerId!),
    enabled: !!crawlerId,
  })
}

export function useCrawlerEntityRefs(crawlerId: string | undefined) {
  return useQuery({
    queryKey: crawlerKeys.entityRefs(crawlerId ?? ''),
    queryFn: () => getCrawlerEntityRefs(crawlerId!),
    enabled: !!crawlerId,
  })
}

export function useActiveDowntimeRecord(crawlerId: string | undefined) {
  return useQuery({
    queryKey: crawlerKeys.activeDowntime(crawlerId ?? ''),
    queryFn: () => getActiveDowntimeRecord(crawlerId!),
    enabled: !!crawlerId,
  })
}

export function useCreateCrawler() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      gameId,
      input,
    }: {
      userId: string
      gameId: string
      input: CreateCrawlerInput
    }) => createCrawler(userId, gameId, input),
    onSuccess: (_data, { gameId }) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) })
    },
  })
}

export function useDeleteCrawler() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ crawlerId, gameId }: { crawlerId: string; gameId: string }) =>
      deleteCrawler(crawlerId, gameId),
    onSuccess: (_data, { crawlerId, gameId }) => {
      queryClient.removeQueries({ queryKey: crawlerKeys.detail(crawlerId) })
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) })
    },
  })
}

export function useUpdateCrawler() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ crawlerId, input }: { crawlerId: string; input: CrawlerUpdate }) =>
      updateCrawler(crawlerId, input),
    onMutate: async ({ crawlerId, input }) => {
      await queryClient.cancelQueries({ queryKey: crawlerKeys.detail(crawlerId) })
      const previous = queryClient.getQueryData<CrawlerRow>(crawlerKeys.detail(crawlerId))
      if (previous) {
        queryClient.setQueryData(crawlerKeys.detail(crawlerId), { ...previous, ...input })
      }
      return { previous }
    },
    onError: (_err, { crawlerId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(crawlerKeys.detail(crawlerId), context.previous)
      }
    },
    onSuccess: (data: CrawlerRow) => {
      queryClient.setQueryData(crawlerKeys.detail(data.id), data)
    },
  })
}

export function useUpdateCrawlerEntityRef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ refId, input }: { refId: string; input: EntityRefUpdate; crawlerId: string }) =>
      updateEntityRef(refId, input),
    onSuccess: (_data, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.entityRefs(crawlerId) })
    },
  })
}

export function useUpdateCrawlerWeapon() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      crawlerId,
      userId,
      oldRefId,
      newRef,
      sortOrder,
    }: {
      crawlerId: string
      userId: string
      oldRefId: string | null
      newRef: { schema_name: 'systems'; schema_ref_id: string }
      sortOrder?: number
    }) => updateCrawlerWeapon(crawlerId, userId, oldRefId, newRef, sortOrder),
    onSuccess: (_data, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.entityRefs(crawlerId) })
    },
  })
}

export function useUpgradeTechLevel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ crawlerId }: { crawlerId: string }) => upgradeTechLevel(crawlerId),
    onSuccess: (data: CrawlerRow) => {
      queryClient.setQueryData(crawlerKeys.detail(data.id), data)
    },
  })
}

export function useTranslateScrap() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      crawlerId,
      fromTL,
      toTL,
      sourceConsumed,
      targetAmount,
    }: {
      crawlerId: string
      fromTL: number
      toTL: number
      sourceConsumed: number
      targetAmount: number
    }) =>
      translateScrap(
        crawlerId,
        `scrap_tl${fromTL}`,
        `scrap_tl${toTL}`,
        sourceConsumed,
        targetAmount
      ),
    onSuccess: (data: CrawlerRow) => {
      queryClient.setQueryData(crawlerKeys.detail(data.id), data)
    },
  })
}

export function useCrawlerDowntime() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      crawlerId,
      entering,
      userId,
    }: {
      crawlerId: string
      entering: boolean
      userId: string
    }) => setCrawlerDowntime(crawlerId, entering, userId),
    onSuccess: (_data, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
      queryClient.invalidateQueries({ queryKey: pilotKeys.forCrawler(crawlerId) })
    },
  })
}

export function usePayUpkeep() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      crawlerId,
      scrapDeductions,
      upgradePoolIncrease,
    }: {
      crawlerId: string
      scrapDeductions: Record<string, number>
      upgradePoolIncrease: number
    }) => payUpkeep(crawlerId, scrapDeductions, upgradePoolIncrease),
    onSuccess: (data: CrawlerRow) => {
      queryClient.setQueryData(crawlerKeys.detail(data.id), data)
    },
  })
}

export function useUpdateDowntimeRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      recordId,
      input,
    }: {
      recordId: string
      crawlerId: string
      input: { upkeep_paid?: boolean; closed_at?: string }
    }) => updateDowntimeRecord(recordId, input),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

// --- Cargo hooks (delegated to shared useCargo) ---

export function useCrawlerCargo(crawlerId: string | undefined) {
  return useCargoQuery(crawlerId, 'crawler', crawlerKeys.cargo(crawlerId ?? ''))
}

export function useAddCrawlerCargo() {
  return useAddCargo((parentId) => crawlerKeys.cargo(parentId), 'crawler')
}

export function useUpdateCrawlerCargo() {
  return useUpdateCargo((parentId) => crawlerKeys.cargo(parentId))
}

export function useDeleteCrawlerCargo() {
  return useDeleteCargo((parentId) => crawlerKeys.cargo(parentId))
}
