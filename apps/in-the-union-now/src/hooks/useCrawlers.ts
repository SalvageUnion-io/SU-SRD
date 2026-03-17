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
  saveOffloadReceipt,
  saveRestoreReceipt,
  saveTradeResult,
  saveTradeRoll,
  saveDeteriorationPending,
  saveCraftReceipt,
  saveTrainingReceipt,
  saveEquipmentReceipt,
  saveCustomiseAcknowledged,
  saveRumourReceipt,
} from '../lib/api/crawlerApi'
import type { Json } from '../types/database-generated.types'
import type { OffloadReceipt } from '../lib/tallySalvageUtils'
import type { RestoreReceipt } from '../lib/restoreUtils'
import type { TradeResult } from '../lib/tradeUtils'
import type { CraftReceipt } from '../lib/craftUtils'
import type { TrainingReceipt } from '../lib/trainingUtils'
import type { EquipmentReceipt } from '../lib/equipmentUtils'
import type { RumourReceipt } from '../lib/rumourUtils'
import type { UpkeepResult } from '../lib/deteriorationUtils'
import { useCargoQuery, useAddCargo, useDeleteCargo } from './useCargo'
import { pilotKeys } from './usePilots'
import { createEntityRef } from '../lib/api/entityRefApi'
import { gameKeys } from './useGames'
import type {
  CreateCrawlerInput,
  CrawlerRow,
  CrawlerUpdate,
  EntityRefInsert,
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
    refetchInterval: 15_000,
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

export function useCreateCrawlerEntityRef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ input }: { input: EntityRefInsert; crawlerId: string }) =>
      createEntityRef(input),
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
      input: {
        upkeep_paid?: boolean
        closed_at?: string
        upkeep_result?: Json
        restore_receipts?: Json
        trade_result?: Json
        craft_receipts?: Json
        training_receipts?: Json
        equipment_receipts?: Json
        customise_acknowledged?: Json
        rumour_receipts?: Json
        pre_session_started?: boolean
        trade_roll_key?: string | null
        trade_roll_value?: number | null
        deterioration_pending?: Json | null
      }
    }) => updateDowntimeRecord(recordId, input),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveTradeResult() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      result,
    }: {
      recordId: string
      result: TradeResult
      crawlerId: string
    }) => saveTradeResult(recordId, result),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveTradeRoll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      rollKey,
      rollValue,
    }: {
      recordId: string
      rollKey: string
      rollValue: number
      crawlerId: string
    }) => saveTradeRoll(recordId, rollKey, rollValue),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveDeteriorationPending() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, result }: { recordId: string; result: UpkeepResult; crawlerId: string }) =>
      saveDeteriorationPending(recordId, result),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveOffloadReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      pilotId,
      receipt,
    }: {
      recordId: string
      pilotId: string
      receipt: OffloadReceipt
      crawlerId: string
    }) => saveOffloadReceipt(recordId, pilotId, receipt),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveRestoreReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      pilotId,
      receipt,
    }: {
      recordId: string
      pilotId: string
      receipt: RestoreReceipt
      crawlerId: string
    }) => saveRestoreReceipt(recordId, pilotId, receipt),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveCraftReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      pilotId,
      receipt,
    }: {
      recordId: string
      pilotId: string
      receipt: CraftReceipt
      crawlerId: string
    }) => saveCraftReceipt(recordId, pilotId, receipt),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveTrainingReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      pilotId,
      receipt,
    }: {
      recordId: string
      pilotId: string
      receipt: TrainingReceipt
      crawlerId: string
    }) => saveTrainingReceipt(recordId, pilotId, receipt),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveEquipmentReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      pilotId,
      receipt,
    }: {
      recordId: string
      pilotId: string
      receipt: EquipmentReceipt
      crawlerId: string
    }) => saveEquipmentReceipt(recordId, pilotId, receipt),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveCustomiseAcknowledged() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, pilotId }: { recordId: string; pilotId: string; crawlerId: string }) =>
      saveCustomiseAcknowledged(recordId, pilotId),
    onSuccess: (_, { crawlerId }) => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.activeDowntime(crawlerId) })
    },
  })
}

export function useSaveRumourReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      pilotId,
      receipt,
    }: {
      recordId: string
      pilotId: string
      receipt: RumourReceipt
      crawlerId: string
    }) => saveRumourReceipt(recordId, pilotId, receipt),
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

export function useDeleteCrawlerCargo() {
  return useDeleteCargo((parentId) => crawlerKeys.cargo(parentId))
}
