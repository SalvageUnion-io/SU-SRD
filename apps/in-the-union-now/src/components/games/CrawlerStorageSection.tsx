import { useState, useCallback, useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { DisplayCard, EntityDisplay, Text, deleteControl, useDetailModal } from 'suref-react'
import { Package, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCrawlerCargo,
  useAddCrawlerCargo,
  useDeleteCrawlerCargo,
} from '../../hooks/useCrawlers'
import { getErrorMessage } from '../../lib/errors'
import { EMPTY_SLOT_CLASSES } from '../patterns/emptySlotClasses'
import { EntityPickerModal } from '../shared/EntityPickerModal'
import { getEntityId } from '../../lib/entitySelectionUtils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import type { CargoRow } from '../../types/common'

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
    () => [
      ...SalvageUnionReference.Chassis.all(),
      ...SalvageUnionReference.Systems.all(),
      ...SalvageUnionReference.Modules.all(),
    ] as SURefEntity[],
    []
  )

  const handleEntitySelect = useCallback(
    (entityId: string) => {
      // Find which schema the entity belongs to
      const chassis = SalvageUnionReference.get('chassis', entityId)
      const system = chassis ? undefined : SalvageUnionReference.get('systems', entityId)
      const module = chassis || system ? undefined : SalvageUnionReference.get('modules', entityId)
      const entity = chassis ?? system ?? module
      if (!entity) return

      const schemaName = entity.schemaName
      addCargo.mutate(
        {
          crawlerId,
          userId,
          input: {
            name: entity.name,
            schema_name: schemaName,
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
    (name: string, description?: string, salvageValue?: number) => {
      const metadata: Record<string, unknown> = {}
      if (description) metadata.description = description
      if (salvageValue !== undefined) metadata.salvage_value = salvageValue

      addCargo.mutate(
        {
          crawlerId,
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
        { cargoId, crawlerId },
        { onError: (err) => toast.error(getErrorMessage(err)) }
      )
    },
    [crawlerId, deleteCargo]
  )

  const entityItems = useMemo(
    () => (cargo ?? []).filter((c) => c.schema_ref_id),
    [cargo]
  )
  const customItems = useMemo(
    () => (cargo ?? []).filter((c) => !c.schema_ref_id),
    [cargo]
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Add buttons */}
      {!readOnly && (
        <div className="flex gap-0">
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

      {/* Storage items grid */}
      {(entityItems.length > 0 || customItems.length > 0) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {entityItems.map((item) => (
            <EntityStorageItem
              key={item.id}
              item={item}
              onDelete={readOnly ? undefined : () => handleDelete(item.id)}
            />
          ))}
          {customItems.map((item) => (
            <CustomStorageItem
              key={item.id}
              item={item}
              onDelete={readOnly ? undefined : () => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {/* Entity picker modal */}
      <EntityPickerModal
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
    </div>
  )
}

/** Renders a cargo item that has a schema reference — uses EntityDisplay listing compact */
function EntityStorageItem({
  item,
  onDelete,
}: {
  item: CargoRow
  onDelete?: () => void
}) {
  const entity = useMemo(
    () =>
      item.schema_name && item.schema_ref_id
        ? SalvageUnionReference.get(
            item.schema_name as Parameters<typeof SalvageUnionReference.get>[0],
            item.schema_ref_id
          )
        : undefined,
    [item.schema_name, item.schema_ref_id]
  )

  const detailModal = useDetailModal(entity as SURefEntity | undefined)

  if (!entity) {
    return (
      <CustomStorageItem
        item={item}
        onDelete={onDelete}
      />
    )
  }

  const controls = [
    ...(onDelete ? [deleteControl(onDelete)] : []),
    ...(detailModal.control ? [detailModal.control] : []),
  ]

  return (
    <>
      <EntityDisplay
        data={entity as SURefEntity}
        listing
        compact
        controls={controls}
      />
      {detailModal.modal}
    </>
  )
}

/** Renders a custom cargo item (no schema ref) as a DisplayCard listing */
function CustomStorageItem({
  item,
  onDelete,
}: {
  item: CargoRow
  onDelete?: () => void
}) {
  const metadata = item.metadata as Record<string, unknown> | null

  return (
    <DisplayCard
      mode="listing"
      headerBg="bg-su-grey-dark"
      headerContent={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Text variant="pseudoheader" as="span" className="truncate text-sm text-su-white">
              {item.name}
            </Text>
            {item.amount > 1 && (
              <span className="shrink-0 font-mono text-xs text-su-white/50">x{item.amount}</span>
            )}
            {metadata?.salvage_value !== undefined && (
              <span className="shrink-0 font-mono text-xs text-su-yellow/70">
                SV {metadata.salvage_value as number}
              </span>
            )}
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-white/40 transition-colors hover:text-su-rust"
              aria-label="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          )}
        </div>
      }
    />
  )
}

/** Dialog for adding a custom storage item with name, description, and salvage value */
function CustomStorageDialog({
  open,
  onOpenChange,
  onAdd,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string, description?: string, salvageValue?: number) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [salvageValue, setSalvageValue] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) return
      onAdd(
        trimmed,
        description.trim() || undefined,
        salvageValue ? Number(salvageValue) : undefined
      )
      setName('')
      setDescription('')
      setSalvageValue('')
    },
    [name, description, salvageValue, onAdd]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-su-grey-light/30 bg-su-grey-dark text-su-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-su-white">Add Custom Item</DialogTitle>
          <DialogDescription className="text-su-white/60">
            Add a custom item to crawler storage.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="custom-name" className="font-mono text-xs font-semibold uppercase text-su-white/70">
              Name *
            </label>
            <Input
              id="custom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="custom-desc" className="font-mono text-xs font-semibold uppercase text-su-white/70">
              Description
            </label>
            <Textarea
              id="custom-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="min-h-[60px] text-sm"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="custom-sv" className="font-mono text-xs font-semibold uppercase text-su-white/70">
              Salvage Value
            </label>
            <Input
              id="custom-sv"
              type="number"
              min={0}
              value={salvageValue}
              onChange={(e) => setSalvageValue(e.target.value)}
              placeholder="0"
              className="h-8 w-24 text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              className="bg-su-green text-su-black hover:bg-su-green/80"
            >
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
