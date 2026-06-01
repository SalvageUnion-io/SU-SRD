import { ReferenceEntitySelectionModal } from './ReferenceEntitySelectionModal'
import type { BuilderSchemaName } from './ReferenceEntitySelectionModal'
import { PatternSelectionModal } from './PatternSelectionModal'
import { STARTING_MECH_BUDGET } from '../../lib/builderUtils'
import type { CapacityInfo, SalvageValueInfo } from '../../lib/builderUtils'
import type { SelectedPattern } from '../../types/common'

type MechBuilderModalsProps = {
  readOnly?: boolean
  modalTarget: BuilderSchemaName | null
  setModalTarget: (target: BuilderSchemaName | null) => void
  showPatternModal: boolean
  setShowPatternModal: (show: boolean) => void
  chassisRef: string | null
  capacity: CapacityInfo
  salvageValue: SalvageValueInfo
  startingMechMode: boolean
  onModalSelect: (entityId: string) => void
  onPatternSelect: (selection: SelectedPattern) => void
  userId?: string
}

export function MechBuilderModals({
  readOnly,
  modalTarget,
  setModalTarget,
  showPatternModal,
  setShowPatternModal,
  chassisRef,
  capacity,
  salvageValue,
  startingMechMode,
  onModalSelect,
  onPatternSelect,
  userId,
}: MechBuilderModalsProps) {
  if (readOnly) return null

  return (
    <>
      {/* Entity Selection Modal */}
      {modalTarget && (
        <ReferenceEntitySelectionModal
          open={!!modalTarget}
          onOpenChange={(open) => {
            if (!open) setModalTarget(null)
          }}
          title={
            modalTarget === 'chassis'
              ? 'Select Chassis'
              : modalTarget === 'systems'
                ? 'Add System'
                : 'Add Module'
          }
          schemaName={modalTarget}
          onSelect={onModalSelect}
          remainingSlots={
            modalTarget === 'systems'
              ? capacity.systemSlotsTotal - capacity.systemSlotsUsed
              : modalTarget === 'modules'
                ? capacity.moduleSlotsTotal - capacity.moduleSlotsUsed
                : undefined
          }
          remainingBudget={
            startingMechMode
              ? modalTarget === 'chassis'
                ? STARTING_MECH_BUDGET
                : salvageValue.remainingBudget
              : undefined
          }
        />
      )}

      {/* Pattern Selection Modal */}
      {chassisRef && (
        <PatternSelectionModal
          open={showPatternModal}
          onOpenChange={setShowPatternModal}
          chassisRef={chassisRef}
          onSelect={onPatternSelect}
          userId={userId}
        />
      )}
    </>
  )
}
