import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAssetUrl } from 'salvageunion-reference'
import { Layers } from 'lucide-react'
import { DisplayCard, navigateControl } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { useMechBuilderState } from '../../hooks/useMechBuilderState'
import { MechBuilderHeader } from './MechBuilderHeader'
import { MechBuilderBody } from './MechBuilderBody'
import { ItemSlotSection } from '../shared/ItemSlotSection'
import { MechBuilderFooter } from './MechBuilderFooter'
import { MechBuilderModals } from './MechBuilderModals'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { DiscardChangesDialog } from '../shared/DiscardChangesDialog'
import { patternToBuilderState } from '../../lib/builderUtils'
import type { PatternEditConfig } from '../../hooks/usePatternSheet'
import type { TypedPatternRow } from '../../types/common'

type PlayerPatternDisplayProps = {
  pattern: TypedPatternRow
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
  editConfig?: PatternEditConfig
}

export function PlayerPatternDisplay({
  pattern,
  listing = true,
  compact = true,
  controls: controlsProp,
  editConfig,
}: PlayerPatternDisplayProps) {
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)

  const builder = useMechBuilderState({
    initialState: patternToBuilderState(pattern),
    onChange: editConfig?.onBuilderChange,
  })

  const handleNavigate = useCallback(() => {
    navigate({ to: '/patterns/$patternId', params: { patternId: pattern.id } })
  }, [navigate, pattern.id])

  const defaultControls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])
  const applyPatternControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (listing || !editConfig?.canEdit) return undefined
    return {
      key: 'apply-pattern',
      icon: Layers,
      onClick: () => builder.setShowPatternModal(true),
      ariaLabel: 'Apply pattern',
      label: 'Pattern',
      variant: 'ghost' as const,
    }
  }, [listing, editConfig?.canEdit, builder])
  const controls =
    controlsProp ??
    (listing ? defaultControls : applyPatternControl ? [applyPatternControl] : undefined)

  const handleCancel = useCallback(() => {
    if (editConfig?.isDirty) {
      setShowDiscard(true)
    } else {
      editConfig?.onCancel()
    }
  }, [editConfig])

  const handleDiscardConfirm = useCallback(() => {
    builder.reset()
    editConfig?.onCancel()
    setShowDiscard(false)
  }, [builder, editConfig])

  if (!builder.chassis) return null

  // --- Mode mapping ---
  const mode = listing ? 'listing' : compact ? 'compact' : ('full' as const)
  const readOnly = !editConfig?.canEdit

  return (
    <>
      <DisplayCard
        mode={mode}
        headerBg="bg-su-green"
        bodyPadding="p-4"
        stickyHeader={!listing}
        controls={controls}
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
          />
        }
        footerContent={
          listing || readOnly ? undefined : (
            <MechBuilderFooter
              compact={compact}
              visible={builder.state.visible}
              startingMechMode={builder.startingMechMode}
              canSave={builder.canSave}
              isDirty={editConfig?.isDirty}
              isSaving={editConfig?.isSaving}
              isDeleting={editConfig?.isDeleting}
              isCopying={editConfig?.isCopying}
              onToggleVisible={builder.toggleVisible}
              onToggleStartingMech={() => builder.setStartingMechMode((v) => !v)}
              onDelete={() => setShowDelete(true)}
              onCopy={editConfig?.onCopy}
              onSave={editConfig?.onSave}
              onCancel={handleCancel}
            />
          )
        }
      >
        {/* Image + chassis + chassis abilities */}
        {!listing && (
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
            hideEquipment
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
        )}
        {/* Equipment grid: beneath the fold */}
        <div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ItemSlotSection
              label="Systems"
              items={builder.systemItems}
              slotsUsed={builder.capacity.systemSlotsUsed}
              slotsTotal={builder.capacity.systemSlotsTotal}
              slotType="systems"
              readOnly={readOnly}
              hasChassis={!!builder.chassis}
              onRemove={builder.removeItem}
              onAdd={builder.setModalTarget}
              compact={compact}
              showDetailButton
            />
            <ItemSlotSection
              label="Modules"
              items={builder.moduleItems}
              slotsUsed={builder.capacity.moduleSlotsUsed}
              slotsTotal={builder.capacity.moduleSlotsTotal}
              slotType="modules"
              readOnly={readOnly}
              hasChassis={!!builder.chassis}
              onRemove={builder.removeItem}
              onAdd={builder.setModalTarget}
              compact={compact}
              showDetailButton
            />
          </div>
        </div>
      </DisplayCard>

      {!listing && (
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
        />
      )}

      {editConfig && (
        <>
          <DeleteConfirmDialog
            open={showDelete}
            onOpenChange={setShowDelete}
            entityType="Pattern"
            entityName={pattern.name}
            onConfirm={editConfig.onDelete}
            isDeleting={editConfig.isDeleting}
          />
          <DiscardChangesDialog
            open={showDiscard}
            onOpenChange={setShowDiscard}
            onConfirm={handleDiscardConfirm}
          />
        </>
      )}
    </>
  )
}
