import { useMemo, useCallback, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference, findCrawlerTechLevel, getNpc } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import {
  DisplayCard,
  Text,
  ValueDisplay,
  SectionSeparator,
  EntityDisplay,
  EntityNpcDisplay,
  StatDisplay,
  editControl,
  useDetailModal,
  getEntityFontSizes,
  getEntitySpacing,
} from 'suref-react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { getWeaponSlotCount, computeCrawlerStatsFromTechLevel } from '../../../../lib/crawlerUtils'
import { CrawlerStatControl } from '../../../../components/games/CrawlerStatControl'
import { toast } from 'sonner'
import { useAuthStore } from '../../../../stores/authStore'
import { useGame, useGameMembers } from '../../../../hooks/useGames'
import {
  useCrawler,
  useCrawlerEntityRefs,
  useUpdateCrawler,
  useDeleteCrawler,
  useUpdateCrawlerWeapon,
  useTranslateScrap,
} from '../../../../hooks/useCrawlers'
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
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../../../../types/common'
import { useAutosave } from '../../../../hooks/useAutosave'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { Input } from '../../../../components/ui/input'
import { Textarea } from '../../../../components/ui/textarea'
import { RollInput } from '../../../../components/shared/RollInput'
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
  const translateScrap = useTranslateScrap()
  const saveStatus = useSaveStatus({ isSaving: updateCrawler.isPending })

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
              <CrawlerStatControl
                label="Upgrade"
                bottomLabel="Pool"
                value={crawler.upgrade_pool}
                max={tlStats.upgrade_cost ?? undefined}
                canEdit={isMed}
                onChange={(v) => handleImmediateUpdate({ upgrade_pool: v })}
              />
              <StatDisplay
                label="Upkeep"
                value={tlStats.upkeep}
                bottomLabel={`TL${crawler.tech_level}`}
              />
              <CrawlerStatControl
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
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-su-white/70 transition-colors hover:text-su-rust"
                  title="Delete crawler"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              }
            />
          ) : undefined
        }
      >
        <div className="space-y-6 p-4">
          {crawlerType && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {'actions' in crawlerType &&
                (crawlerType as { actions?: string[] }).actions && (
                  <CrawlerAbilitySection
                    crawlerType={crawlerType as { name: string; actions?: string[] }}
                  />
                )}
              {'npc' in crawlerType && !!(crawlerType as { npc?: unknown }).npc && (
                <CrawlerTypeNpcSection
                  crawler={crawler}
                  crawlerTypeEntity={crawlerType as unknown as SURefEntity}
                  readOnly={!isMed}
                  onSave={handleImmediateUpdate}
                />
              )}
            </div>
          )}

          <CrawlerBaysSection
            crawler={crawler}
            readOnly={!isMed}
            onSave={handleImmediateUpdate}
            onOpenScrapConversion={() => setShowTranslateDialog(true)}
            armamentContent={(bayDamaged) => (
              <div className="flex flex-col gap-2">
                <SectionSeparator label="Weapon Systems" fontSize="text-xs" />
                {weaponSystems.map(({ ref, entity }) =>
                  entity ? (
                    <WeaponListing
                      key={ref.id}
                      entity={entity}
                      damaged={bayDamaged}
                      onEdit={
                        isMed && !bayDamaged
                          ? () =>
                              setEditingWeaponSlot({
                                index: ref.sort_order,
                                oldRefId: ref.id,
                              })
                          : undefined
                      }
                    />
                  ) : (
                    <Text
                      key={ref.id}
                      variant="default"
                      as="p"
                      className="text-sm text-su-white/40"
                    >
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
                    onClick={() =>
                      setEditingWeaponSlot({ index: weaponRefs.length, oldRefId: null })
                    }
                    disabled={bayDamaged}
                    className="flex cursor-pointer items-center gap-1.5 self-start rounded-md border border-su-green/30 px-3 py-1.5 font-mono text-xs font-semibold text-su-green transition-colors hover:border-su-green/60 hover:bg-su-green/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                    Add weapon system
                  </button>
                )}
              </div>
            )}
            storageContent={(bayDamaged) => (
              <div className="flex flex-col gap-6">
                <CrawlerScrapStats
                  crawler={crawler}
                  readOnly={!isMed || bayDamaged}
                  onUpdate={handleImmediateUpdate}
                />
                <div className="flex flex-col gap-2">
                  <SectionSeparator label="Storage" fontSize="text-xs" />
                  <CrawlerStorageSection crawlerId={crawler.id} userId={user?.id ?? ''} readOnly={!isMed || bayDamaged} />
                </div>
              </div>
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
          <Dialog open={showDelete} onOpenChange={setShowDelete}>
            <DialogContent className="bg-su-dark sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-su-orange">Delete Crawler</DialogTitle>
                <DialogDescription className="text-su-grey-dark">
                  Are you sure you want to delete{' '}
                  <strong className="text-su-white">
                    {crawler.name || 'this crawler'}
                  </strong>
                  ? This will remove all associated data. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDelete(false)}
                  disabled={deleteCrawlerMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteCrawlerMutation.isPending}
                >
                  {deleteCrawlerMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  )
}

function WeaponListing({
  entity,
  onEdit,
  damaged,
}: {
  entity: SURefEntity
  onEdit?: () => void
  damaged?: boolean
}) {
  const detailModal = useDetailModal(entity)
  const controls = [
    ...(onEdit ? [editControl(onEdit)] : []),
    detailModal.control,
  ]

  return (
    <>
      <EntityDisplay data={entity} listing compact controls={controls} damaged={damaged} disabled={damaged} />
      {detailModal.modal}
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
          <EntityDisplay key={action.id} data={action as unknown as SURefEntity} compact />
        )
      })}
    </div>
  )
}

type BayNpcTextField = 'name' | 'background' | 'motto' | 'keepsake' | 'personality'

const NPC_CHOICE_ORDER = ['Name', 'Description', 'Motto', 'Keepsake', 'A.I. Personality']

const NPC_ROLL_TABLE_FALLBACK: Record<string, string> = {
  Motto: 'Motto',
  Keepsake: 'Keepsake',
}

const NPC_EDITABLE_CHOICE_TYPES = new Set(['freeform', 'permanent'])

function CrawlerTypeNpcSection({
  crawler,
  crawlerTypeEntity,
  readOnly,
  onSave,
}: {
  crawler: CrawlerRow
  crawlerTypeEntity: SURefEntity
  readOnly: boolean
  onSave: (input: Partial<CrawlerUpdate>) => void
}) {
  const npcKey = crawler.crawler_ref
  const npc = getNpc(crawlerTypeEntity as Parameters<typeof getNpc>[0])

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
    enabled: !readOnly,
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

  const editableChoices = useMemo(() => {
    const choices = npc?.choices?.filter((c) =>
      NPC_EDITABLE_CHOICE_TYPES.has(c.choiceType ?? 'freeform')
    ) ?? []
    return [...choices].sort((a, b) => {
      const aIdx = NPC_CHOICE_ORDER.indexOf(a.name)
      const bIdx = NPC_CHOICE_ORDER.indexOf(b.name)
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })
  }, [npc?.choices])

  const fontSize = getEntityFontSizes(true)
  const spacing = getEntitySpacing(true)

  const maxHp = npc?.hitPoints ?? 0
  const currentHp = localNpc.hp ?? maxHp
  const hpSlot =
    maxHp > 0 ? (
      readOnly ? (
        <Text as="span" variant="pseudoheader" className="text-sm">
          HP {currentHp}/{maxHp}
        </Text>
      ) : (
        <CrawlerStatControl
          label="HP"
          value={currentHp}
          max={maxHp}
          canEdit
          onChange={handleHpChange}
        />
      )
    ) : undefined

  const npcFieldsContent =
    editableChoices.length > 0 ? (
      <div className="flex flex-col gap-2">
        {editableChoices.map((choice) => {
          const fieldKey = choice.name.toLowerCase() as BayNpcTextField
          const rollTable =
            choice.rollTable ?? NPC_ROLL_TABLE_FALLBACK[choice.name]

          return (
            <div key={choice.id} className="flex flex-col gap-0.5">
              <Text
                variant="pseudoheader"
                as="label"
                className="ml-0.5 text-xs uppercase"
              >
                {choice.name}
              </Text>
              {readOnly ? (
                <Text variant="default" as="span" className="text-sm">
                  {localNpc[fieldKey] || '-'}
                </Text>
              ) : choice.name === 'Description' ? (
                <Textarea
                  value={localNpc[fieldKey] ?? ''}
                  onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                  onBlur={flush}
                  placeholder="Enter description..."
                  className="min-h-[60px] text-sm"
                  rows={2}
                />
              ) : rollTable ? (
                <RollInput
                  value={localNpc[fieldKey] ?? ''}
                  onChange={(value) => handleFieldChange(fieldKey, value)}
                  onRoll={() => handleRoll(fieldKey, rollTable)}
                  onBlur={flush}
                  placeholder={`Roll or type ${choice.name.toLowerCase()}...`}
                  rollTableName={rollTable}
                />
              ) : (
                <Input
                  value={localNpc[fieldKey] ?? ''}
                  onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                  onBlur={flush}
                  placeholder={choice.name}
                  className="h-8 text-sm"
                />
              )}
            </div>
          )
        })}
      </div>
    ) : undefined

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler NPC" fontSize="text-sm" />
      <EntityNpcDisplay
        data={crawlerTypeEntity as Parameters<typeof getNpc>[0]}
        compact
        fontSize={fontSize}
        spacing={spacing}
        npcChildren={npcFieldsContent}
        hpSlot={hpSlot}
      />
    </div>
  )
}
