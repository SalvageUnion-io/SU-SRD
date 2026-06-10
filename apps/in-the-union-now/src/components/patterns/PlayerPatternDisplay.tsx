import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAssetUrl } from 'salvageunion-reference'
import { DisplayCard, navigateControl, DualColumnLayout } from 'suref-react'
import { uploadEntityImage, deleteEntityImage } from '../../lib/api/storageApi'
import type { ReferenceEntityControl, StatItem } from 'suref-react'
import { useMechBuilderState } from '../../hooks/useMechBuilderState'
import { STARTING_MECH_BUDGET } from '../../lib/builderUtils'
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
  const [isImageUploading, setIsImageUploading] = useState(false)

  const builder = useMechBuilderState({
    initialState: patternToBuilderState(pattern),
    onChange: editConfig?.onBuilderChange,
  })

  const handleImageFileSelected = useCallback(
    async (file: File) => {
      if (!editConfig) return
      setIsImageUploading(true)
      try {
        const url = await uploadEntityImage(editConfig.userId, file)
        if (pattern.image_path) {
          deleteEntityImage(pattern.image_path)
        }
        builder.setCustomImage(url)
      } catch (err) {
        console.error('Failed to upload image:', err)
      } finally {
        setIsImageUploading(false)
      }
    },
    [editConfig, pattern.image_path, builder]
  )

  const handleImageRemove = useCallback(() => {
    if (pattern.image_path) {
      deleteEntityImage(pattern.image_path)
    }
    builder.setCustomImage(null)
  }, [pattern.image_path, builder])

  const handleNavigate = useCallback(() => {
    navigate({ to: '/patterns/$patternId', params: { patternId: pattern.id } })
  }, [navigate, pattern.id])

  const defaultControls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])
  const applyPatternControl: ReferenceEntityControl | undefined = useMemo(() => {
    if (listing || !editConfig?.canEdit) return undefined
    return {
      key: 'apply-pattern',
      label: 'Pattern',
      onClick: () => builder.setShowPatternModal(true),
      ariaLabel: 'Apply pattern',
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
        value: chassis.cargoCapacity,
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

  if (!builder.chassis) return null

  const readOnly = !editConfig?.canEdit

  return (
    <>
      <DisplayCard
        compact={compact}
        listing={listing}
        headerBg="bg-su-green"
        bodyPadding="p-4"
        stickyHeader={!listing}
        controls={controls}
        stats={stats}
        headerContent={
          <MechBuilderHeader
            chassis={builder.chassis}
            name={builder.state.name}
            readOnly={readOnly}
            compact={compact}
            salvageValue={builder.salvageValue}
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
                    onSetCustom: (url) => {
                      if (url === null) handleImageRemove()
                      else builder.setCustomImage(url)
                    },
                    onFileSelected: handleImageFileSelected,
                    isUploading: isImageUploading,
                    removeLabel: 'Delete',
                  },
            }}
          />
        )}
        {/* Equipment grid: beneath the fold */}
        <DualColumnLayout
          left={
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
          }
          right={
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
          }
        />
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
