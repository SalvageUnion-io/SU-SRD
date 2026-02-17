import { useState, useCallback, useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import {
  CardHeader,
  DetailIcon,
  DisplayCard,
  EntityDisplay,
  FilterChip,
  StatDisplay,
  TECH_LEVEL_STYLES,
  Text,
  ValueDisplay,
  deleteControl,
  techLevelLabel,
  useDetailModal,
} from 'suref-react'
import type { EntityControl } from 'suref-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Package, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCrawlerCargo,
  useAddCrawlerCargo,
  useDeleteCrawlerCargo,
} from '../../hooks/useCrawlers'
import { getErrorMessage } from '../../lib/errors'
import {
  CUSTOM_CARGO_CATEGORIES,
  getCategoryFields,
  getCustomItemHeaderBg,
} from '../../lib/customCargoCategories'
import { EMPTY_SLOT_CLASSES } from '../patterns/emptySlotClasses'
import { EntityPickerModal } from '../shared/EntityPickerModal'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
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
    (name: string, metadata: Record<string, unknown>) => {
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
        <div className="grid grid-cols-1 gap-2">
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
        lightweight
        controls={controls}
      />
      {detailModal.modal}
    </>
  )
}

/** Renders a custom cargo item as an entity-like listing with category-colored header */
function CustomStorageItem({
  item,
  onDelete,
}: {
  item: CargoRow
  onDelete?: () => void
}) {
  const [showDetail, setShowDetail] = useState(false)
  const metadata = item.metadata as Record<string, unknown> | null
  const category = (metadata?.category as string) ?? undefined
  const techLevel = metadata?.tech_level as string | number | undefined
  const headerBg = getCustomItemHeaderBg(category, techLevel)

  const detailControl: EntityControl = {
    key: 'detail',
    icon: DetailIcon,
    onClick: () => setShowDetail(true),
    ariaLabel: 'View details',
    variant: 'ghost',
  }

  const controls = [
    ...(onDelete ? [deleteControl(onDelete)] : []),
    detailControl,
  ]

  // Build title with optional amount badge and CUSTOM ITEM tag
  const titleContent = (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Text variant="pseudoheader" as="span" className="truncate py-[3px] text-base uppercase tracking-[-0.02em]" style={{ lineHeight: 1 }}>
          {item.name}
        </Text>
        {item.amount > 1 && (
          <span className="shrink-0 font-mono text-xs text-su-white/50">x{item.amount}</span>
        )}
      </div>
      <ValueDisplay label="Custom Item" compact bgColor="var(--color-su-rust)" textColor="var(--color-su-white)" />
    </div>
  )

  return (
    <>
      <DisplayCard
        mode="listing"
        headerBg={headerBg}
        headerContent={
          <CardHeader
            title={titleContent}
            controls={controls}
            compact
            lightweight
          />
        }
        onClick={detailControl.onClick}
      />
      <CustomItemDetailModal
        open={showDetail}
        onOpenChange={setShowDetail}
        item={item}
        headerBg={headerBg}
        category={category}
        techLevel={techLevel}
        metadata={metadata}
      />
    </>
  )
}

/** Full-view modal for a custom cargo item */
function CustomItemDetailModal({
  open,
  onOpenChange,
  item,
  headerBg,
  category,
  techLevel,
  metadata,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CargoRow
  headerBg: string
  category?: string
  techLevel?: string | number
  metadata: Record<string, unknown> | null
}) {
  const categoryLabel = CUSTOM_CARGO_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other'
  const description = (metadata?.description as string) ?? undefined

  // Build stat badges from metadata
  const stats: { label: string; value: number }[] = []
  if (metadata?.salvage_value !== undefined) stats.push({ label: 'SV', value: metadata.salvage_value as number })
  if (metadata?.slots_required !== undefined) stats.push({ label: 'Slots', value: metadata.slots_required as number })
  if (metadata?.structure_points !== undefined) stats.push({ label: 'SP', value: metadata.structure_points as number })
  if (metadata?.energy_points !== undefined) stats.push({ label: 'EP', value: metadata.energy_points as number })
  if (metadata?.heat_capacity !== undefined) stats.push({ label: 'Heat', value: metadata.heat_capacity as number })
  if (metadata?.hit_points !== undefined) stats.push({ label: 'HP', value: metadata.hit_points as number })

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-2xl bg-transparent outline-none">
              <DialogPrimitive.Close className="fixed top-4 right-4 z-[60] rounded-full bg-su-black/70 p-2 text-su-white opacity-70 transition-opacity hover:opacity-100">
                <X className="h-6 w-6" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
              <DialogPrimitive.Title className="sr-only">{item.name}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Custom item details
              </DialogPrimitive.Description>
              <DisplayCard
                headerBg={headerBg}
                bodyPadding="p-0"
                headerContent={
                  <CardHeader
                    title={
                      <Text variant="pseudoheader" as="span" className="text-[1.75rem] uppercase tracking-[-0.02em]">
                        {item.name}
                      </Text>
                    }
                    subtitle={
                      <div className="flex flex-wrap items-center gap-1">
                        <ValueDisplay label="Custom Item" compact bgColor="var(--color-su-rust)" textColor="var(--color-su-white)" />
                        <ValueDisplay label="Category" value={categoryLabel} compact />
                        {item.amount > 1 && <ValueDisplay label="Qty" value={item.amount} compact />}
                      </div>
                    }
                    leftContent={
                      techLevel !== undefined ? (
                        <StatDisplay label="TL" value={String(techLevel)} inverse />
                      ) : undefined
                    }
                    rightContent={
                      stats.length > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {stats.map((s) => (
                            <StatDisplay key={s.label} label={s.label} value={s.value} inverse />
                          ))}
                        </div>
                      ) : undefined
                    }
                  />
                }
              >
                {description && (
                  <div className="bg-su-white p-4">
                    <Text variant="default" className="text-sm leading-relaxed text-su-black">
                      {description}
                    </Text>
                  </div>
                )}
              </DisplayCard>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Tech level options for the selector */
const TL_OPTIONS: (number | 'B' | 'N')[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

/** Dialog for adding a custom storage item with category, tech level, and category-specific fields */
function CustomStorageDialog({
  open,
  onOpenChange,
  onAdd,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string, metadata: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [techLevel, setTechLevel] = useState<string | undefined>(undefined)
  const [salvageValue, setSalvageValue] = useState('')
  const [slotsRequired, setSlotsRequired] = useState('')
  const [structurePoints, setStructurePoints] = useState('')
  const [energyPoints, setEnergyPoints] = useState('')
  const [heatCapacity, setHeatCapacity] = useState('')

  const fields = getCategoryFields(category)

  const resetCategoryFields = useCallback(() => {
    setTechLevel(undefined)
    setSalvageValue('')
    setSlotsRequired('')
    setStructurePoints('')
    setEnergyPoints('')
    setHeatCapacity('')
  }, [])

  const handleCategoryChange = useCallback(
    (newCategory: string) => {
      setCategory(newCategory)
      resetCategoryFields()
    },
    [resetCategoryFields]
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) return

      const metadata: Record<string, unknown> = { category }
      if (description.trim()) metadata.description = description.trim()
      if (techLevel !== undefined && fields.techLevel) metadata.tech_level = techLevel
      if (salvageValue && fields.salvageValue) metadata.salvage_value = Number(salvageValue)
      if (slotsRequired && fields.slotsRequired) metadata.slots_required = Number(slotsRequired)
      if (structurePoints && fields.structurePoints)
        metadata.structure_points = Number(structurePoints)
      if (energyPoints && fields.energyPoints) metadata.energy_points = Number(energyPoints)
      if (heatCapacity && fields.heatCapacity) metadata.heat_capacity = Number(heatCapacity)

      onAdd(trimmed, metadata)

      // Reset form
      setName('')
      setDescription('')
      setCategory('other')
      resetCategoryFields()
    },
    [
      name,
      description,
      category,
      techLevel,
      salvageValue,
      slotsRequired,
      structurePoints,
      energyPoints,
      heatCapacity,
      fields,
      onAdd,
      resetCategoryFields,
    ]
  )

  const inputClasses =
    'h-9 border-su-grey-dark/40 bg-su-white text-su-black placeholder:text-su-grey-dark'
  const disabledInputClasses =
    'h-9 border-su-grey-light/20 bg-su-grey-light/10 text-su-black/20 placeholder:text-su-black/15'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full items-start justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-md bg-transparent outline-none">
              <DialogPrimitive.Title className="sr-only">Add Custom Item</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Add a custom item to crawler storage.
              </DialogPrimitive.Description>

              <DisplayCard
                headerBg="bg-su-orange"
                bodyPadding="p-0"
                headerContent={
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Text
                        as="span"
                        variant="pseudoheader"
                        className="text-[1.75rem] text-su-white"
                      >
                        Add Custom Item
                      </Text>
                      <Text
                        as="span"
                        variant="pseudoheader"
                        className="text-xs text-su-white/80"
                      >
                        Add a custom item to crawler storage.
                      </Text>
                    </div>
                    <DialogPrimitive.Close className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-black/60 transition-colors hover:bg-su-black/20 hover:text-su-black">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                }
              >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-su-white p-4">
                  {/* Category selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-su-black/70">Category</label>
                    <div className="flex flex-wrap gap-1">
                      {CUSTOM_CARGO_CATEGORIES.map((cat) => (
                        <FilterChip
                          key={cat.value}
                          label={cat.label}
                          active={category === cat.value}
                          onClick={() => handleCategoryChange(cat.value)}
                          colorClass={cat.headerBg}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="custom-name" className="text-xs font-bold uppercase tracking-wide text-su-black/70">
                      Name *
                    </label>
                    <Input
                      id="custom-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Item name"
                      className={inputClasses}
                      autoFocus
                    />
                  </div>

                  {/* Tech Level selector */}
                  <div
                    className={`flex flex-col gap-1.5 ${!fields.techLevel ? 'pointer-events-none opacity-30' : ''}`}
                  >
                    <label className="text-xs font-bold uppercase tracking-wide text-su-black/70">Tech Level</label>
                    <div className="flex flex-wrap gap-1">
                      {TL_OPTIONS.map((tl) => {
                        const key = String(tl)
                        return (
                          <FilterChip
                            key={key}
                            label={techLevelLabel(tl)}
                            active={fields.techLevel ? techLevel === key : false}
                            onClick={() => setTechLevel(techLevel === key ? undefined : key)}
                            colorClass={TECH_LEVEL_STYLES[key]?.split(' ')[0]}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* Number fields — always shown, disabled when not relevant */}
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="custom-sv"
                        className={`text-xs uppercase tracking-wide ${fields.salvageValue ? 'font-bold text-su-black/70' : 'font-medium text-su-black/20'}`}
                      >
                        Salvage Value
                      </label>
                      <Input
                        id="custom-sv"
                        type="number"
                        min={0}
                        value={fields.salvageValue ? salvageValue : ''}
                        onChange={(e) => setSalvageValue(e.target.value)}
                        placeholder="0"
                        className={`w-24 ${fields.salvageValue ? inputClasses : disabledInputClasses}`}
                        disabled={!fields.salvageValue}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="custom-slots"
                        className={`text-xs uppercase tracking-wide ${fields.slotsRequired ? 'font-bold text-su-black/70' : 'font-medium text-su-black/20'}`}
                      >
                        Slots
                      </label>
                      <Input
                        id="custom-slots"
                        type="number"
                        min={0}
                        value={fields.slotsRequired ? slotsRequired : ''}
                        onChange={(e) => setSlotsRequired(e.target.value)}
                        placeholder="0"
                        className={`w-24 ${fields.slotsRequired ? inputClasses : disabledInputClasses}`}
                        disabled={!fields.slotsRequired}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="custom-sp"
                        className={`text-xs uppercase tracking-wide ${fields.structurePoints ? 'font-bold text-su-black/70' : 'font-medium text-su-black/20'}`}
                      >
                        SP
                      </label>
                      <Input
                        id="custom-sp"
                        type="number"
                        min={0}
                        value={fields.structurePoints ? structurePoints : ''}
                        onChange={(e) => setStructurePoints(e.target.value)}
                        placeholder="0"
                        className={`w-24 ${fields.structurePoints ? inputClasses : disabledInputClasses}`}
                        disabled={!fields.structurePoints}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="custom-ep"
                        className={`text-xs uppercase tracking-wide ${fields.energyPoints ? 'font-bold text-su-black/70' : 'font-medium text-su-black/20'}`}
                      >
                        EP
                      </label>
                      <Input
                        id="custom-ep"
                        type="number"
                        min={0}
                        value={fields.energyPoints ? energyPoints : ''}
                        onChange={(e) => setEnergyPoints(e.target.value)}
                        placeholder="0"
                        className={`w-24 ${fields.energyPoints ? inputClasses : disabledInputClasses}`}
                        disabled={!fields.energyPoints}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="custom-heat"
                        className={`text-xs uppercase tracking-wide ${fields.heatCapacity ? 'font-bold text-su-black/70' : 'font-medium text-su-black/20'}`}
                      >
                        Heat Cap
                      </label>
                      <Input
                        id="custom-heat"
                        type="number"
                        min={0}
                        value={fields.heatCapacity ? heatCapacity : ''}
                        onChange={(e) => setHeatCapacity(e.target.value)}
                        placeholder="0"
                        className={`w-24 ${fields.heatCapacity ? inputClasses : disabledInputClasses}`}
                        disabled={!fields.heatCapacity}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="custom-desc" className="text-xs font-bold uppercase tracking-wide text-su-black/70">
                      Description
                    </label>
                    <Textarea
                      id="custom-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional description..."
                      className="min-h-[60px] border-su-grey-light/50 bg-su-white text-sm text-su-black placeholder:text-su-grey-dark"
                      rows={2}
                    />
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-end gap-2 border-t border-su-grey-light/30 pt-3">
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="cursor-pointer px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-black/50 transition-colors hover:text-su-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!name.trim() || isPending}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-green px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isPending ? 'Adding...' : 'Add Item'}
                    </button>
                  </div>
                </form>
              </DisplayCard>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
