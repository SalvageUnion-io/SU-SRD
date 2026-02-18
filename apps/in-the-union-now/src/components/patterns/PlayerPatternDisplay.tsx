import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAssetUrl } from 'salvageunion-reference'
import { DisplayCard, navigateControl } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { useMechBuilderState } from '../../hooks/useMechBuilderState'
import { MechBuilderHeader } from './MechBuilderHeader'
import { MechBuilderBody } from './MechBuilderBody'
import { MechBuilderFooter } from './MechBuilderFooter'
import { MechBuilderModals } from './MechBuilderModals'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
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

  const builder = useMechBuilderState({
    initialState: patternToBuilderState(pattern),
    onChange: editConfig?.onBuilderChange,
  })

  const handleNavigate = useCallback(() => {
    navigate({ to: '/patterns/$patternId', params: { patternId: pattern.id } })
  }, [navigate, pattern.id])

  const defaultControls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])
  const controls = controlsProp ?? (listing ? defaultControls : undefined)

  if (!builder.chassis) return null

  // --- Mode mapping ---
  const mode = listing ? 'listing' : compact ? 'compact' : ('full' as const)
  const readOnly = !editConfig?.canEdit

  return (
    <>
      <DisplayCard
        mode={mode}
        headerBg="bg-su-green"
        bodyPadding="p-0"
        stickyHeader={!listing}
        controls={controls}
        image={
          listing
            ? undefined
            : {
                url: builder.chassis ? getAssetUrl(builder.chassis) : undefined,
                alt: builder.chassis?.name,
                editable: readOnly
                  ? undefined
                  : {
                      customUrl: builder.state.customImageUrl,
                      onSetCustom: builder.setCustomImage,
                    },
              }
        }
        headerContent={
          <MechBuilderHeader
            chassis={builder.chassis}
            name={builder.state.name}
            readOnly={readOnly}
            compact={listing ? true : compact}
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
              visible={builder.state.visible}
              startingMechMode={builder.startingMechMode}
              canSave={builder.canSave}
              saveStatus={editConfig?.saveStatus}
              isDeleting={editConfig?.isDeleting}
              isCopying={editConfig?.isCopying}
              onToggleVisible={builder.toggleVisible}
              onToggleStartingMech={() => builder.setStartingMechMode((v) => !v)}
              onDelete={() => setShowDelete(true)}
              onCopy={editConfig?.onCopy}
            />
          )
        }
      >
        {/* Body: hidden in listing mode by DisplayCard */}
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
        <DeleteConfirmDialog
          open={showDelete}
          onOpenChange={setShowDelete}
          entityType="Pattern"
          entityName={pattern.name}
          onConfirm={editConfig.onDelete}
          isDeleting={editConfig.isDeleting}
        />
      )}
    </>
  )
}
