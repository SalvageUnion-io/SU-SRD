import { useState, useCallback, useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Package, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useCrawlerCargo, useAddCrawlerCargo, useDeleteCrawlerCargo } from '../../hooks/useCrawlers'
import { getErrorMessage } from '../../lib/errors'
import { EMPTY_SLOT_CLASSES } from '../patterns/emptySlotClasses'
import { ReferenceEntityPickerModal } from '../shared/ReferenceEntityPickerModal'
import { resolveEntitySchema, partitionCargo } from './crawlerStorageUtils'
import { EntityStorageItem } from './EntityStorageItem'
import { CustomStorageItem } from './CustomStorageItem'
import { CustomStorageDialog } from './CustomStorageDialog'

type CrawlerStorageSectionProps = {
  crawlerId: string
  userId: string
  readOnly: boolean
}

export function CrawlerStorageSection({ crawlerId, userId, readOnly }: CrawlerStorageSectionProps) {
  const { data: cargo } = useCrawlerCargo(crawlerId)
  const addCargo = useAddCrawlerCargo()
  const deleteCargo = useDeleteCrawlerCargo()

  const [showEntityPicker, setShowEntityPicker] = useState(false)
  const [showCustomDialog, setShowCustomDialog] = useState(false)

  const storageEntities = useMemo(
    () =>
      [
        ...SalvageUnionReference.Chassis.all(),
        ...SalvageUnionReference.Systems.all(),
        ...SalvageUnionReference.Modules.all(),
      ] as SURefEntity[],
    []
  )

  const handleEntitySelect = useCallback(
    (entityId: string) => {
      const resolved = resolveEntitySchema(entityId)
      if (!resolved) return

      addCargo.mutate(
        {
          parentId: crawlerId,
          userId,
          input: {
            name: resolved.name,
            schema_name: resolved.schemaName,
            schema_ref_id: entityId,
          },
        },
        {
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawlerId, userId, addCargo]
  )

  const handleCustomAdd = useCallback(
    (name: string, metadata: Record<string, unknown>) => {
      addCargo.mutate(
        {
          parentId: crawlerId,
          userId,
          input: {
            name,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          },
        },
        {
          onSuccess: () => setShowCustomDialog(false),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawlerId, userId, addCargo]
  )

  const handleDelete = useCallback(
    (cargoId: string) => {
      deleteCargo.mutate(
        { cargoId, parentId: crawlerId },
        { onError: (err) => toast.error(getErrorMessage(err)) }
      )
    },
    [crawlerId, deleteCargo]
  )

  const { entityItems, customItems } = useMemo(() => partitionCargo(cargo), [cargo])

  const hasItems = entityItems.length > 0 || customItems.length > 0

  return (
    <>
      {/* Storage items in a 2-column multi-column layout */}
      {hasItems ? (
        <div className="columns-2 gap-2 space-y-2">
          {entityItems.map((item) => (
            <div key={item.id} className="break-inside-avoid">
              <EntityStorageItem
                item={item}
                onDelete={readOnly ? undefined : () => handleDelete(item.id)}
              />
            </div>
          ))}
          {customItems.map((item) => (
            <div key={item.id} className="break-inside-avoid">
              <CustomStorageItem
                item={item}
                onDelete={readOnly ? undefined : () => handleDelete(item.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-8">
          <span className="font-mono text-sm text-su-black/40">No items in storage</span>
        </div>
      )}

      {/* Add buttons — at the bottom */}
      {!readOnly && (
        <div className="mt-auto flex gap-0 pt-2">
          <button
            type="button"
            onClick={() => setShowEntityPicker(true)}
            className={`${EMPTY_SLOT_CLASSES} flex-[7] rounded-r-none border-r-0`}
          >
            <Package className="h-3.5 w-3.5" />
            <span className="font-mono text-xs font-semibold uppercase">Load Storage</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCustomDialog(true)}
            className={`${EMPTY_SLOT_CLASSES} flex-[3] rounded-l-none`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="font-mono text-xs font-semibold uppercase">Custom</span>
          </button>
        </div>
      )}

      {/* Entity picker modal */}
      <ReferenceEntityPickerModal
        open={showEntityPicker}
        onOpenChange={setShowEntityPicker}
        title="Load Storage"
        subtitle="Select chassis, systems, or modules to store"
        entities={storageEntities}
        onSelect={handleEntitySelect}
        closeOnSelect
      />

      {/* Custom item dialog */}
      <CustomStorageDialog
        open={showCustomDialog}
        onOpenChange={setShowCustomDialog}
        onAdd={handleCustomAdd}
        isPending={addCargo.isPending}
      />
    </>
  )
}
