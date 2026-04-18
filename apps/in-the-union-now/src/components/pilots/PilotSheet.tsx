import { useCallback, useMemo, useState } from 'react'
import { DisplayCard } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { findChassisById, SalvageUnionReference } from 'salvageunion-reference'
import { buildStripeStyle } from './pilotDisplayUtils'
import { PilotSheetHeader } from './_pilotSheet/PilotSheetHeader'
import { PilotSheetFooter } from './_pilotSheet/PilotSheetFooter'
import { PilotSheetBody } from './_pilotSheet/PilotSheetBody'
import { PilotSheetModals } from './_pilotSheet/PilotSheetModals'
import { buildPilotSheetStats } from './_pilotSheet/buildPilotSheetStats'
import { buildPilotSheetControls } from './_pilotSheet/buildPilotSheetControls'
import { usePilotSheetTabs } from './_pilotSheet/usePilotSheetTabs'
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

export function PilotSheet({
  pilot,
  compact = true,
  controls: controlsProp,
  abilityCount,
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
  const [showDamageModal, setShowDamageModal] = useState(false)
  const [showPushModal, setShowPushModal] = useState(false)

  const pilotClassName =
    pilotClassNameProp ?? SalvageUnionReference.get('classes', pilot.class_ref)?.name ?? 'Unknown'

  const chassisName = useMemo(() => {
    if (chassisNameProp !== undefined) return chassisNameProp
    if (!mech) return undefined
    return findChassisById(mech.chassis_ref)?.name
  }, [chassisNameProp, mech])

  const patternName =
    patternNameProp ?? (mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined)

  const canEdit = editConfig?.canEdit ?? false
  const isBoarded = pilot.is_boarded && !!mech
  const isDowntime = pilot.in_downtime && !!crawler

  const comrades = useMemo(() => comradesProp ?? [], [comradesProp])

  const controls = useMemo(
    () =>
      controlsProp ??
      buildPilotSheetControls({
        pilot,
        mech,
        isBoarded,
        editConfig,
        onOpenSettings: () => setShowSettings(true),
        onOpenDamage: () => setShowDamageModal(true),
      }),
    [controlsProp, pilot, mech, isBoarded, editConfig]
  )

  const headerStats = useMemo(
    () =>
      buildPilotSheetStats({
        pilot,
        mech,
        crawler,
        crawlerTlStats,
        isBoarded,
        isDowntime,
        canEdit,
        editConfig,
      }),
    [pilot, mech, crawler, crawlerTlStats, isBoarded, isDowntime, canEdit, editConfig]
  )

  const handleOpenPush = useCallback(() => setShowPushModal(true), [])

  const tabs = usePilotSheetTabs({
    pilot,
    pilotClass,
    pilotRefs: pilotRefs ?? [],
    mech,
    mechRefs,
    mechChassis: mechChassisProp,
    comrades,
    crawler,
    activeDowntime,
    compact,
    canEdit,
    isBoarded,
    editConfig,
    onOpenPush: handleOpenPush,
  })

  const stripeStyle = buildStripeStyle(isBoarded, pilot.in_downtime)

  return (
    <>
      <DisplayCard
        stickyHeader
        headerBg={cardColorProp ?? 'bg-su-orange'}
        bodyPadding="p-4"
        compact={compact}
        headerContent={
          <PilotSheetHeader
            pilot={pilot}
            compact={compact}
            isBoarded={isBoarded}
            isDowntime={isDowntime}
            mech={mech}
            crawler={crawler}
            chassisName={chassisName}
            patternName={patternName}
            pilotClassName={pilotClassName}
            abilityCount={abilityCount}
            canEdit={canEdit}
            editConfig={editConfig}
          />
        }
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
        footerContent={
          canEdit && editConfig ? (
            <PilotSheetFooter
              pilot={pilot}
              editConfig={editConfig}
              onDeleteClick={() => setShowDelete(true)}
            />
          ) : undefined
        }
      >
        <PilotSheetBody
          pilot={pilot}
          pilotRefs={pilotRefs ?? []}
          pilotClassAssetUrl={pilotClassAssetUrl}
          compact={compact}
          canEdit={canEdit}
          editConfig={editConfig}
        />
      </DisplayCard>

      <PilotSheetModals
        pilot={pilot}
        mech={mech}
        mechRefs={mechRefs}
        compact={compact}
        canEdit={canEdit}
        isBoarded={isBoarded}
        editConfig={editConfig}
        showDelete={showDelete}
        onDeleteOpenChange={setShowDelete}
        showSettings={showSettings}
        onSettingsOpenChange={setShowSettings}
        showDamage={showDamageModal}
        onDamageOpenChange={setShowDamageModal}
        showPush={showPushModal}
        onPushOpenChange={setShowPushModal}
      />
    </>
  )
}
