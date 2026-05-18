import { useCallback, useState } from 'react'
import { CardImage } from 'suref-react'
import { uploadEntityImage, deleteEntityImage } from '../../../lib/api/storageApi'
import { PilotPersonalInfo } from '../PilotPersonalInfo'
import { PilotEquipmentSection } from '../PilotEquipmentSection'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type { PilotRow, EntityRefRow } from '../../../types/common'

type PilotSheetBodyProps = {
  pilot: PilotRow
  pilotRefs: EntityRefRow[]
  pilotClassAssetUrl: string | undefined
  compact: boolean
  canEdit: boolean
  editConfig: PilotEditConfig | undefined
}

export function PilotSheetBody({
  pilot,
  pilotRefs,
  pilotClassAssetUrl,
  compact,
  canEdit,
  editConfig,
}: PilotSheetBodyProps) {
  const [isImageUploading, setIsImageUploading] = useState(false)

  const handleImageFileSelected = useCallback(
    async (file: File) => {
      if (!editConfig) return
      setIsImageUploading(true)
      try {
        const url = await uploadEntityImage(editConfig.userId, file)
        if (pilot.image_path) {
          deleteEntityImage(pilot.image_path)
        }
        editConfig.onPilotUpdate({ image_path: url })
      } catch (err) {
        console.error('Failed to upload image:', err)
      } finally {
        setIsImageUploading(false)
      }
    },
    [editConfig, pilot.image_path]
  )

  const handleImageRemove = useCallback(() => {
    if (!editConfig) return
    if (pilot.image_path) {
      deleteEntityImage(pilot.image_path)
    }
    editConfig.onPilotUpdate({ image_path: null })
  }, [editConfig, pilot.image_path])

  return (
    <div className="md:grid md:grid-cols-[auto_1fr] md:items-center p-4">
      <CardImage
        url={pilot.image_path ?? pilotClassAssetUrl}
        alt={`${pilot.callsign} pilot portrait`}
        compact={compact}
        editable={
          canEdit
            ? {
                customUrl: pilot.image_path,
                onSetCustom: (url) => {
                  if (url === null) handleImageRemove()
                },
                onFileSelected: handleImageFileSelected,
                isUploading: isImageUploading,
                removeLabel: 'Delete',
              }
            : undefined
        }
      />
      <div className="space-y-4">
        <PilotPersonalInfo
          pilot={pilot}
          compact={compact}
          readOnly={!canEdit}
          onUpdate={editConfig?.onPilotUpdate ?? (() => {})}
        />
        <PilotEquipmentSection
          refs={pilotRefs}
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
                  const maxSort = pilotRefs.reduce((max, r) => Math.max(max, r.sort_order ?? 0), 0)
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
    </div>
  )
}
