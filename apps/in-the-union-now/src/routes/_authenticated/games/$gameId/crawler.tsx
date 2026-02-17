import { useMemo, useCallback, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { DisplayCard, Text, ValueDisplay, SectionSeparator, EntityDisplay } from 'suref-react'
import { Pencil, Plus, RefreshCw } from 'lucide-react'
import { getWeaponSlotCount } from '../../../../lib/crawlerUtils'
import { toast } from 'sonner'
import { useAuthStore } from '../../../../stores/authStore'
import { useGame, useGameMembers } from '../../../../hooks/useGames'
import {
  useCrawler,
  useCrawlerEntityRefs,
  useUpdateCrawler,
  useUpdateCrawlerWeapon,
  useTranslateScrap,
} from '../../../../hooks/useCrawlers'
import { useAutosave } from '../../../../hooks/useAutosave'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { isMediator } from '../../../../lib/gameUtils'
import { getErrorMessage } from '../../../../lib/errors'
import { PageSkeleton } from '../../../../components/shared/PageSkeleton'
import { NotFoundState } from '../../../../components/shared/NotFoundState'
import { CrawlerStatsSection } from '../../../../components/games/CrawlerStatsSection'
import { CrawlerBaysSection } from '../../../../components/games/CrawlerBaysSection'
import { CrawlerStorageSection } from '../../../../components/games/CrawlerStorageSection'
import { ScrapTranslationDialog } from '../../../../components/games/ScrapTranslationDialog'
import { CrawlerEditDialog } from '../../../../components/games/CrawlerEditDialog'
import { WeaponSelectionDialog } from '../../../../components/games/WeaponSelectionDialog'
import type { CrawlerUpdate } from '../../../../types/common'

export const Route = createFileRoute('/_authenticated/games/$gameId/crawler')({
  component: CrawlerDetailPage,
})

function CrawlerDetailPage() {
  const { gameId } = Route.useParams()
  const user = useAuthStore((s) => s.user)
  const { data: game, isLoading: gameLoading } = useGame(gameId)
  const { data: members } = useGameMembers(gameId)
  const { data: crawler, isLoading: crawlerLoading } = useCrawler(game?.crawler_id ?? undefined)
  const { data: crawlerRefs } = useCrawlerEntityRefs(crawler?.id)
  const updateCrawler = useUpdateCrawler()
  const updateWeapon = useUpdateCrawlerWeapon()
  const translateScrap = useTranslateScrap()
  const saveStatus = useSaveStatus({ isSaving: updateCrawler.isPending })

  const [showTranslateDialog, setShowTranslateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingWeaponSlot, setEditingWeaponSlot] = useState<{
    index: number
    oldRefId: string | null
  } | null>(null)

  // Pending update accumulator for autosave
  const [pendingUpdates, setPendingUpdates] = useState<Partial<CrawlerUpdate>>({})

  const isMed = useMemo(
    () => (members ? isMediator(members, user?.id ?? '') : false),
    [members, user?.id]
  )

  const handleUpdate = useCallback(
    (input: Partial<CrawlerUpdate>) => {
      if (!crawler) return
      setPendingUpdates((prev) => ({ ...prev, ...input }))
    },
    [crawler]
  )

  const handleSave = useCallback(
    (updates: Partial<CrawlerUpdate>) => {
      if (!crawler) return
      updateCrawler.mutate(
        { crawlerId: crawler.id, input: updates },
        {
          onSuccess: () => toast.success('Saved', { id: 'autosave', duration: 1500 }),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, updateCrawler]
  )

  const handleImmediateUpdate = useCallback(
    (input: Partial<CrawlerUpdate>) => {
      if (!crawler) return
      updateCrawler.mutate(
        { crawlerId: crawler.id, input },
        {
          onSuccess: () => toast.success('Saved', { id: 'autosave', duration: 1500 }),
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

  const handleEditSave = useCallback(
    (input: Partial<CrawlerUpdate>) => {
      if (!crawler) return
      updateCrawler.mutate(
        { crawlerId: crawler.id, input },
        {
          onSuccess: () => {
            toast.success('Crawler updated!')
            setShowEditDialog(false)
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler, updateCrawler]
  )

  // Autosave bay NPC changes (debounced)
  useAutosave({
    value: pendingUpdates,
    onSave: (val) => {
      if (Object.keys(val).length > 0) {
        handleSave(val)
        setPendingUpdates({})
      }
    },
    delay: 1500,
    enabled: !!crawler && isMed,
  })

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

  if (gameLoading || crawlerLoading) return <PageSkeleton />
  if (!game?.crawler_id || !crawler) return <NotFoundState message="Crawler not found." />

  const crawlerType = SalvageUnionReference.get('crawlers', crawler.crawler_ref)
  const weaponSlotCount = getWeaponSlotCount(crawler.crawler_ref)

  return (
    <>
      <DisplayCard
        headerBg="bg-su-pink"
        bodyPadding="p-0"
        headerContent={
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col justify-center gap-0.5">
              <div className="flex items-center gap-2">
                <Text variant="pseudoheader" as="span" className="text-[1.75rem]">
                  {crawler.name || 'Unnamed Crawler'}
                </Text>
                {crawler.tag && (
                  <Text variant="pseudoheader" as="span" className="text-lg opacity-70">
                    #{crawler.tag}
                  </Text>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {crawlerType && <ValueDisplay label="Type" value={crawlerType.name} />}
                <ValueDisplay label="SP" value={`${crawler.current_sp}/${crawler.max_sp}`} />
                <ValueDisplay label="TL" value={crawler.tech_level} />
              </div>
            </div>
            {isMed && (
              <button
                type="button"
                onClick={() => setShowEditDialog(true)}
                className="mt-1 flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-su-black/60 transition-colors hover:bg-su-black/20 hover:text-su-black"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
          </div>
        }
        footerContent={
          saveStatus.statusText ? (
            <div className="flex w-full items-center justify-end px-2 py-1">
              <span className="font-mono text-xs text-su-white/70">{saveStatus.statusText}</span>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-6 p-4">
          <CrawlerStatsSection
            crawler={crawler}
            readOnly={!isMed}
            onUpdate={handleImmediateUpdate}
          />

          {isMed && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowTranslateDialog(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-su-grey-light/20 px-3 py-1.5 font-mono text-xs font-semibold uppercase text-su-white/60 transition-colors hover:border-su-pink/50 hover:text-su-pink"
              >
                <RefreshCw className="h-3 w-3" />
                Translate Scrap
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <SectionSeparator
              label={`Weapon Systems (${weaponRefs.length}/${weaponSlotCount})`}
              fontSize="text-sm"
            />
            {weaponSystems.map(({ ref, entity }) =>
              entity ? (
                <div key={ref.id} className="relative">
                  <EntityDisplay data={entity} listing compact />
                  {isMed && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingWeaponSlot({ index: ref.sort_order, oldRefId: ref.id })
                      }
                      className="absolute top-2 right-2 flex cursor-pointer items-center gap-1 rounded bg-su-grey-dark/80 px-2 py-1 text-xs text-su-white/60 transition-colors hover:text-su-white"
                    >
                      <Pencil className="h-3 w-3" />
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <Text key={ref.id} variant="default" as="p" className="text-sm text-su-white/40">
                  Unknown system
                </Text>
              )
            )}
            {weaponRefs.length === 0 && (
              <Text variant="default" as="p" className="text-sm text-su-white/40">
                No weapon systems equipped.
              </Text>
            )}
            {isMed && weaponRefs.length < weaponSlotCount && (
              <button
                type="button"
                onClick={() => setEditingWeaponSlot({ index: weaponRefs.length, oldRefId: null })}
                className="flex cursor-pointer items-center gap-1.5 self-start rounded-md border border-su-green/30 px-3 py-1.5 font-mono text-xs font-semibold text-su-green transition-colors hover:border-su-green/60 hover:bg-su-green/10"
              >
                <Plus className="h-3 w-3" />
                Add weapon system
              </button>
            )}
          </div>

          {crawlerType &&
            'actions' in crawlerType &&
            (crawlerType as { actions?: string[] }).actions && (
              <CrawlerAbilitySection
                crawlerType={crawlerType as { name: string; actions?: string[] }}
              />
            )}

          <CrawlerBaysSection
            crawler={crawler}
            readOnly={!isMed}
            onUpdate={(input) => {
              handleUpdate(input)
              if (input.bay_npcs) {
                handleSave(input)
              }
            }}
          />

          <CrawlerStorageSection crawlerId={crawler.id} userId={user?.id ?? ''} readOnly={!isMed} />
        </div>
      </DisplayCard>

      {crawler && (
        <>
          <ScrapTranslationDialog
            open={showTranslateDialog}
            onOpenChange={setShowTranslateDialog}
            crawler={crawler}
            onTranslate={handleTranslate}
            isPending={translateScrap.isPending}
          />
          <CrawlerEditDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            crawler={crawler}
            onSave={handleEditSave}
            isPending={updateCrawler.isPending}
          />
          <WeaponSelectionDialog
            open={editingWeaponSlot !== null}
            onOpenChange={(open) => {
              if (!open) setEditingWeaponSlot(null)
            }}
            onSelect={handleWeaponChange}
            currentWeaponId={
              editingWeaponSlot?.oldRefId
                ? weaponRefs.find((r) => r.id === editingWeaponSlot.oldRefId)?.schema_ref_id
                : undefined
            }
          />
        </>
      )}
    </>
  )
}

function CrawlerAbilitySection({
  crawlerType,
}: {
  crawlerType: { name: string; actions?: string[] }
}) {
  const actions = crawlerType.actions ?? []

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler Ability" fontSize="text-sm" />
      {actions.map((actionName) => {
        const action = SalvageUnionReference.Actions.find((a) => a.name === actionName)
        if (!action) {
          return (
            <Text key={actionName} variant="default" className="text-sm text-su-white/60">
              {actionName}
            </Text>
          )
        }
        return (
          <EntityDisplay key={action.id} data={action as unknown as SURefEntity} listing compact />
        )
      })}
    </div>
  )
}
