import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCrawler,
  getCrawlerById,
  getCrawlerEntityRefs,
  updateCrawler,
  updateCrawlerWeapon,
  translateScrap,
  listCargoForCrawler,
  addCargoToCrawler,
  updateCargoItem,
  deleteCargoItem,
} from '../lib/api/crawlerApi'
import { updateEntityRef } from '../lib/api/pilotApi'
import { gameKeys } from './useGames'
import type { CreateCrawlerInput, CrawlerRow, CrawlerUpdate, EntityRefUpdate } from '../types/common'

export const crawlerKeys = {
  all: ['crawlers'] as const,
  details: () => [...crawlerKeys.all, 'detail'] as const,
  detail: (id: string) => [...crawlerKeys.details(), id] as const,
  entityRefs: (crawlerId: string) => [...crawlerKeys.all, 'entityRefs', crawlerId] as const,
  cargo: (crawlerId: string) => [...crawlerKeys.all, 'cargo', crawlerId] as const,
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

export function useUpdateCrawler() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ crawlerId, input }: { crawlerId: string; input: CrawlerUpdate }) =>
      updateCrawler(crawlerId, input),
    onSuccess: (data: CrawlerRow) => {
      queryClient.setQueryData(crawlerKeys.detail(data.id), data)
    },
  })
}

export function useUpdateCrawlerEntityRef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      refId,
      input,
    }: {
      refId: string
      input: EntityRefUpdate
      crawlerId: string
    }) => updateEntityRef(refId, input),
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

export function useCrawlerCargo(crawlerId: string | undefined) {
  return useQuery({
    queryKey: crawlerKeys.cargo(crawlerId ?? ''),
    queryFn: () => listCargoForCrawler(crawlerId!),
    enabled: !!crawlerId,
  })
}

export function useAddCrawlerCargo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      crawlerId,
      userId,
      input,
    }: {
      crawlerId: string
      userId: string
      input: { name: string; amount?: number; schema_name?: string; schema_ref_id?: string; metadata?: Record<string, unknown> }
    }) => addCargoToCrawler(crawlerId, userId, input),
    onSuccess: (_data, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.cargo(crawlerId) })
    },
  })
}

export function useUpdateCrawlerCargo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      cargoId,
      input,
    }: {
      cargoId: string
      crawlerId: string
      input: { name?: string; amount?: number }
    }) => updateCargoItem(cargoId, input),
    onSuccess: (_data, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.cargo(crawlerId) })
    },
  })
}

export function useDeleteCrawlerCargo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cargoId }: { cargoId: string; crawlerId: string }) => deleteCargoItem(cargoId),
    onSuccess: (_data, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.cargo(crawlerId) })
    },
  })
}
