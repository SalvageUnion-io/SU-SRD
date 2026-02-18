import { useMemo, useCallback, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  SalvageUnionReference,
  findCrawlerTechLevel,
  getNpc,
  getWeaponSlotCount,
} from 'salvageunion-reference'
import type { SURefEntity, SURefMetaAction } from 'salvageunion-reference'
import {
  DisplayCard,
  CardHeader,
  Text,
  ValueDisplay,
  SectionSeparator,
  EntityDisplay,
  NestedActionDisplay,
  StatDisplay,
  navigateControl,
} from 'suref-react'
import type { EntityControl } from 'suref-react'
import { ArrowUp, Crosshair, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { computeCrawlerStatsFromTechLevel } from '../../../../lib/crawlerUtils'
import {
  NPC_CHOICE_ORDER,
  NPC_EDITABLE_CHOICE_TYPES,
  NPC_ROLL_TABLE_FALLBACK,
} from '../../../../lib/npcChoiceConstants'
import type { BayNpcTextField } from '../../../../lib/npcChoiceConstants'
import { StatControl } from '../../../../components/shared/StatControl'
import { toast } from 'sonner'
import { showSaveToast } from '../../../../lib/toastUtils'
import { useAuthStore } from '../../../../stores/authStore'
import { useGame, useGameMembers } from '../../../../hooks/useGames'
import {
  useCrawler,
  useCrawlerEntityRefs,
  useUpdateCrawler,
  useDeleteCrawler,
  useUpdateCrawlerWeapon,
  useUpgradeTechLevel,
  useTranslateScrap,
} from '../../../../hooks/useCrawlers'
import { usePilotsForCrawler } from '../../../../hooks/usePilots'
import { useMech } from '../../../../hooks/useMechs'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { isMediator } from '../../../../lib/gameUtils'
import { getErrorMessage } from '../../../../lib/errors'
import { SheetFooter } from '../../../../components/shared/SheetFooter'
import { PageSkeleton } from '../../../../components/shared/PageSkeleton'
import { NotFoundState } from '../../../../components/shared/NotFoundState'
import { CrawlerScrapStats } from '../../../../components/games/CrawlerStatsSection'
import { CrawlerBaysSection } from '../../../../components/games/CrawlerBaysSection'
import { CrawlerStorageSection } from '../../../../components/games/CrawlerStorageSection'
import { ScrapTranslationDialog } from '../../../../components/games/ScrapTranslationDialog'
import { WeaponSelectionDialog } from '../../../../components/games/WeaponSelectionDialog'
import { findChassisById, findClassName } from '../../../../lib/entityHelpers'
import { useRealtimeSubscription } from '../../../../hooks/useRealtimeSubscription'
import { useActivityFeed } from '../../../../hooks/useActivityFeed'
import { crawlerKeys } from '../../../../hooks/useCrawlers'
import { pilotKeys } from '../../../../hooks/usePilots'
import type { BayNpcData, CrawlerRow, CrawlerUpdate, PilotRow } from '../../../../types/common'
import { useAutosave } from '../../../../hooks/useAutosave'
import { Skeleton } from '../../../../components/ui/skeleton'
import { DeleteConfirmDialog } from '../../../../components/shared/DeleteConfirmDialog'
import { actionButtonClasses } from '../../../../components/shared/actionButtonClasses'
import { LabeledInput } from '../../../../components/shared/LabeledInput'
import { rollOnTable } from '../../../../lib/pilotUtils'

export const Route = createFileRoute('/_authenticated/games/$gameId/crawler')({
  component: CrawlerDetailPage,
})

function CrawlerDetailPage() {
  const { gameId } = Route.useParams()
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
      updateCrawler.mutate(
        { crawlerId: crawler.id, input },
        {
          onSuccess: () => showSaveToast(),
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

  const weaponSlotControls = useMemo((): EntityControl[] => {
    if (!isMed) return []
    const controls: EntityControl[] = weaponSystems.map(({ ref, entity }) => ({
      key: `weapon-${ref.sort_order}`,
      icon: Crosshair,
      onClick: () => setEditingWeaponSlot({ index: ref.sort_order, oldRefId: ref.id }),
      ariaLabel: entity?.name ?? 'Unknown weapon',
      variant: 'ghost' as const,
      hoverContent: entity ? <EntityDisplay data={entity} compact /> : undefined,
    }))
    // Add empty slot controls for remaining capacity
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

  if (gameLoading || crawlerLoading) return <PageSkeleton />
  if (!game?.crawler_id || !crawler) return <NotFoundState message="Crawler not found." />

  const crawlerType = SalvageUnionReference.get('crawlers', crawler.crawler_ref)
  const tlStats = computeCrawlerStatsFromTechLevel(crawler.tech_level, crawler.crawler_ref)
  const techLevelData = findCrawlerTechLevel(crawler.tech_level)
  const populationStr = techLevelData
    ? techLevelData.populationMax > 0
      ? `${techLevelData.populationMin.toLocaleString()} - ${techLevelData.populationMax.toLocaleString()}`
      : `${techLevelData.populationMin.toLocaleString()}+`
    : undefined

  return (
    <>
      <DisplayCard
        headerBg="bg-su-pink"
        bodyPadding="p-0"
        headerContent={
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <StatDisplay label="TL" value={crawler.tech_level} inverse />
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
                  {populationStr && <ValueDisplay label="Population" value={populationStr} />}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <StatControl
                label="Upgrade"
                bottomLabel="Pool"
                value={crawler.upgrade_pool}
                max={tlStats.upgrade_cost ?? undefined}
                canEdit={isMed}
                onChange={(v) => handleImmediateUpdate({ upgrade_pool: v })}
              />
              {isMed &&
                tlStats.upgrade_cost !== null &&
                crawler.upgrade_pool >= tlStats.upgrade_cost && (
                  <button
                    type="button"
                    onClick={handleUpgradeTL}
                    disabled={upgradeTL.isPending}
                    className="flex cursor-pointer flex-col items-center gap-0.5 rounded border border-su-green/60 bg-su-green/20 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-su-green transition-colors hover:bg-su-green/30 disabled:cursor-not-allowed disabled:opacity-50"
                    title={`Upgrade to Tech Level ${crawler.tech_level + 1}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    <span>TL Up</span>
                  </button>
                )}
              <StatDisplay
                label="Upkeep"
                value={tlStats.upkeep}
                bottomLabel={`TL${crawler.tech_level}`}
              />
              <StatControl
                label="SP"
                value={crawler.current_sp}
                max={crawler.max_sp}
                canEdit={isMed}
                onChange={(v) => handleImmediateUpdate({ current_sp: v })}
              />
            </div>
          </div>
        }
        footerContent={
          isMed ? (
            <SheetFooter
              saveStatusText={saveStatus.statusText}
              leftContent={
                <button
                  type="button"
                  onClick={() => handleImmediateUpdate({ visible: !crawler.visible })}
                  className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-su-white ${crawler.visible ? 'text-su-white' : 'text-su-white/70'}`}
                  title={crawler.visible ? 'Crawler is visible to others' : 'Crawler is hidden'}
                >
                  {crawler.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span>{crawler.visible ? 'Visible' : 'Hidden'}</span>
                </button>
              }
              rightContent={
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className={actionButtonClasses('rust')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              }
            />
          ) : undefined
        }
      >
        <div className="space-y-6 p-4">
          <CrawlerPilotsSection crawlerId={crawler.id} />

          {crawlerType && (
            <CrawlerTypeSection
              crawler={crawler}
              crawlerType={crawlerType}
              readOnly={!isMed}
              onSave={handleImmediateUpdate}
            />
          )}

          <CrawlerBaysSection
            crawler={crawler}
            readOnly={!isMed}
            onSave={handleImmediateUpdate}
            onOpenScrapConversion={() => setShowTranslateDialog(true)}
            armamentControls={weaponSlotControls}
            storageContent={(bayDamaged) => (
              <>
                <CrawlerScrapStats
                  crawler={crawler}
                  readOnly={!isMed || bayDamaged}
                  onUpdate={handleImmediateUpdate}
                />
                <SectionSeparator label="Storage" fontSize="text-xs" />
                <CrawlerStorageSection
                  crawlerId={crawler.id}
                  userId={user?.id ?? ''}
                  readOnly={!isMed || bayDamaged}
                />
              </>
            )}
          />
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
          <WeaponSelectionDialog
            open={editingWeaponSlot !== null}
            onOpenChange={(open) => {
              if (!open) setEditingWeaponSlot(null)
            }}
            onSelect={handleWeaponChange}
            techLevel={crawler.tech_level}
            currentWeaponId={
              editingWeaponSlot?.oldRefId
                ? weaponRefs.find((r) => r.id === editingWeaponSlot.oldRefId)?.schema_ref_id
                : undefined
            }
          />
          <DeleteConfirmDialog
            open={showDelete}
            onOpenChange={setShowDelete}
            entityType="Crawler"
            entityName={crawler.name || 'this crawler'}
            onConfirm={handleDelete}
            isDeleting={deleteCrawlerMutation.isPending}
          />
        </>
      )}
    </>
  )
}

function CrawlerTypeSection({
  crawler,
  crawlerType,
  readOnly,
  onSave,
}: {
  crawler: CrawlerRow
  crawlerType: SURefEntity
  readOnly: boolean
  onSave: (input: Partial<CrawlerUpdate>) => void
}) {
  const npcKey = crawler.crawler_ref
  const npc = getNpc(crawlerType as Parameters<typeof getNpc>[0])
  const hasNpc = !!npc

  const [localNpc, setLocalNpc] = useState<BayNpcData>(
    () => ((crawler.bay_npcs ?? {}) as Record<string, BayNpcData>)[npcKey] ?? {}
  )

  const { flush } = useAutosave({
    value: localNpc,
    onSave: (val) =>
      onSave({
        bay_npcs: {
          ...((crawler.bay_npcs ?? {}) as Record<string, BayNpcData>),
          [npcKey]: val,
        },
      }),
    delay: 1000,
    enabled: !readOnly && hasNpc,
  })

  const handleFieldChange = useCallback((field: BayNpcTextField, value: string) => {
    setLocalNpc((prev) => ({ ...prev, [field]: value || undefined }))
  }, [])

  const handleRoll = useCallback(
    (fieldKey: BayNpcTextField, tableName: string) => {
      const { text } = rollOnTable(tableName)
      if (text) handleFieldChange(fieldKey, text)
    },
    [handleFieldChange]
  )

  const handleHpChange = useCallback((hp: number) => {
    setLocalNpc((prev) => ({ ...prev, hp }))
  }, [])

  const editableChoices = (() => {
    if (!npc?.choices) return []
    const choices = npc.choices.filter(
      (c) => NPC_EDITABLE_CHOICE_TYPES.has(c.choiceType ?? 'freeform') && c.name !== 'Name'
    )
    return [...choices].sort((a, b) => {
      const aIdx = NPC_CHOICE_ORDER.indexOf(a.name)
      const bIdx = NPC_CHOICE_ORDER.indexOf(b.name)
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })
  })()

  const maxHp = npc?.hitPoints ?? 0
  const currentHp = localNpc.hp ?? maxHp
  const hpSlot =
    maxHp > 0 ? (
      readOnly ? (
        <Text as="span" variant="pseudoheader" className="text-sm">
          HP {currentHp}/{maxHp}
        </Text>
      ) : (
        <StatControl label="HP" value={currentHp} max={maxHp} canEdit onChange={handleHpChange} />
      )
    ) : undefined

  const npcFieldsContent =
    editableChoices.length > 0 ? (
      <div className="flex flex-col gap-2">
        {editableChoices.map((choice) => {
          const fieldKey = choice.name.toLowerCase() as BayNpcTextField
          const rollTable = choice.rollTable ?? NPC_ROLL_TABLE_FALLBACK[choice.name]

          return (
            <LabeledInput
              key={choice.id}
              label={choice.name}
              value={localNpc[fieldKey] ?? ''}
              onChange={(value) => handleFieldChange(fieldKey, value)}
              onBlur={flush}
              readOnly={readOnly}
              readOnlyValue={localNpc[fieldKey] || '-'}
              variant={choice.name === 'Description' ? 'textarea' : rollTable ? 'roll' : 'input'}
              rollTableName={rollTable}
              onRoll={rollTable ? () => handleRoll(fieldKey, rollTable) : undefined}
              placeholder={
                choice.name === 'Description'
                  ? 'Enter description...'
                  : rollTable
                    ? `Roll or type ${choice.name.toLowerCase()}...`
                    : choice.name
              }
            />
          )
        })}
      </div>
    ) : undefined

  // Build ability cards as rightContent
  const abilityContent = useMemo(() => {
    const ct = crawlerType as { actions?: string[] }
    const actions = ct.actions ?? []
    if (actions.length === 0) return undefined
    return (
      <div className="flex flex-col gap-3">
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
            <NestedActionDisplay
              key={action.id}
              data={action as SURefMetaAction}
              compact
              headerBg="bg-su-pink"
            />
          )
        })}
      </div>
    )
  }, [crawlerType])

  const npcConfig = hasNpc
    ? {
        children: npcFieldsContent,
        hpSlot,
        name: localNpc.name ?? '',
        onNameChange: (name: string) => handleFieldChange('name', name),
        onNameBlur: flush,
        readOnly,
        showNpcSeparator: true,
      }
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler Type" fontSize="text-sm" />
      <EntityDisplay
        data={crawlerType}
        compact
        npcConfig={npcConfig}
        rightContent={abilityContent}
        npcPosition="right"
        hide={{ actions: true }}
        headerColor="bg-su-pink"
      />
    </div>
  )
}

function CrawlerPilotsSection({ crawlerId }: { crawlerId: string }) {
  const { data: pilots, isLoading } = usePilotsForCrawler(crawlerId)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Pilots" fontSize="text-sm" />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
        </div>
      ) : !pilots?.length ? (
        <Text variant="default" as="p" className="text-sm text-su-white/40">
          No pilots assigned to this crawler.
        </Text>
      ) : (
        <div className="columns-1 gap-2 space-y-2 md:columns-2">
          {pilots.map((pilot) => (
            <CrawlerPilotListing key={pilot.id} pilot={pilot} />
          ))}
        </div>
      )}
    </div>
  )
}

function CrawlerPilotListing({ pilot }: { pilot: PilotRow }) {
  const navigate = useNavigate()
  const { data: mech } = useMech(pilot.mech_id ?? undefined)

  const pilotClassName = useMemo(() => {
    return findClassName(pilot.class_ref)
  }, [pilot.class_ref])

  const chassisName = useMemo(() => {
    if (!mech) return undefined
    const chassis = findChassisById(mech.chassis_ref)
    return chassis?.name
  }, [mech])

  const patternName = mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined

  const handleNavigate = useCallback(() => {
    navigate({ to: '/pilots/$pilotId', params: { pilotId: pilot.id } })
  }, [navigate, pilot.id])

  const controls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])

  const headerContent = (
    <CardHeader
      title={pilot.callsign}
      subtitle={
        <div className="flex flex-wrap items-center gap-1">
          <ValueDisplay label="The" value={pilotClassName} compact />
          {chassisName && (
            <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
              <Text
                variant="pseudoheader"
                as="span"
                className="text-xs font-normal uppercase"
                style={{ backgroundColor: 'rgb(122, 151, 138)' }}
              >
                {chassisName}
              </Text>
              {patternName && (
                <Text variant="pseudoheader" as="span" className="text-xs font-normal uppercase">
                  {patternName}
                </Text>
              )}
            </span>
          )}
        </div>
      }
      controls={controls}
      controlSize="sm"
      compact
    />
  )

  return (
    <div className="break-inside-avoid">
      <DisplayCard headerBg="bg-su-orange" headerContent={headerContent} mode="listing" />
    </div>
  )
}
