import { useMemo } from 'react'
import { getAssetUrl } from 'salvageunion-reference'
import { DisplayCard } from 'suref-react'
import type { ReferenceEntityControl, StatItem } from 'suref-react'
import { useMechBuilderState } from '../../hooks/useMechBuilderState'
import { STARTING_MECH_BUDGET } from '../../lib/builderUtils'
import { MechBuilderHeader } from './MechBuilderHeader'
import { MechBuilderBody } from './MechBuilderBody'
import { MechBuilderFooter } from './MechBuilderFooter'
import { MechBuilderModals } from './MechBuilderModals'
import type { BuilderState } from '../../lib/builderUtils'
import type { ItemCondition } from 'salvageunion-reference'
import type { CreatePatternInput, SelectedPattern } from '../../types/common'
import type { EntityRefRow } from '../../types/common'
import type { MechSourcePattern } from '../../lib/mechUtils'

type MechBuilderProps = {
  initialState?: BuilderState
  // Legacy explicit-save mode (creation flow)
  onSave?: (input: CreatePatternInput) => void
  onCancel?: () => void
  isSaving?: boolean
  isDirty?: boolean
  // Autosave mode
  onChange?: (state: BuilderState) => void
  saveStatusText?: string
  // Shared
  onDelete?: () => void
  onCopy?: () => void
  onSaveToPatterns?: () => void
  isDeleting?: boolean
  isCopying?: boolean
  isSavingToPatterns?: boolean
  readOnly?: boolean
  compact?: boolean
  hideFooterToggles?: boolean
  hideFooter?: boolean
  // Source pattern linking
  sourcePattern?: MechSourcePattern | null
  isDeviated?: boolean
  onViewPattern?: () => void
  onPatternApplied?: (selection: SelectedPattern) => void
  userId?: string
  /** Whether to make the DisplayCard header sticky (default: true) */
  stickyHeader?: boolean
  /** Controls rendered in the DisplayCard header */
  controls?: ReferenceEntityControl[]
  /** Mech ID for drone choice inputs and modification slots */
  mechId?: string
  /** Entity refs for drone modification slots */
  mechRefs?: EntityRefRow[]
  onConditionChange?: (refId: string, condition: ItemCondition) => void
  /** Image upload handlers (forwarded to MechBuilderBody CardImage) */
  onImageFileSelected?: (file: File) => void
  onImageRemove?: () => void
  isImageUploading?: boolean
}

export function MechBuilder({
  initialState,
  onSave,
  onCancel,
  isDirty,
  onChange,
  saveStatusText,
  onDelete,
  onCopy,
  onSaveToPatterns,
  isSaving,
  isDeleting,
  isCopying,
  isSavingToPatterns,
  readOnly,
  compact,
  hideFooterToggles,
  hideFooter,
  sourcePattern,
  isDeviated,
  onViewPattern,
  onPatternApplied,
  userId,
  stickyHeader = true,
  controls,
  mechId,
  mechRefs,
  onConditionChange,
  onImageFileSelected,
  onImageRemove,
  isImageUploading,
}: MechBuilderProps) {
  const builder = useMechBuilderState({
    initialState,
    onChange,
    onSave,
    onPatternApplied,
  })

  const mergedControls = useMemo(() => {
    if (readOnly) return controls
    const applyPatternControl: ReferenceEntityControl = {
      key: 'apply-pattern',
      label: 'Pattern',
      onClick: () => builder.setShowPatternModal(true),
      ariaLabel: 'Apply pattern',
    }
    return controls ? [applyPatternControl, ...controls] : [applyPatternControl]
  }, [readOnly, controls, builder])

  const stats: StatItem[] | undefined = useMemo(() => {
    const chassis = builder.chassis
    if (!chassis) return undefined
    const c = compact
    return [
      {
        key: 'sp',
        label: c ? 'SP' : 'Structure',
        value: chassis.structurePoints,
        bottomLabel: c ? '' : 'Points',
      },
      {
        key: 'ep',
        label: c ? 'EP' : 'Energy',
        value: chassis.energyPoints,
        bottomLabel: c ? '' : 'Points',
      },
      {
        key: 'heat',
        label: 'Heat',
        value: chassis.heatCapacity,
        bottomLabel: c ? 'Cap' : 'Capacity',
      },
      {
        key: 'sys',
        label: c ? 'Sys' : 'System',
        value: builder.capacity.systemSlotsUsed,
        outOfMax: builder.capacity.systemSlotsTotal,
        isOverMax: builder.capacity.isOverSystemCapacity,
        bottomLabel: c ? 'Slts' : 'Slots',
      },
      {
        key: 'mod',
        label: c ? 'Mod' : 'Module',
        value: builder.capacity.moduleSlotsUsed,
        outOfMax: builder.capacity.moduleSlotsTotal,
        isOverMax: builder.capacity.isOverModuleCapacity,
        bottomLabel: c ? 'Slts' : 'Slots',
      },
      {
        key: 'cargo',
        label: c ? 'Crgo' : 'Cargo',
        value: chassis.cargoCapacity ?? 0,
        bottomLabel: c ? 'Cap' : 'Capacity',
      },
      {
        key: 'sv',
        label: c ? 'SV' : 'Salvage',
        value: builder.salvageValue.totalTL1Cost,
        outOfMax: builder.startingMechMode ? STARTING_MECH_BUDGET : undefined,
        isOverMax: builder.startingMechMode ? !builder.salvageValue.isLegalStartingMech : undefined,
        bottomLabel: 'TL1',
      },
    ]
  }, [builder.chassis, builder.capacity, builder.salvageValue, builder.startingMechMode, compact])

  return (
    <>
      <DisplayCard
        stickyHeader={stickyHeader}
        headerBg="bg-su-green"
        compact={compact}
        controls={mergedControls}
        stats={stats}
        headerContent={
          <MechBuilderHeader
            chassis={builder.chassis}
            name={builder.state.name}
            readOnly={readOnly}
            compact={compact}
            salvageValue={builder.salvageValue}
            onNameChange={builder.setName}
            onSelectChassis={() => builder.setModalTarget('chassis')}
          />
        }
        footerContent={
          readOnly || hideFooter ? undefined : (
            <MechBuilderFooter
              compact={compact}
              hideFooterToggles={hideFooterToggles}
              visible={builder.state.visible}
              startingMechMode={builder.startingMechMode}
              canSave={builder.canSave}
              isDirty={isDirty}
              saveStatusText={saveStatusText}
              isSaving={isSaving}
              isDeleting={isDeleting}
              isCopying={isCopying}
              isSavingToPatterns={isSavingToPatterns}
              isDeviated={isDeviated}
              sourcePattern={sourcePattern}
              onToggleVisible={builder.toggleVisible}
              onToggleStartingMech={() => builder.setStartingMechMode((v) => !v)}
              onSave={onSave ? builder.handleSave : undefined}
              onCancel={onCancel}
              onDelete={onDelete}
              onCopy={onCopy}
              onSaveToPatterns={onSaveToPatterns}
              onViewPattern={onViewPattern}
            />
          )
        }
      >
        <MechBuilderBody
          chassis={builder.chassis}
          chassisAbilities={builder.chassisAbilities}
          systemItems={builder.systemItems}
          moduleItems={builder.moduleItems}
          capacity={builder.capacity}
          readOnly={readOnly}
          compact={compact}
          onSelectChassis={() => builder.setModalTarget('chassis')}
          onRemoveItem={builder.removeItem}
          onAddItem={builder.setModalTarget}
          mechId={mechId}
          mechRefs={mechRefs}
          userId={userId}
          onConditionChange={onConditionChange}
          image={{
            url: builder.chassis ? getAssetUrl(builder.chassis) : undefined,
            alt: builder.chassis?.name,
            editable: readOnly
              ? undefined
              : {
                  customUrl: builder.state.customImageUrl,
                  onSetCustom: onImageRemove
                    ? (url) => {
                        if (url === null) onImageRemove()
                        else builder.setCustomImage(url)
                      }
                    : builder.setCustomImage,
                  onFileSelected: onImageFileSelected,
                  isUploading: isImageUploading,
                  removeLabel: onImageRemove ? 'Delete' : undefined,
                },
          }}
        />
      </DisplayCard>

      <MechBuilderModals
        readOnly={readOnly}
        modalTarget={builder.modalTarget}
        setModalTarget={builder.setModalTarget}
        showPatternModal={builder.showPatternModal}
        setShowPatternModal={builder.setShowPatternModal}
        chassisRef={builder.state.chassisRef}
        capacity={builder.capacity}
        salvageValue={builder.salvageValue}
        startingMechMode={builder.startingMechMode}
        onModalSelect={builder.handleModalSelect}
        onPatternSelect={builder.handlePatternSelect}
        userId={userId}
      />
    </>
  )
}
