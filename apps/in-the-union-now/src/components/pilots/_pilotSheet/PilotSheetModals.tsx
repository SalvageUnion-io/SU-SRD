import { TakeDamageModal } from '../TakeDamageModal'
import { PushModal } from '../PushModal'
import { DeleteConfirmDialog } from '../../shared/DeleteConfirmDialog'
import { PilotSheetSettingsModal } from './PilotSheetSettingsModal'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type { PilotRow, MechRow, EntityRefRow } from '../../../types/common'

type PilotSheetModalsProps = {
  pilot: PilotRow
  mech: MechRow | null | undefined
  mechRefs: EntityRefRow[] | undefined
  compact: boolean
  canEdit: boolean
  isBoarded: boolean
  editConfig: PilotEditConfig | undefined
  showDelete: boolean
  onDeleteOpenChange: (open: boolean) => void
  showSettings: boolean
  onSettingsOpenChange: (open: boolean) => void
  showDamage: boolean
  onDamageOpenChange: (open: boolean) => void
  showPush: boolean
  onPushOpenChange: (open: boolean) => void
}

export function PilotSheetModals({
  pilot,
  mech,
  mechRefs,
  compact,
  canEdit,
  isBoarded,
  editConfig,
  showDelete,
  onDeleteOpenChange,
  showSettings,
  onSettingsOpenChange,
  showDamage,
  onDamageOpenChange,
  showPush,
  onPushOpenChange,
}: PilotSheetModalsProps) {
  if (!editConfig) return null

  return (
    <>
      <DeleteConfirmDialog
        open={showDelete}
        onOpenChange={onDeleteOpenChange}
        entityType="Pilot"
        entityName={pilot.callsign}
        onConfirm={editConfig.onDelete}
        isDeleting={editConfig.isDeleting}
      />

      <PilotSheetSettingsModal
        open={showSettings}
        onOpenChange={onSettingsOpenChange}
        pilot={pilot}
        mech={mech}
        compact={compact}
        canEdit={canEdit}
        editConfig={editConfig}
      />

      {mech && isBoarded && (
        <TakeDamageModal
          open={showDamage}
          onOpenChange={onDamageOpenChange}
          mech={mech}
          pilot={pilot}
          mechRefs={mechRefs ?? []}
          userId={editConfig.userId}
        />
      )}

      {mech && isBoarded && (
        <PushModal
          open={showPush}
          onOpenChange={onPushOpenChange}
          mech={mech}
          pilot={pilot}
          mechRefs={mechRefs ?? []}
          userId={editConfig.userId}
        />
      )}
    </>
  )
}
