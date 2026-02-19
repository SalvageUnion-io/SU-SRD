import { useMemo, useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  SalvageUnionReference,
  findCrawlerTechLevel,
  getWeaponSlotCount,
} from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { Crosshair, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { useAuthStore } from '../stores/authStore'
import { useGame, useGameMembers } from './useGames'
import {
  useCrawler,
  useCrawlerEntityRefs,
  useUpdateCrawler,
  useDeleteCrawler,
  useUpdateCrawlerWeapon,
  useUpgradeTechLevel,
  useTranslateScrap,
  crawlerKeys,
} from './useCrawlers'
import { pilotKeys } from './usePilots'
import { useSaveStatus } from './useSaveStatus'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { useActivityFeed } from './useActivityFeed'
import { isMediator } from '../lib/gameUtils'
import { getErrorMessage } from '../lib/errors'
import { computeCrawlerStatsFromTechLevel } from '../lib/crawlerUtils'
import type { CrawlerUpdate } from '../types/common'

export type CrawlerEditConfig = {
  isMed: boolean
  saveStatusText: string
  onImmediateUpdate: (input: Partial<CrawlerUpdate>) => void
  onTranslate: (fromTL: number, toTL: number, consumed: number, amount: number) => void
  onWeaponChange: (newRefId: string) => void
  onDelete: () => void
  onUpgradeTL: () => void
  weaponSlotControls: ReferenceEntityControl[]
  showTranslateDialog: boolean
  setShowTranslateDialog: (v: boolean) => void
  editingWeaponSlot: { index: number; oldRefId: string | null } | null
  setEditingWeaponSlot: (v: { index: number; oldRefId: string | null } | null) => void
  showDelete: boolean
  setShowDelete: (v: boolean) => void
  isDeleting: boolean
  upgradePending: boolean
  translatePending: boolean
}

export function useCrawlerSheet(gameId: string) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: game, isLoading: gameLoading } = useGame(gameId)
  const { data: members } = useGameMembers(gameId)
  const { data: crawler, isLoading: crawlerLoading } = useCrawler(game?.crawler_id ?? undefined)
  const { data: crawlerRefs } = useCrawlerEntityRefs(crawler?.id)
  const updateCrawler = useUpdateCrawler()
  const deleteCrawlerMutation = useDeleteCrawler()
  const updateWeapon = useUpdateCrawlerWeapon()
  const upgradeTL = useUpgradeTechLevel()
  const translateScrap = useTranslateScrap()
  const saveStatus = useSaveStatus({ isSaving: updateCrawler.isPending })

  // Activity feed: toast notifications for other users' actions
  useActivityFeed(user?.id)

  // Realtime: sync crawler data, entity refs, cargo, and assigned pilots
  useRealtimeSubscription('crawlers', crawler ? `id=eq.${crawler.id}` : undefined, [
    crawlerKeys.detail(crawler?.id ?? ''),
  ])
  useRealtimeSubscription('entity_refs', crawler ? `parent_id=eq.${crawler.id}` : undefined, [
    crawlerKeys.entityRefs(crawler?.id ?? ''),
  ])
  useRealtimeSubscription('cargo', crawler ? `crawler_id=eq.${crawler.id}` : undefined, [
    crawlerKeys.cargo(crawler?.id ?? ''),
  ])
  useRealtimeSubscription('pilots', crawler ? `crawler_id=eq.${crawler.id}` : undefined, [
    pilotKeys.forCrawler(crawler?.id ?? ''),
  ])

  const [showDelete, setShowDelete] = useState(false)
  const [showTranslateDialog, setShowTranslateDialog] = useState(false)
  const [editingWeaponSlot, setEditingWeaponSlot] = useState<{
    index: number
    oldRefId: string | null
  } | null>(null)

  const isMed = useMemo(
    () => (members ? isMediator(members, user?.id ?? '') : false),
    [members, user?.id]
  )

  const handleImmediateUpdate = useCallback(
    (input: Partial<CrawlerUpdate>) => {
      if (!crawler) return
      const crawlerLabel = crawler.name || 'Crawler'
      updateCrawler.mutate(
        { crawlerId: crawler.id, input },
        {
          onSuccess: () => showSaveToast(`${crawlerLabel} updated`),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, updateCrawler]
  )

  const handleTranslate = useCallback(
    (fromTL: number, toTL: number, sourceConsumed: number, targetAmount: number) => {
      if (!crawler) return
      translateScrap.mutate(
        { crawlerId: crawler.id, fromTL, toTL, sourceConsumed, targetAmount },
        {
          onSuccess: () => {
            toast.success(`Translated ${sourceConsumed} TL${fromTL} → ${targetAmount} TL${toTL}`)
            setShowTranslateDialog(false)
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, translateScrap]
  )

  const handleWeaponChange = useCallback(
    (newRefId: string) => {
      if (!crawler || !user || !editingWeaponSlot) return
      updateWeapon.mutate(
        {
          crawlerId: crawler.id,
          userId: user.id,
          oldRefId: editingWeaponSlot.oldRefId,
          newRef: { schema_name: 'systems', schema_ref_id: newRefId },
          sortOrder: editingWeaponSlot.index,
        },
        {
          onSuccess: () => {
            toast.success('Weapon system updated!')
            setEditingWeaponSlot(null)
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, user, editingWeaponSlot, updateWeapon]
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
    if (!crawler) return
    upgradeTL.mutate(
      { crawlerId: crawler.id },
      {
        onSuccess: (data) => {
          toast.success(`Crawler upgraded to Tech Level ${data.tech_level}!`)
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [crawler, upgradeTL])

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

  const weaponSlotControls = useMemo((): ReferenceEntityControl[] => {
    if (!isMed) return []
    const controls: ReferenceEntityControl[] = weaponSystems.map(({ ref, entity }) => ({
      key: `weapon-${ref.sort_order}`,
      icon: Crosshair,
      onClick: () => setEditingWeaponSlot({ index: ref.sort_order, oldRefId: ref.id }),
      ariaLabel: entity?.name ?? 'Unknown weapon',
      variant: 'ghost' as const,
      hoverContent: entity ? <ReferenceEntityDisplay data={entity} compact /> : undefined,
    }))
    for (let i = weaponRefs.length; i < weaponSlotCount; i++) {
      controls.push({
        key: `weapon-empty-${i}`,
        icon: Plus,
        onClick: () => setEditingWeaponSlot({ index: i, oldRefId: null }),
        ariaLabel: 'Add weapon system',
        variant: 'primary' as const,
      })
    }
    return controls
  }, [isMed, weaponSystems, weaponRefs.length, weaponSlotCount])

  // Derived data
  const crawlerType = crawler
    ? SalvageUnionReference.get('crawlers', crawler.crawler_ref)
    : undefined
  const tlStats = crawler
    ? computeCrawlerStatsFromTechLevel(crawler.tech_level, crawler.crawler_ref)
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
    weaponSlotControls,
    showTranslateDialog,
    setShowTranslateDialog,
    editingWeaponSlot,
    setEditingWeaponSlot,
    showDelete,
    setShowDelete,
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
    tlStats,
    populationStr,
    weaponRefs,
    userId: user?.id,
    editConfig,
  }
}
