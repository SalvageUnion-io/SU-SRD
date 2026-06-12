import { useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { SURefEntity } from 'salvageunion-reference'
import {
  SalvageUnionReference,
  findCrawlerTechLevel,
  getWeaponSlotCount,
} from 'salvageunion-reference'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { useCurrentUser } from './useCurrentUser'
import { useGame, useGameMembers } from './useGames'
import {
  useCrawler,
  useCrawlerEntityRefs,
  useActiveDowntimeRecord,
  useUpdateCrawler,
  useDeleteCrawler,
  useUpdateCrawlerWeapon,
  useUpgradeTechLevel,
  useTranslateScrap,
  useCrawlerDowntime,
  crawlerKeys,
} from './useCrawlers'
import { pilotKeys } from './usePilots'
import { useSaveStatus } from './useSaveStatus'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { useActivityFeed } from './useActivityFeed'
import { isMediator } from '../lib/gameUtils'
import { getErrorMessage } from '../lib/errors'
import { changeLogApi } from '../lib/api/changeLogApi'
import type { CrawlerUpdate, EntityRefRow } from '../types/common'

export type WeaponSlot = { index: number; oldRefId: string | null }

export type CrawlerEditConfig = {
  isMed: boolean
  saveStatusText: string
  onImmediateUpdate: (input: Partial<CrawlerUpdate>) => void
  onTranslate: (fromTL: number, toTL: number, consumed: number, amount: number) => void
  onWeaponChange: (newRefId: string, slot: WeaponSlot) => void
  onDelete: () => void
  onUpgradeTL: () => void
  onToggleDowntime: () => void
  weaponSystems: { ref: EntityRefRow; entity: SURefEntity | undefined }[]
  weaponSlotCount: number
  isDeleting: boolean
  upgradePending: boolean
  translatePending: boolean
}

export function useCrawlerSheet(gameId: string) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { data: game, isLoading: gameLoading } = useGame(gameId)
  const { data: members } = useGameMembers(gameId)
  const { data: crawler, isLoading: crawlerLoading } = useCrawler(game?.crawler_id ?? undefined)
  const { data: crawlerRefs } = useCrawlerEntityRefs(crawler?.id)
  const { data: activeDowntime } = useActiveDowntimeRecord(crawler?.id)
  const updateCrawler = useUpdateCrawler()
  const deleteCrawlerMutation = useDeleteCrawler()
  const updateWeapon = useUpdateCrawlerWeapon()
  const upgradeTL = useUpgradeTechLevel()
  const translateScrap = useTranslateScrap()
  const crawlerDowntime = useCrawlerDowntime()
  const saveStatus = useSaveStatus({ isSaving: updateCrawler.isPending })

  // Activity feed: scoped to this crawler
  const crawlerId = crawler?.id
  const relevantIds = useMemo(() => {
    const ids = new Set<string>()
    if (crawlerId) ids.add(crawlerId)
    return ids
  }, [crawlerId])
  useActivityFeed(user?.id, relevantIds)

  // Realtime: sync crawler data, entity refs, cargo, and assigned pilots
  useRealtimeSubscription('crawlers', crawler ? `id=eq.${crawler.id}` : undefined, [
    crawlerKeys.detail(crawler?.id ?? ''),
  ])
  useRealtimeSubscription('entity_refs', crawler ? `parent_id=eq.${crawler.id}` : undefined, [
    crawlerKeys.entityRefs(crawler?.id ?? ''),
  ])
  useRealtimeSubscription('cargo', crawler ? `parent_id=eq.${crawler.id}` : undefined, [
    crawlerKeys.cargo(crawler?.id ?? ''),
  ])
  useRealtimeSubscription('pilots', crawler ? `crawler_id=eq.${crawler.id}` : undefined, [
    pilotKeys.forCrawler(crawler?.id ?? ''),
  ])
  useRealtimeSubscription('downtime_records', crawler ? `crawler_id=eq.${crawler.id}` : undefined, [
    crawlerKeys.activeDowntime(crawler?.id ?? ''),
  ])

  const isMed = useMemo(
    () => (members ? isMediator(members, user?.id ?? '') : false),
    [members, user?.id]
  )

  const handleImmediateUpdate = useCallback(
    (input: Partial<CrawlerUpdate>) => {
      if (!crawler || !user) return
      const crawlerLabel = crawler.name || 'Crawler'
      updateCrawler.mutate(
        { crawlerId: crawler.id, input },
        {
          onSuccess: () => {
            showSaveToast(`${crawlerLabel} updated`)
            for (const [field, newValue] of Object.entries(input)) {
              const oldValue = crawler[field as keyof typeof crawler]
              changeLogApi
                .log(user.id, {
                  targetId: crawler.id,
                  targetType: 'crawler',
                  action: 'update',
                  field,
                  oldValue: oldValue as unknown,
                  newValue,
                  description: `${crawlerLabel} ${field} ${oldValue} → ${newValue}`,
                  gameId,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, user, updateCrawler, gameId]
  )

  const handleTranslate = useCallback(
    (fromTL: number, toTL: number, sourceConsumed: number, targetAmount: number) => {
      if (!crawler || !user) return
      const crawlerLabel = crawler.name || 'Crawler'
      translateScrap.mutate(
        { crawlerId: crawler.id, fromTL, toTL, sourceConsumed, targetAmount },
        {
          onSuccess: () => {
            toast.success(`Translated ${sourceConsumed} TL${fromTL} → ${targetAmount} TL${toTL}`)
            changeLogApi
              .log(user.id, {
                targetId: crawler.id,
                targetType: 'crawler',
                action: 'update',
                field: 'scrap',
                description: `${crawlerLabel} translated ${sourceConsumed} TL${fromTL} → ${targetAmount} TL${toTL}`,
                gameId,
              })
              .catch(() => {})
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, user, translateScrap, gameId]
  )

  const handleWeaponChange = useCallback(
    (newRefId: string, slot: WeaponSlot) => {
      if (!crawler || !user) return
      const crawlerLabel = crawler.name || 'Crawler'
      const newWeapon = SalvageUnionReference.get('systems', newRefId)
      updateWeapon.mutate(
        {
          crawlerId: crawler.id,
          userId: user.id,
          oldRefId: slot.oldRefId,
          newRef: { schema_name: 'systems', schema_ref_id: newRefId },
          sortOrder: slot.index,
        },
        {
          onSuccess: () => {
            toast.success('Weapon system updated!')
            changeLogApi
              .log(user.id, {
                targetId: crawler.id,
                targetType: 'crawler',
                action: 'update',
                field: 'weapon_system',
                newValue: newRefId,
                description: `${crawlerLabel} weapon system → ${newWeapon?.name ?? newRefId}`,
                gameId,
              })
              .catch(() => {})
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, user, updateWeapon, gameId]
  )

  const handleDelete = useCallback(() => {
    if (!crawler) return
    deleteCrawlerMutation.mutate(
      { crawlerId: crawler.id, gameId },
      {
        onSuccess: () => {
          toast.success('Crawler deleted')
          navigate({ to: '/games/$gameId', params: { gameId } })
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [crawler, gameId, deleteCrawlerMutation, navigate])

  const handleUpgradeTL = useCallback(() => {
    if (!crawler || !user) return
    const crawlerLabel = crawler.name || 'Crawler'
    const oldTL = crawler.tech_level
    upgradeTL.mutate(
      { crawlerId: crawler.id },
      {
        onSuccess: (data) => {
          toast.success(`Crawler upgraded to Tech Level ${data.tech_level}!`)
          changeLogApi
            .log(user.id, {
              targetId: crawler.id,
              targetType: 'crawler',
              action: 'update',
              field: 'tech_level',
              oldValue: oldTL,
              newValue: data.tech_level,
              description: `${crawlerLabel} upgraded to Tech Level ${data.tech_level}`,
              gameId,
            })
            .catch(() => {})
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [crawler, user, upgradeTL, gameId])

  const handleToggleDowntime = useCallback(() => {
    if (!crawler || !user) return
    const entering = !activeDowntime
    const crawlerLabel = crawler.name || 'Crawler'
    crawlerDowntime.mutate(
      { crawlerId: crawler.id, entering, userId: user.id },
      {
        onSuccess: () => {
          const msg = entering
            ? `${crawlerLabel} entered downtime`
            : `${crawlerLabel} exited downtime`
          toast.success(msg)
          changeLogApi
            .log(user.id, {
              targetId: crawler.id,
              targetType: 'crawler',
              action: 'update',
              field: 'downtime',
              description: msg,
              gameId,
            })
            .catch(() => {})
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [crawler, user, activeDowntime, crawlerDowntime, gameId])

  const weaponRefs = useMemo(
    () =>
      (crawlerRefs ?? [])
        .filter((r) => r.schema_name === 'systems')
        .sort((a, b) => a.sort_order - b.sort_order),
    [crawlerRefs]
  )

  const weaponSystems = useMemo(
    () =>
      weaponRefs.map((ref) => ({
        ref,
        entity: SalvageUnionReference.get('systems', ref.schema_ref_id),
      })),
    [weaponRefs]
  )

  const weaponSlotCount = getWeaponSlotCount(crawler?.crawler_ref ?? '')

  // Derived data
  const crawlerType = crawler
    ? SalvageUnionReference.get('crawlers', crawler.crawler_ref)
    : undefined
  const techLevelData = crawler ? findCrawlerTechLevel(crawler.tech_level) : undefined
  const populationStr = techLevelData
    ? techLevelData.populationMax > 0
      ? `${techLevelData.populationMin.toLocaleString()} - ${techLevelData.populationMax.toLocaleString()}`
      : `${techLevelData.populationMin.toLocaleString()}+`
    : undefined

  const editConfig: CrawlerEditConfig = {
    isMed,
    saveStatusText: saveStatus.statusText,
    onImmediateUpdate: handleImmediateUpdate,
    onTranslate: handleTranslate,
    onWeaponChange: handleWeaponChange,
    onDelete: handleDelete,
    onUpgradeTL: handleUpgradeTL,
    onToggleDowntime: handleToggleDowntime,
    weaponSystems,
    weaponSlotCount,
    isDeleting: deleteCrawlerMutation.isPending,
    upgradePending: upgradeTL.isPending,
    translatePending: translateScrap.isPending,
  }

  return {
    game,
    crawler,
    crawlerRefs: crawlerRefs ?? [],
    isLoading: gameLoading || crawlerLoading,
    crawlerType,
    populationStr,
    weaponRefs,
    userId: user?.id,
    activeDowntime: activeDowntime ?? null,
    editConfig,
  }
}
