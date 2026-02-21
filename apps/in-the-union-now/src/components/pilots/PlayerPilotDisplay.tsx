import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  DisplayCard,
  CardHeader,
  ValueDisplay,
  StatControl,
  Text,
  navigateControl,
  ClassAbilityTreeDisplay,
} from 'suref-react'
import type { ReferenceEntityControl, DisplayCardTab, StatItem } from 'suref-react'
import { Eye, EyeOff, LogIn, LogOut, Settings, Tent, Trash2 } from 'lucide-react'
import { findChassisById, findClassName } from '../../lib/entityHelpers'
import { IsolatedStatValue } from '../shared/IsolatedStatValue'
import { SheetFooter } from '../shared/SheetFooter'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { ModalShell } from '../shared/ModalShell'
import { PilotPersonalInfo } from './PilotPersonalInfo'
import { PilotEquipmentSection } from './PilotEquipmentSection'
import { PilotMechTab } from './PilotMechTab'
import { ActionsSection } from './ActionsSection'
import { ComradesSection } from './ComradesSection'
import { extractComrades } from '../../lib/comradeUtils'
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

export function PlayerPilotDisplay({
  pilot,
  listing = true,
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
  editConfig,
}: PlayerPilotDisplayProps) {
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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

  const settingsControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (listing || !editConfig) return undefined
    return {
      key: 'settings',
      icon: Settings,
      onClick: () => setShowSettings(true),
      ariaLabel: 'Settings',
      variant: 'ghost' as const,
    }
  }, [listing, editConfig])

  const boardControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (listing || !editConfig || !mech || pilot.in_downtime) return undefined
    return {
      key: 'board',
      icon: pilot.is_boarded ? LogOut : LogIn,
      onClick: editConfig.onToggleBoarded,
      ariaLabel: pilot.is_boarded ? 'Disembark mech' : 'Embark mech',
      variant: pilot.is_boarded ? ('danger' as const) : ('primary' as const),
      className: pilot.is_boarded
        ? 'bg-su-rust text-su-white hover:bg-red-700'
        : 'bg-su-green text-su-white hover:bg-su-green/80',
    }
  }, [listing, editConfig, mech, pilot.is_boarded, pilot.in_downtime])

  const downtimeControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (listing || !editConfig) return undefined
    return {
      key: 'downtime',
      icon: Tent,
      onClick: editConfig.onToggleDowntime,
      ariaLabel: pilot.in_downtime ? 'Exit downtime' : 'Enter downtime',
      variant: pilot.in_downtime ? ('primary' as const) : ('ghost' as const),
      className: pilot.in_downtime ? 'bg-su-pink text-su-white hover:bg-su-pink/80' : undefined,
    }
  }, [listing, editConfig, pilot.in_downtime])

  const controls = useMemo(() => {
    if (controlsProp) return controlsProp
    if (listing) return defaultControls
    const sheetControls = [boardControl, downtimeControl, settingsControl].filter(
      Boolean
    ) as ReferenceEntityControl[]
    return sheetControls.length > 0 ? sheetControls : undefined
  }, [controlsProp, listing, defaultControls, settingsControl, boardControl, downtimeControl])

  // --- Mode mapping ---
  const mode = listing ? 'listing' : compact ? 'compact' : ('full' as const)
  const canEdit = editConfig?.canEdit ?? false
  const isBoarded = !listing && pilot.is_boarded && !!mech

  const badgeTextClass = compact
    ? 'text-xs font-normal uppercase'
    : 'text-base font-semibold uppercase'

  // --- Chassis/pattern badge (shared between listing and sheet) ---
  const chassisBadge = chassisName ? (
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
        <Text variant="pseudoheaderInverse" as="span" className={badgeTextClass}>
          {patternName}
        </Text>
      )}
    </span>
  ) : null

  // --- Header stats (non-listing mode) ---
  const headerStats: StatItem[] | undefined = useMemo(() => {
    if (listing || !editConfig) return undefined
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
  }, [listing, editConfig, isBoarded, mech, pilot, canEdit])

  // Pilot stats box shown in header when boarded (to the left of mech stats)
  const pilotBeforeStats =
    isBoarded && editConfig && !listing ? (
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
  const headerContent = listing ? (
    <CardHeader
      title={pilot.callsign}
      subtitle={
        <div className="flex flex-wrap items-center gap-1">
          <ValueDisplay label="The" value={pilotClassName} compact={compact} />
          {compact && abilityCountProp !== undefined && (
            <ValueDisplay label="Abilities" value={abilityCountProp} compact={compact} />
          )}
          {compact && chassisBadge}
        </div>
      }
      compact={compact}
    />
  ) : (
    <div className="flex min-w-0 flex-col justify-center gap-0.5">
      <Text variant="pseudoheader" as="span" className={compact ? 'text-xl' : 'text-[1.75rem]'}>
        {isBoarded ? `\u201C${mech.pattern_name || chassisName || 'Mech'}\u201D` : pilot.callsign}
      </Text>
      <div className="flex flex-wrap items-center gap-1">
        {isBoarded ? (
          <>
            {chassisName && <ValueDisplay label="Chassis" value={chassisName} compact={compact} />}
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
        ) : (
          <>
            <ValueDisplay label="The" value={pilotClassName} compact={compact} />
            {compact && abilityCountProp !== undefined && (
              <ValueDisplay label="Abilities" value={abilityCountProp} compact={compact} />
            )}
            {chassisBadge}
          </>
        )}
      </div>
    </div>
  )

  // --- Comrades (conditionally shown if any equipped entity grants a drone/companion) ---
  const comrades = useMemo(
    () => extractComrades(pilotRefs ?? [], mechRefs ?? [], mechChassisProp),
    [pilotRefs, mechRefs, mechChassisProp]
  )

  // --- Tabs (only used in non-listing mode, DisplayCard hides in listing) ---
  const tabs = useMemo(() => {
    const result: DisplayCardTab[] = [
      {
        key: 'abilities',
        label: 'Abilities',
        activeColor: 'rgb(239, 137, 79)',
        content: pilotClass ? (
          <div className={compact ? 'px-3 pb-3' : 'px-4 pb-4'}>
            <IsolatedStatValue
              stats={[{ key: 'tp', label: 'TP', value: pilot.tp }]}
              className="mb-1.5 ml-auto"
            />
            <PilotAbilityTrees pilotClass={pilotClass} pilotRefs={pilotRefs ?? []} />
          </div>
        ) : null,
      },
      {
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
      },
    ]

    if (comrades.length > 0) {
      result.push({
        key: 'comrades',
        label: 'Comrades',
        activeColor: 'rgb(140, 75, 56)',
        content: (
          <div className={compact ? 'px-3 pb-3' : 'px-4 pb-4'}>
            <ComradesSection
              pilotRefs={pilotRefs ?? []}
              mechRefs={mechRefs ?? []}
              mechChassis={mechChassisProp}
              mechId={mech?.id}
              userId={editConfig?.userId}
              readOnly={!canEdit}
              onConditionChange={
                editConfig
                  ? (refId, condition) => editConfig.onUpdateMechEntityRef(refId, { condition })
                  : undefined
              }
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
            onUpdateMech={editConfig?.onUpdateMech}
            onUpdateMechEntityRef={editConfig?.onUpdateMechEntityRef}
          />
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
    comrades.length,
    mechChassisProp,
    editConfig,
  ])

  // --- Footer (only used in non-listing mode, DisplayCard hides in listing) ---
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
        stickyHeader={!listing}
        headerBg={cardColorProp ?? 'bg-su-orange'}
        headerBgStyle={stripeStyle}
        bodyPadding="p-4"
        mode={mode}
        headerContent={headerContent}
        beforeStats={pilotBeforeStats}
        stats={headerStats}
        image={
          listing
            ? undefined
            : {
                url: pilot.image_path ?? pilotClassAssetUrl,
                alt: pilot.callsign,
                editable: canEdit
                  ? {
                      customUrl: pilot.image_path,
                      onSetCustom: (url) => editConfig?.onPilotUpdate({ image_path: url }),
                    }
                  : undefined,
              }
        }
        tabs={tabs}
        controls={controls}
        defaultTabActiveColor={isBoarded ? 'rgb(239, 137, 79)' : undefined}
        footerBg={isBoarded ? 'bg-su-orange' : undefined}
        footerBgStyle={stripeStyle}
        footerContent={footerContent}
      >
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

            <div>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-su-black bg-su-pink px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-su-pink/80"
                onClick={editConfig.onToggleDowntime}
              >
                {pilot.in_downtime ? 'Exit Downtime' : 'Trigger Downtime'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
}
