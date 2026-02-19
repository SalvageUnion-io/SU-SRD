import { useMemo } from 'react'
import { getAssetUrl } from 'salvageunion-reference'
import { Layers } from 'lucide-react'
import { DisplayCard } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { useMechBuilderState } from '../../hooks/useMechBuilderState'
import { MechBuilderHeader } from './MechBuilderHeader'
import { MechBuilderBody } from './MechBuilderBody'
import { MechBuilderFooter } from './MechBuilderFooter'
import { MechBuilderModals } from './MechBuilderModals'
import type { BuilderState } from '../../lib/builderUtils'
import type { CreatePatternInput, SelectedPattern } from '../../types/common'
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
      icon: Layers,
      onClick: () => builder.setShowPatternModal(true),
      ariaLabel: 'Apply pattern',
      label: 'Pattern',
      variant: 'ghost',
    }
    return controls ? [applyPatternControl, ...controls] : [applyPatternControl]
  }, [readOnly, controls, builder])

  return (
    <>
      <DisplayCard
        stickyHeader={stickyHeader}
        headerBg="bg-su-green"
        bodyPadding="p-4"
        mode={compact ? 'compact' : undefined}
        controls={mergedControls}
        headerContent={
          <MechBuilderHeader
            chassis={builder.chassis}
            name={builder.state.name}
            readOnly={readOnly}
            compact={compact}
            capacity={builder.capacity}
            salvageValue={builder.salvageValue}
            startingMechMode={builder.startingMechMode}
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
          image={{
            url: builder.chassis ? getAssetUrl(builder.chassis) : undefined,
            alt: builder.chassis?.name,
            editable: readOnly
              ? undefined
              : {
                  customUrl: builder.state.customImageUrl,
                  onSetCustom: builder.setCustomImage,
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
