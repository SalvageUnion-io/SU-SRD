import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAssetUrl } from 'salvageunion-reference'
import { DisplayCard, CardImage, navigateControl } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { useMechBuilderState } from '../../hooks/useMechBuilderState'
import { MechBuilderHeader } from './MechBuilderHeader'
import { MechBuilderBody, ItemSlotSection } from './MechBuilderBody'
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
  const controls = controlsProp ?? (listing ? defaultControls : undefined)

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
            onSelectChassis={() => builder.setModalTarget('chassis')}
            onApplyPattern={() => builder.setShowPatternModal(true)}
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
        {/* Image + chassis abilities: vertically centered grid */}
        {!listing && (
          <div className="md:grid md:grid-cols-[auto_1fr] md:items-center">
            <CardImage
              url={builder.chassis ? getAssetUrl(builder.chassis) : undefined}
              alt={builder.chassis?.name}
              compact={compact}
              editable={
                readOnly
                  ? undefined
                  : {
                      customUrl: builder.state.customImageUrl,
                      onSetCustom: builder.setCustomImage,
                    }
              }
            />
            <MechBuilderBody
              chassis={builder.chassis}
              chassisAbilities={builder.chassisAbilities}
              systemItems={builder.systemItems}
              moduleItems={builder.moduleItems}
              capacity={builder.capacity}
              readOnly={readOnly}
              compact={compact}
              onRemoveItem={builder.removeItem}
              onAddItem={builder.setModalTarget}
              hideEquipment
            />
          </div>
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
