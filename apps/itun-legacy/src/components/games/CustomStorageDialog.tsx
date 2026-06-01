import { useState, useCallback } from 'react'
import { FilterChip, ModalShell, TECH_LEVEL_STYLES, techLevelLabel } from 'suref-react'
import { CUSTOM_CARGO_CATEGORIES, getCategoryFields } from '../../lib/customCargoCategories'
import { buildCustomCargoMetadata } from './crawlerStorageUtils'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'

type CustomStorageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string, metadata: Record<string, unknown>) => void
  isPending: boolean
}

/** Tech level options for the selector */
const TL_OPTIONS: (number | 'B' | 'N')[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

/** Dialog for adding a custom storage item with category, tech level, and category-specific fields */
export function CustomStorageDialog({
  open,
  onOpenChange,
  onAdd,
  isPending,
}: CustomStorageDialogProps) {
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

      const metadata = buildCustomCargoMetadata({
        category,
        description,
        techLevel,
        salvageValue,
        slotsRequired,
        structurePoints,
        energyPoints,
        heatCapacity,
        fields,
      })

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
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add Custom Item"
      subtitle="Add a custom item to crawler storage."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-su-white p-4">
        {/* Category selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-su-black/70">
            Category
          </span>
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
          <label
            htmlFor="custom-name"
            className="text-xs font-bold uppercase tracking-wide text-su-black/70"
          >
            Name *
          </label>
          <Input
            id="custom-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className={inputClasses}
          />
        </div>

        {/* Tech Level selector */}
        <div
          className={`flex flex-col gap-1.5 ${!fields.techLevel ? 'pointer-events-none opacity-30' : ''}`}
        >
          <span className="text-xs font-bold uppercase tracking-wide text-su-black/70">
            Tech Level
          </span>
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

        {/* Number fields -- always shown, disabled when not relevant */}
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
          <label
            htmlFor="custom-desc"
            className="text-xs font-bold uppercase tracking-wide text-su-black/70"
          >
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
    </ModalShell>
  )
}
