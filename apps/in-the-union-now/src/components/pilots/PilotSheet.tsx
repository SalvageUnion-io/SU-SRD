import { useState, useCallback, useMemo } from 'react'
import {
  DisplayCard,
  CardImage,
  ModalShell,
  ValueDisplay,
  StatControl,
  Text,
  ClassAbilityTreeDisplay,
} from 'suref-react'
import type { ReferenceEntityControl, DisplayCardTab, StatItem } from 'suref-react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { uploadEntityImage, deleteEntityImage } from '../../lib/api/storageApi'
import { findChassisById, SalvageUnionReference } from 'salvageunion-reference'
import { IsolatedStatValue } from '../shared/IsolatedStatValue'
import { SheetFooter } from '../shared/SheetFooter'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { ChassisBadge } from './ChassisBadge'
import { PilotPersonalInfo } from './PilotPersonalInfo'
import { PilotEquipmentSection } from './PilotEquipmentSection'
import { PilotMechTab } from './PilotMechTab'
import { ActionsSection } from './ActionsSection'
import { ComradesSection } from './ComradesSection'
import { PilotCrawlerTab } from './PilotCrawlerTab'
import { PilotDowntimeTab } from './PilotDowntimeTab'
import { buildBadgeTextClass, buildChassisBadgeProps } from './pilotDisplayUtils'
import type { ComradeEntry } from '../../lib/comradeUtils'
import type { PilotEditConfig } from '../../hooks/usePilotSheet'
import type {
  PilotRow,
  MechRow,
  CrawlerRow,
  EntityRefRow,
  DowntimeRecordRow,
} from '../../types/common'
import type { SURefChassis, SURefClass } from 'salvageunion-reference'

type PilotSheetProps = {
  pilot: PilotRow
  compact?: boolean
  controls?: ReferenceEntityControl[]
  abilityCount?: number
  mech?: MechRow | null
  pilotClass?: SURefClass
  pilotRefs?: EntityRefRow[]
  mechRefs?: EntityRefRow[]
  mechChassis?: SURefChassis
  mechLoading?: boolean
  cardColor?: string
  pilotClassName?: string
  pilotClassAssetUrl?: string
  chassisName?: string
  patternName?: string
  comrades?: ComradeEntry[]
  crawler?: CrawlerRow | null
  crawlerTlStats?: { max_sp: number; upkeep: number; upgrade_cost: number | null }
  activeDowntime?: DowntimeRecordRow | null
  editConfig?: PilotEditConfig
}

function PilotAbilityTrees({
  pilotClass,
  pilotRefs,
}: {
  pilotClass: SURefClass
  pilotRefs: EntityRefRow[]
}) {
  const activeAbilityIds = useMemo(
    () =>
      new Set(pilotRefs.filter((r) => r.schema_name === 'abilities').map((r) => r.schema_ref_id)),
    [pilotRefs]
  )

  return <ClassAbilityTreeDisplay classEntity={pilotClass} activeAbilityIds={activeAbilityIds} />
}

export function PilotSheet({
  pilot,
  compact = true,
  controls: controlsProp,
  abilityCount: abilityCountProp,
  mech,
  pilotClass,
  pilotRefs,
  mechRefs,
  mechChassis: mechChassisProp,
  cardColor: cardColorProp,
  pilotClassName: pilotClassNameProp,
  pilotClassAssetUrl,
  chassisName: chassisNameProp,
  patternName: patternNameProp,
  comrades: comradesProp,
  crawler,
  crawlerTlStats,
  activeDowntime,
  editConfig,
}: PilotSheetProps) {
  const [showDelete, setShowDelete] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [crawlerNameDraft, setCrawlerNameDraft] = useState<string | null>(null)
  const [isImageUploading, setIsImageUploading] = useState(false)

  const handleImageFileSelected = useCallback(
    async (file: File) => {
      if (!editConfig) return
      setIsImageUploading(true)
      try {
        const url = await uploadEntityImage(editConfig.userId, file)
        if (pilot.image_path) {
          deleteEntityImage(pilot.image_path)
        }
        editConfig.onPilotUpdate({ image_path: url })
      } catch (err) {
        console.error('Failed to upload image:', err)
      } finally {
        setIsImageUploading(false)
      }
    },
    [editConfig, pilot.image_path]
  )

  const handleImageRemove = useCallback(() => {
    if (!editConfig) return
    if (pilot.image_path) {
      deleteEntityImage(pilot.image_path)
    }
    editConfig.onPilotUpdate({ image_path: null })
  }, [editConfig, pilot.image_path])

  const pilotClassName =
    pilotClassNameProp ?? SalvageUnionReference.get('classes', pilot.class_ref)?.name ?? 'Unknown'

  const chassisName = useMemo(() => {
    if (chassisNameProp !== undefined) return chassisNameProp
    if (!mech) return undefined
    return findChassisById(mech.chassis_ref)?.name
  }, [chassisNameProp, mech])

  const patternName =
    patternNameProp ?? (mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined)

  const settingsControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (!editConfig) return undefined
    return {
      key: 'settings',
      label: 'Settings',
      onClick: () => setShowSettings(true),
      ariaLabel: 'Settings',
    }
  }, [editConfig])

  const boardControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (!editConfig || !mech || pilot.in_downtime) return undefined
    return {
      key: 'board',
      label: pilot.is_boarded ? 'Disembark' : 'Board',
      onClick: editConfig.onToggleBoarded,
      ariaLabel: pilot.is_boarded ? 'Disembark mech' : 'Embark mech',
      variant: pilot.is_boarded ? ('danger' as const) : ('primary' as const),
      bgColor: pilot.is_boarded ? undefined : 'var(--color-su-green)',
    }
  }, [editConfig, mech, pilot.is_boarded, pilot.in_downtime])

  const downtimeControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (!editConfig || pilot.crawler_id) return undefined
    return {
      key: 'downtime',
      label: 'Downtime',
      onClick: editConfig.onToggleDowntime,
      ariaLabel: pilot.in_downtime ? 'Exit downtime' : 'Enter downtime',
      bgColor: pilot.in_downtime ? 'var(--color-su-pink)' : undefined,
    }
  }, [editConfig, pilot.in_downtime, pilot.crawler_id])

  const controls = useMemo(() => {
    if (controlsProp) return controlsProp
    const sheetControls = [boardControl, downtimeControl, settingsControl].filter(
      Boolean
    ) as ReferenceEntityControl[]
    return sheetControls.length > 0 ? sheetControls : undefined
  }, [controlsProp, settingsControl, boardControl, downtimeControl])

  const canEdit = editConfig?.canEdit ?? false
  const isBoarded = pilot.is_boarded && !!mech
  const isDowntime = pilot.in_downtime && !!crawler

  const badgeTextClass = buildBadgeTextClass(compact)
  const chassisBadgeProps = buildChassisBadgeProps(chassisName, patternName, compact)

  // --- Header stats ---
  const headerStats: StatItem[] | undefined = useMemo(() => {
    if (!editConfig) return undefined
    if (isBoarded) {
      return [
        {
          key: 'sp',
          label: 'SP',
          value: mech.current_sp,
          outOfMax: mech.max_sp,
          onChange: (v: number) => editConfig.onUpdateMech({ current_sp: v }),
          canEdit,
        },
        { key: 'ep', label: 'EP', value: mech.current_ep, outOfMax: mech.max_ep },
        { key: 'heat', label: 'Heat', value: mech.current_heat, outOfMax: mech.heat_capacity },
      ]
    }
    if (isDowntime) {
      return [
        {
          key: 'hp',
          label: 'HP',
          value: pilot.hp,
          outOfMax: pilot.max_hp,
          onChange: (v: number) => editConfig.onStatChange('hp', v),
          canEdit,
        },
        { key: 'ap', label: 'AP', value: pilot.ap, outOfMax: pilot.max_ap },
        {
          key: 'upgrade',
          label: 'Upgrade',
          bottomLabel: 'Pool',
          value: crawler.upgrade_pool,
          outOfMax: crawlerTlStats?.upgrade_cost ?? undefined,
        },
      ]
    }
    return [
      {
        key: 'hp',
        label: 'HP',
        value: pilot.hp,
        outOfMax: pilot.max_hp,
        onChange: (v: number) => editConfig.onStatChange('hp', v),
        canEdit,
      },
      { key: 'ap', label: 'AP', value: pilot.ap, outOfMax: pilot.max_ap },
    ]
  }, [editConfig, isBoarded, isDowntime, mech, pilot, crawler, crawlerTlStats, canEdit])

  // Pilot stats box shown in header when boarded (to the left of mech stats)
  const pilotBeforeStats =
    isBoarded && editConfig ? (
      <IsolatedStatValue
        stats={[
          {
            key: 'hp',
            label: 'HP',
            value: pilot.hp,
            outOfMax: pilot.max_hp,
            canEdit,
            onChange: (v) => editConfig.onStatChange('hp', v),
          },
          { key: 'ap', label: 'AP', value: pilot.ap, outOfMax: pilot.max_ap },
        ]}
      />
    ) : undefined

  // --- Header content ---
  const headerContent = (
    <>
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        {isDowntime && editConfig ? (
          <input
            type="text"
            value={crawlerNameDraft ?? crawler.name ?? ''}
            onChange={(e) => setCrawlerNameDraft(e.target.value)}
            onBlur={() => {
              if (crawlerNameDraft !== null && crawlerNameDraft !== crawler.name) {
                editConfig.onUpdateCrawler({ name: crawlerNameDraft })
              }
              setCrawlerNameDraft(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="Name your crawler"
            className="bg-transparent font-mono text-xl font-bold uppercase text-su-white outline-none border-b border-su-white/50 placeholder:text-su-white/30"
          />
        ) : (
          <Text variant="pseudoheader" as="span" className={compact ? 'text-xl' : 'text-[1.75rem]'}>
            {isBoarded
              ? `\u201C${mech.pattern_name || chassisName || 'Mech'}\u201D`
              : pilot.callsign}
          </Text>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {isBoarded ? (
            <>
              {chassisName && (
                <ValueDisplay label="Chassis" value={chassisName} compact={compact} />
              )}
              <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
                <Text
                  variant="pseudoheader"
                  as="span"
                  className={badgeTextClass}
                  style={{ backgroundColor: 'var(--color-su-orange)' }}
                >
                  {pilotClassName}
                </Text>
                <Text variant="pseudoheaderInverse" as="span" className={badgeTextClass}>
                  {`\u201C${pilot.callsign}\u201D`}
                </Text>
              </span>
            </>
          ) : isDowntime ? (
            <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
              <Text
                variant="pseudoheader"
                as="span"
                className={badgeTextClass}
                style={{ backgroundColor: 'var(--color-su-pink)' }}
              >
                {pilotClassName}
              </Text>
              <Text variant="pseudoheaderInverse" as="span" className={badgeTextClass}>
                {`\u201C${pilot.callsign}\u201D`}
              </Text>
            </span>
          ) : (
            <>
              <ValueDisplay label="The" value={pilotClassName} compact={compact} />
              {compact && abilityCountProp !== undefined && (
                <ValueDisplay label="Abilities" value={abilityCountProp} compact={compact} />
              )}
              {chassisBadgeProps && <ChassisBadge {...chassisBadgeProps} />}
            </>
          )}
        </div>
      </div>
      {pilotBeforeStats}
    </>
  )

  // --- Comrades ---
  const comrades = useMemo(() => comradesProp ?? [], [comradesProp])

  // --- Tabs ---
  const tabs = useMemo(() => {
    const result: DisplayCardTab[] = []

    if (pilot.in_downtime) {
      result.push({
        key: 'downtime',
        label: 'Downtime',
        before: true,
        activeColor: 'rgb(206, 88, 152)',
        borderColor: 'rgb(206, 88, 152)',
        glowColor: 'rgba(206, 88, 152, 0.5)',
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <PilotDowntimeTab
              mechId={mech?.id}
              crawlerId={pilot.crawler_id ?? undefined}
              crawler={crawler}
              activeDowntime={activeDowntime}
            />
          </div>
        ),
      })
    }

    result.push({
      key: 'abilities',
      label: 'Abilities',
      activeColor: 'rgb(239, 137, 79)',
      content: pilotClass ? (
        <div className={compact ? 'p-3' : 'p-4'}>
          <IsolatedStatValue
            stats={[{ key: 'tp', label: 'TP', value: pilot.tp }]}
            className="mb-1.5 ml-auto"
          />
          <PilotAbilityTrees pilotClass={pilotClass} pilotRefs={pilotRefs ?? []} />
        </div>
      ) : null,
    })

    result.push({
      key: 'mech',
      label: 'Mech',
      activeColor: 'rgb(122, 151, 138)',
      content: (
        <PilotMechTab
          pilot={pilot}
          mech={mech}
          mechRefs={mechRefs ?? []}
          canEdit={canEdit}
          compact
        />
      ),
    })

    if (comrades.length > 0) {
      result.push({
        key: 'comrades',
        label: 'Comrades',
        activeColor: 'rgb(140, 75, 56)',
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <ComradesSection
              comrades={comrades}
              mechRefs={mechRefs ?? []}
              mechId={mech?.id}
              userId={editConfig?.userId}
              readOnly={!canEdit}
              onConditionChange={
                editConfig
                  ? (refId, condition) => editConfig.onUpdateMechEntityRef(refId, { condition })
                  : undefined
              }
              headerBgColor="color-mix(in srgb, rgb(239, 137, 79) 35%, white)"
            />
          </div>
        ),
      })
    }

    result.push({
      key: 'actions',
      label: 'Actions',
      activeColor: 'rgb(239, 137, 79)',
      content: (
        <div className={compact ? 'p-3' : 'p-4'}>
          <ActionsSection
            pilotRefs={pilotRefs ?? []}
            pilot={pilot}
            compact={compact}
            readOnly={!canEdit}
            userId={editConfig?.userId}
            onUpdatePilot={editConfig?.onPilotUpdate ?? (() => {})}
            onUpdateEntityRef={editConfig?.onUpdateEntityRef ?? (() => {})}
            mechRefs={mechRefs}
            mech={mech}
            mechChassis={mechChassisProp}
            comrades={comrades}
            onUpdateMech={editConfig?.onUpdateMech}
            onUpdateMechEntityRef={editConfig?.onUpdateMechEntityRef}
          />
        </div>
      ),
    })

    result.push({
      key: 'crawler',
      label: 'Crawler',
      activeColor: 'rgb(206, 88, 152)',
      content: (
        <div className={compact ? 'p-3' : 'p-4'}>
          <PilotCrawlerTab crawlerId={pilot.crawler_id} />
        </div>
      ),
    })

    return result
  }, [
    pilotClass,
    pilotRefs,
    compact,
    pilot,
    mech,
    mechRefs,
    canEdit,
    comrades,
    mechChassisProp,
    editConfig,
    activeDowntime,
    crawler,
  ])

  // --- Footer ---
  const footerContent =
    canEdit && editConfig ? (
      <SheetFooter
        saveStatusText={editConfig.saveStatusText}
        leftContent={
          <button
            type="button"
            onClick={editConfig.onToggleVisibility}
            className={`flex cursor-pointer items-center gap-1.5 text-xs font-semibold transition-colors hover:text-su-white ${pilot.visible ? 'text-su-white' : 'text-su-white/70'}`}
            title={pilot.visible ? 'Pilot is visible' : 'Pilot is hidden'}
          >
            {pilot.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span>{pilot.visible ? 'Visible' : 'Hidden'}</span>
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

  const stripeStyle =
    pilot.in_downtime || isBoarded
      ? {
          backgroundImage: [
            isBoarded &&
              'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(122,151,138,0.45) 10px, rgba(122,151,138,0.45) 20px)',
            pilot.in_downtime &&
              'repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(206,88,152,0.35) 10px, rgba(206,88,152,0.35) 20px)',
          ]
            .filter(Boolean)
            .join(', '),
        }
      : undefined

  return (
    <>
      <DisplayCard
        stickyHeader
        headerBg={cardColorProp ?? 'bg-su-orange'}
        bodyPadding="p-4"
        compact={compact}
        headerContent={headerContent}
        stats={headerStats}
        tabs={tabs}
        controls={controls}
        defaultTabActiveColor={isBoarded ? 'rgb(239, 137, 79)' : undefined}
        headerStyle={stripeStyle ? { style: stripeStyle } : undefined}
        footerStyle={
          stripeStyle || isBoarded
            ? {
                className: isBoarded ? 'bg-su-orange' : undefined,
                style: stripeStyle,
              }
            : undefined
        }
        footerContent={footerContent}
      >
        <div className="md:grid md:grid-cols-[auto_1fr] md:items-center p-4">
          <CardImage
            url={pilot.image_path ?? pilotClassAssetUrl}
            alt={pilot.callsign}
            compact={compact}
            editable={
              canEdit
                ? {
                    customUrl: pilot.image_path,
                    onSetCustom: (url) => {
                      if (url === null) handleImageRemove()
                    },
                    onFileSelected: handleImageFileSelected,
                    isUploading: isImageUploading,
                    removeLabel: 'Delete',
                  }
                : undefined
            }
          />
          <div className="space-y-4">
            <PilotPersonalInfo
              pilot={pilot}
              compact={compact}
              readOnly={!canEdit}
              onUpdate={editConfig?.onPilotUpdate ?? (() => {})}
            />
            <PilotEquipmentSection
              refs={pilotRefs ?? []}
              compact={compact}
              canEdit={canEdit}
              onConditionChange={(refId, condition) =>
                editConfig?.onUpdateEntityRef(refId, { condition })
              }
              onRemove={
                canEdit && editConfig ? (refId) => editConfig.onDeleteEntityRef(refId) : undefined
              }
              onAdd={
                canEdit && editConfig
                  ? (schemaRefId) => {
                      const maxSort = (pilotRefs ?? []).reduce(
                        (max, r) => Math.max(max, r.sort_order ?? 0),
                        0
                      )
                      editConfig.onCreateEntityRef({
                        parent_id: pilot.id,
                        parent_type: 'pilot',
                        schema_name: 'equipment',
                        schema_ref_id: schemaRefId,
                        sort_order: maxSort + 1,
                        condition: 'intact',
                        user_id: editConfig.userId,
                      })
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </DisplayCard>

      {editConfig && (
        <DeleteConfirmDialog
          open={showDelete}
          onOpenChange={setShowDelete}
          entityType="Pilot"
          entityName={pilot.callsign}
          onConfirm={editConfig.onDelete}
          isDeleting={editConfig.isDeleting}
        />
      )}

      {editConfig && (
        <ModalShell
          open={showSettings}
          onOpenChange={setShowSettings}
          title="Settings"
          headerBg="bg-su-grey-dark"
          maxWidth="max-w-md"
        >
          <div className={compact ? 'space-y-4 p-3' : 'space-y-5 p-4'}>
            <div>
              <Text variant="pseudoheader" as="span" className="mb-2 block text-sm uppercase">
                Pilot Stats
              </Text>
              <div className="flex flex-wrap items-start gap-3">
                <StatControl
                  label="HP"
                  value={pilot.hp}
                  max={pilot.max_hp}
                  canEdit={canEdit}
                  compact={compact}
                  onChange={(v) => editConfig.onStatChange('hp', v)}
                />
                <StatControl
                  label="Max HP"
                  value={pilot.max_hp}
                  canEdit={canEdit}
                  compact={compact}
                  onChange={(v) =>
                    editConfig.onPilotUpdate({ max_hp: v }, `${pilot.callsign} Max HP → ${v}`)
                  }
                />
                <StatControl
                  label="AP"
                  value={pilot.ap}
                  max={pilot.max_ap}
                  canEdit={canEdit}
                  compact={compact}
                  onChange={(v) => editConfig.onStatChange('ap', v)}
                />
                <StatControl
                  label="TP"
                  value={pilot.tp}
                  canEdit={canEdit}
                  compact={compact}
                  onChange={(v) => editConfig.onStatChange('tp', v)}
                />
              </div>
            </div>

            {mech && (
              <div>
                <Text variant="pseudoheader" as="span" className="mb-2 block text-sm uppercase">
                  Mech Stats
                </Text>
                <div className="flex flex-wrap items-start gap-3">
                  <StatControl
                    label="SP"
                    value={mech.current_sp}
                    max={mech.max_sp}
                    canEdit={canEdit}
                    compact={compact}
                    onChange={(v) => editConfig.onUpdateMech({ current_sp: v })}
                  />
                  <StatControl
                    label="EP"
                    value={mech.current_ep}
                    max={mech.max_ep}
                    canEdit={canEdit}
                    compact={compact}
                    onChange={(v) => editConfig.onUpdateMech({ current_ep: v })}
                  />
                </div>
              </div>
            )}

            {!pilot.crawler_id && (
              <div>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-su-black bg-su-pink px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-su-pink/80"
                  onClick={editConfig.onToggleDowntime}
                >
                  {pilot.in_downtime ? 'Exit Downtime' : 'Trigger Downtime'}
                </button>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </>
  )
}
