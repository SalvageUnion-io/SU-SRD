import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  DisplayCard,
  CardHeader,
  ValueDisplay,
  Text,
  navigateControl,
  ClassAbilityTreeDisplay,
} from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { findChassisById, findClassName } from '../../lib/entityHelpers'
import { useMech } from '../../hooks/useMechs'
import { StatControl } from '../shared/StatControl'
import { SheetFooter } from '../shared/SheetFooter'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { PilotPersonalInfo } from './PilotPersonalInfo'
import { PilotEquipmentSection } from './PilotEquipmentSection'
import { PilotMechSection } from './PilotMechSection'
import { PilotActionsSection } from './PilotActionsSection'
import { MechActionsSection } from './MechActionsSection'
import { MechLoadoutSection } from './MechLoadoutSection'
import type { PilotEditConfig } from '../../hooks/usePilotSheet'
import type { PilotRow, MechRow, EntityRefRow } from '../../types/common'
import type { SURefChassis, SURefClass } from 'salvageunion-reference'

type PlayerPilotDisplayProps = {
  pilot: PilotRow
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
  // Listing enrichment
  abilityCount?: number
  mech?: MechRow | null
  // Sheet data (only needed when !listing && !compact)
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
  editConfig?: PilotEditConfig
}

function PilotAbilityTrees({
  pilotClass,
  pilotRefs,
  compact,
}: {
  pilotClass: SURefClass
  pilotRefs: EntityRefRow[]
  compact: boolean
}) {
  const activeAbilityIds = useMemo(
    () =>
      new Set(
        pilotRefs.filter((r) => r.schema_name === 'abilities').map((r) => r.schema_ref_id)
      ),
    [pilotRefs]
  )

  return (
    <div className={compact ? 'py-3' : 'py-4'}>
      <ClassAbilityTreeDisplay classEntity={pilotClass} activeAbilityIds={activeAbilityIds} />
    </div>
  )
}

export function PlayerPilotDisplay({
  pilot,
  listing = true,
  compact = true,
  controls: controlsProp,
  abilityCount: abilityCountProp,
  mech: mechProp,
  pilotClass,
  pilotRefs,
  mechRefs,
  mechChassis: mechChassisProp,
  mechLoading,
  cardColor: cardColorProp,
  pilotClassName: pilotClassNameProp,
  pilotClassAssetUrl,
  chassisName: chassisNameProp,
  patternName: patternNameProp,
  editConfig,
}: PlayerPilotDisplayProps) {
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)

  // Listing mode: fetch mech for chassis display if not provided
  const { data: fetchedMech } = useMech(
    listing && !mechProp ? (pilot.mech_id ?? undefined) : undefined
  )
  const mech = mechProp ?? fetchedMech

  const pilotClassName = pilotClassNameProp ?? findClassName(pilot.class_ref)

  const chassisName = useMemo(() => {
    if (chassisNameProp !== undefined) return chassisNameProp
    if (!mech) return undefined
    return findChassisById(mech.chassis_ref)?.name
  }, [chassisNameProp, mech])

  const patternName =
    patternNameProp ?? (mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined)

  const handleNavigate = useCallback(() => {
    navigate({ to: '/pilots/$pilotId', params: { pilotId: pilot.id } })
  }, [navigate, pilot.id])

  const defaultControls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])
  const controls = controlsProp ?? (listing ? defaultControls : undefined)

  // --- LISTING MODE ---
  if (listing) {
    const badgeTextClass = compact
      ? 'text-xs font-normal uppercase'
      : 'text-base font-semibold uppercase'

    const headerContent = (
      <CardHeader
        title={pilot.callsign}
        subtitle={
          <div className="flex flex-wrap items-center gap-1">
            <ValueDisplay label="The" value={pilotClassName} compact={compact} />
            {compact && abilityCountProp !== undefined && (
              <ValueDisplay label="Abilities" value={abilityCountProp} compact={compact} />
            )}
            {compact && chassisName && (
              <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
                <Text
                  variant="pseudoheader"
                  as="span"
                  className={badgeTextClass}
                  style={{ backgroundColor: 'rgb(122, 151, 138)' }}
                >
                  {chassisName}
                </Text>
                {patternName && (
                  <Text variant="pseudoheader" as="span" className={badgeTextClass}>
                    {patternName}
                  </Text>
                )}
              </span>
            )}
          </div>
        }
        compact={compact}
      />
    )

    return (
      <DisplayCard
        headerBg="bg-su-orange"
        headerContent={headerContent}
        mode="listing"
        controls={controls}
      />
    )
  }

  // --- SHEET MODE ---
  const canEdit = editConfig?.canEdit ?? false
  const badgeTextClass = compact
    ? 'text-sm font-semibold uppercase'
    : 'text-base font-semibold uppercase'

  return (
    <>
      <DisplayCard
        headerBg={cardColorProp ?? 'bg-su-orange'}
        bodyPadding="p-0"
        image={{ url: pilotClassAssetUrl, alt: pilot.callsign }}
        headerContent={
          <>
            <div className="flex min-w-0 flex-col justify-center gap-0.5">
              <Text
                variant="pseudoheader"
                as="span"
                className={compact ? 'text-xl' : 'text-[1.75rem]'}
              >
                {pilot.callsign}
              </Text>
              <div className="flex flex-wrap items-center gap-1">
                <ValueDisplay label="The" value={pilotClassName} compact={compact} />
                {compact && abilityCountProp !== undefined && (
                  <ValueDisplay label="Abilities" value={abilityCountProp} compact={compact} />
                )}
                {compact && chassisName && (
                  <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
                    <Text
                      variant="pseudoheader"
                      as="span"
                      className={badgeTextClass}
                      style={{ backgroundColor: 'rgb(122, 151, 138)' }}
                    >
                      {chassisName}
                    </Text>
                    {patternName && (
                      <Text variant="pseudoheader" as="span" className={badgeTextClass}>
                        {patternName}
                      </Text>
                    )}
                    <button
                      type="button"
                      className={`cursor-pointer px-1 font-mono ${compact ? 'text-sm' : 'text-base'} font-semibold uppercase leading-none text-su-white transition-opacity hover:opacity-80`}
                      style={{ backgroundColor: 'rgb(122, 151, 138)' }}
                    >
                      Load in
                    </button>
                  </span>
                )}
              </div>
            </div>
            {editConfig && (
              <div className="flex items-center gap-1">
                <StatControl
                  label="HP"
                  value={pilot.hp}
                  max={pilot.max_hp}
                  canEdit={canEdit}
                  onChange={(v) => editConfig.onStatChange('hp', v)}
                />
                <StatControl
                  label="AP"
                  value={pilot.ap}
                  max={pilot.max_ap}
                  canEdit={canEdit}
                  onChange={(v) => editConfig.onStatChange('ap', v)}
                />
                <StatControl
                  label="TP"
                  value={pilot.tp}
                  canEdit={canEdit}
                  onChange={(v) => editConfig.onStatChange('tp', v)}
                />
              </div>
            )}
          </>
        }
        footerContent={
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
        }
      >
        <div className={compact ? 'p-3' : 'p-4'}>
          <div className={compact ? 'space-y-3' : 'space-y-4'}>
            <PilotPersonalInfo
              pilot={pilot}
              compact={compact}
              readOnly={!canEdit}
              onUpdate={editConfig?.onPilotUpdate ?? (() => {})}
            />
            <PilotMechSection
              pilot={pilot}
              compact={compact}
              readOnly={!canEdit}
              mech={mech}
              mechChassis={mechChassisProp}
              mechLoading={mechLoading ?? false}
            />
          </div>
          <div className="clear-both" />
          {pilotClass && (
            <PilotAbilityTrees
              pilotClass={pilotClass}
              pilotRefs={pilotRefs ?? []}
              compact={compact}
            />
          )}
          <div className={compact ? 'space-y-3' : 'space-y-4'}>
            <PilotEquipmentSection
              refs={pilotRefs ?? []}
              compact={compact}
              canEdit={canEdit}
              onConditionChange={(refId, condition) =>
                editConfig?.onUpdateEntityRef(refId, { condition })
              }
            />
            {mech && mechRefs && mechRefs.length > 0 && editConfig && (
              <MechLoadoutSection
                mechRefs={mechRefs}
                compact={compact}
                canEdit={canEdit}
                onConditionChange={(refId, condition) =>
                  editConfig.onUpdateMechEntityRef(refId, { condition })
                }
              />
            )}
            <PilotActionsSection
              refs={pilotRefs ?? []}
              pilot={pilot}
              compact={compact}
              readOnly={!canEdit}
              onUpdatePilot={editConfig?.onPilotUpdate ?? (() => {})}
              onUpdateEntityRef={editConfig?.onUpdateEntityRef ?? (() => {})}
            />
            {mech && mechRefs && mechRefs.length > 0 && editConfig && (
              <MechActionsSection
                mechRefs={mechRefs}
                mech={mech}
                compact={compact}
                readOnly={!canEdit}
                onUpdateMech={editConfig.onUpdateMech}
                onUpdateMechEntityRef={editConfig.onUpdateMechEntityRef}
              />
            )}
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
    </>
  )
}
