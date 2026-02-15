import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { SalvageUnionReference, getChassisAbilities, getAssetUrl } from 'salvageunion-reference'
import type { SURefChassis } from 'salvageunion-reference'
import {
  DisplayCard,
  EntityDisplay,
  StatDisplay,
  Text,
  ValueDisplay,
  SectionSeparator,
  EntityChassisAbilitiesContent,
  getEntitySpacing,
} from 'suref-react'
import { Plus, ImageOff, Eye, EyeOff, ImagePlus, Replace, X } from 'lucide-react'
import { Button } from '../ui/button'
import { EntitySelectionModal } from './EntitySelectionModal'
import type { BuilderState, ResolvedItem } from '../../lib/builderUtils'
import {
  resolvePatternItems,
  computeCapacity,
  nextSortOrder,
  builderToCreateInput,
} from '../../lib/builderUtils'
import type { CreatePatternInput } from '../../types/common'

type MechBuilderProps = {
  initialState?: BuilderState
  onSave: (input: CreatePatternInput) => void
  onCancel: () => void
  isSaving?: boolean
  // Future Phase 3 props
  scrapBudget?: number
  techLevelFilter?: number
}

const emptyState: BuilderState = {
  name: '',
  chassisRef: null,
  description: '',
  visible: true,
  customImageUrl: null,
  items: [],
}

type ModalTarget = 'chassis' | 'systems' | 'modules' | null

export function MechBuilder({ initialState, onSave, onCancel, isSaving }: MechBuilderProps) {
  const [state, setState] = useState<BuilderState>(initialState ?? emptyState)
  const [modalTarget, setModalTarget] = useState<ModalTarget>(null)

  const chassis = useMemo(
    () =>
      state.chassisRef
        ? SalvageUnionReference.Chassis.find((c) => c.id === state.chassisRef)
        : undefined,
    [state.chassisRef]
  )

  const resolvedItems = useMemo(() => resolvePatternItems(state.items), [state.items])

  const capacity = useMemo(
    () => computeCapacity(chassis ?? null, resolvedItems),
    [chassis, resolvedItems]
  )

  const systemItems = useMemo(
    () => resolvedItems.filter((i) => i.schema_name === 'systems'),
    [resolvedItems]
  )

  const moduleItems = useMemo(
    () => resolvedItems.filter((i) => i.schema_name === 'modules'),
    [resolvedItems]
  )

  const chassisAbilities = useMemo(
    () => (chassis ? getChassisAbilities(chassis) : undefined),
    [chassis]
  )

  const canSave = useMemo(() => {
    const input = builderToCreateInput(state)
    return input !== null && capacity.isValid
  }, [state, capacity.isValid])

  const handleSave = useCallback(() => {
    const input = builderToCreateInput(state)
    if (input && capacity.isValid) {
      onSave(input)
    }
  }, [state, capacity.isValid, onSave])

  function setName(name: string) {
    setState((s) => ({ ...s, name }))
  }

  function toggleVisible() {
    setState((s) => ({ ...s, visible: !s.visible }))
  }

  function selectChassis(chassisId: string) {
    setState((s) => ({ ...s, chassisRef: chassisId }))
  }

  function setCustomImage(url: string | null) {
    setState((s) => ({ ...s, customImageUrl: url }))
  }

  function addItem(schemaName: 'systems' | 'modules', entityId: string) {
    setState((s) => ({
      ...s,
      items: [
        ...s.items,
        {
          schema_name: schemaName,
          schema_ref_id: entityId,
          sort_order: nextSortOrder(s.items),
        },
      ],
    }))
  }

  function removeItem(sortOrder: number) {
    setState((s) => ({
      ...s,
      items: s.items.filter((i) => i.sort_order !== sortOrder),
    }))
  }

  function handleModalSelect(entityId: string) {
    if (modalTarget === 'chassis') {
      selectChassis(entityId)
    } else if (modalTarget === 'systems' || modalTarget === 'modules') {
      addItem(modalTarget, entityId)
    }
    setModalTarget(null)
  }

  return (
    <>
      <DisplayCard
        headerBg="bg-su-green"
        bodyPadding="p-0"
        headerContent={
          chassis ? (
            <>
              {/* LEFT: TL + pattern name + chassis value */}
              <div className="flex min-w-0 items-center gap-1">
                <StatDisplay label="TL" value={chassis.techLevel} inverse />
                <div className="flex min-w-0 flex-col gap-0.5 py-1">
                  <PatternNameInput value={state.name} onChange={setName} />
                  <div className="flex items-center gap-1">
                    <ValueDisplay label={`${chassis.name} Chassis`} />
                    <button
                      type="button"
                      onClick={() => setModalTarget('chassis')}
                      className="inline-flex border border-su-black bg-su-white px-1 font-mono text-base font-semibold uppercase leading-none text-su-black transition-opacity hover:opacity-80"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
              {/* RIGHT: Stats */}
              <div className="flex shrink-0 items-center gap-0.5">
                <StatDisplay
                  label="Structure"
                  value={chassis.structurePoints}
                  bottomLabel="Points"
                />
                <StatDisplay label="Energy" value={chassis.energyPoints} bottomLabel="Points" />
                <StatDisplay label="Heat" value={chassis.heatCapacity} bottomLabel="Capacity" />
                <StatDisplay
                  label="System"
                  bottomLabel="Slots"
                  value={capacity.systemSlotsUsed}
                  outOfMax={capacity.systemSlotsTotal}
                  isOverMax={capacity.isOverSystemCapacity}
                />
                <StatDisplay
                  label="Module"
                  bottomLabel="Slots"
                  value={capacity.moduleSlotsUsed}
                  outOfMax={capacity.moduleSlotsTotal}
                  isOverMax={capacity.isOverModuleCapacity}
                />
                <StatDisplay
                  label="Cargo"
                  value={chassis.cargoCapacity ?? 0}
                  bottomLabel="Capacity"
                />
              </div>
            </>
          ) : (
            <div className="flex w-full items-center gap-2 px-2 py-2">
              <Text as="span" variant="pseudoheader" className="text-[1.75rem] text-su-white">
                SELECT A CHASSIS
              </Text>
              <button
                type="button"
                onClick={() => setModalTarget('chassis')}
                className="inline-flex cursor-pointer border border-su-black bg-su-white px-1 font-mono text-base font-semibold uppercase leading-none text-su-black transition-opacity hover:opacity-80"
              >
                Select
              </button>
            </div>
          )
        }
        footerContent={
          <div className="flex w-full items-center justify-between px-2 py-1">
            <button
              type="button"
              onClick={toggleVisible}
              className="flex items-center gap-1.5 text-xs text-su-white/70 hover:text-su-white"
              title={state.visible ? 'Pattern is visible' : 'Pattern is hidden'}
            >
              {state.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span>{state.visible ? 'Visible' : 'Hidden'}</span>
            </button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
                {isSaving ? 'Saving...' : 'Save Pattern'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="px-4 pt-3 pb-4">
          {/* Floated image — content flows around it */}
          <MechBuilderImageSlot
            chassis={chassis}
            customImageUrl={state.customImageUrl}
            onSetCustomImage={setCustomImage}
          />

          {/* Chassis Abilities */}
          {chassis && chassisAbilities && chassisAbilities.length > 0 && (
            <div className="-mt-4 mb-4 overflow-hidden">
              <EntityChassisAbilitiesContent
                chassisName={chassis.name}
                spacing={getEntitySpacing(false)}
                compact={false}
                chassisAbilities={chassisAbilities}
              />
            </div>
          )}

          {/* Systems */}
          <section className="mb-4">
            <SectionSeparator
              label={`Systems (${capacity.systemSlotsUsed}/${capacity.systemSlotsTotal})`}
            />
            <div className="mt-2 space-y-2">
              {systemItems.map((item) => (
                <RemovableEntityCard
                  key={item.sort_order}
                  entity={item.entity}
                  onRemove={() => removeItem(item.sort_order)}
                />
              ))}
              {chassis && capacity.systemSlotsUsed < capacity.systemSlotsTotal && (
                <EmptySlotCard label="Add System" onClick={() => setModalTarget('systems')} />
              )}
            </div>
          </section>

          {/* Modules */}
          <section className="mb-2">
            <SectionSeparator
              label={`Modules (${capacity.moduleSlotsUsed}/${capacity.moduleSlotsTotal})`}
            />
            <div className="mt-2 space-y-2">
              {moduleItems.map((item) => (
                <RemovableEntityCard
                  key={item.sort_order}
                  entity={item.entity}
                  onRemove={() => removeItem(item.sort_order)}
                />
              ))}
              {chassis && capacity.moduleSlotsUsed < capacity.moduleSlotsTotal && (
                <EmptySlotCard label="Add Module" onClick={() => setModalTarget('modules')} />
              )}
            </div>
          </section>

          {/* Clear float */}
          <div className="clear-both" />
        </div>
      </DisplayCard>

      {/* Entity Selection Modal */}
      {modalTarget && (
        <EntitySelectionModal
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
          onSelect={handleModalSelect}
          remainingSlots={
            modalTarget === 'systems'
              ? capacity.systemSlotsTotal - capacity.systemSlotsUsed
              : modalTarget === 'modules'
                ? capacity.moduleSlotsTotal - capacity.moduleSlotsUsed
                : undefined
          }
        />
      )}
    </>
  )
}

function RemovableEntityCard({
  entity,
  onRemove,
}: {
  entity: ResolvedItem['entity']
  onRemove: () => void
}) {
  return <EntityDisplay data={entity} listing compact onDelete={onRemove} />
}

function EmptySlotCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex shrink-0 flex-col overflow-visible rounded-md">
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-su-grey-light/50 px-2 py-1 text-su-grey-dark/50 hover:border-su-grey-dark/50 hover:text-su-grey-dark"
      >
        <Plus className="h-4 w-4" />
        <span className="font-mono text-sm font-semibold uppercase">{label}</span>
      </button>
    </div>
  )
}

function PatternNameInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputWidth, setInputWidth] = useState(0)

  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.scrollWidth)
    }
  }, [value])

  const hasValue = value.length > 0
  const placeholder = 'Pattern name...'

  return (
    <span className="relative inline-flex items-baseline">
      {/* Hidden measuring span — mirrors input font to get content width */}
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-pre font-mono text-[1.75rem] font-bold uppercase leading-none"
      >
        {value || placeholder}
      </span>
      <Text variant="pseudoheader" as="span" className="inline-flex items-center text-[1.75rem]">
        {hasValue && <span className="select-none">&ldquo;</span>}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-none bg-transparent p-0 font-mono text-[1.75rem] font-bold uppercase leading-none text-su-white outline-none placeholder:normal-case placeholder:text-su-white/50"
          style={{ width: inputWidth || undefined }}
        />
        {hasValue && <span className="select-none">&rdquo;</span>}
      </Text>
    </span>
  )
}

function MechBuilderImageSlot({
  chassis,
  customImageUrl,
  onSetCustomImage,
}: {
  chassis: SURefChassis | undefined
  customImageUrl: string | null
  onSetCustomImage: (url: string | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chassisAssetUrl = chassis ? getAssetUrl(chassis) : undefined
  const displayUrl = customImageUrl ?? chassisAssetUrl
  const hasCustomImage = !!customImageUrl

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Create a local object URL for preview (future: upload to Supabase Storage)
    const url = URL.createObjectURL(file)
    onSetCustomImage(url)
    e.target.value = ''
  }

  return (
    <div
      className="shrink-0 align-top md:float-left md:mr-4 md:mb-4"
      style={{ width: '300px', maxWidth: '100%', shapeOutside: 'margin-box' }}
    >
      <div className="group relative aspect-square overflow-hidden rounded border border-dashed border-su-grey-light/50 bg-su-grey-light/10">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={chassis?.name ?? 'Pattern image'}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-su-grey-dark/30">
            <ImageOff className="h-12 w-12" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-su-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {hasCustomImage ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 border border-su-black bg-su-white px-1.5 py-0.5 font-mono text-xs font-semibold uppercase leading-none text-su-black transition-opacity hover:opacity-80"
              >
                <Replace className="h-3 w-3" />
                Change
              </button>
              <button
                type="button"
                onClick={() => onSetCustomImage(null)}
                className="inline-flex items-center gap-1 border border-su-black bg-su-rust px-1.5 py-0.5 font-mono text-xs font-semibold uppercase leading-none text-su-white transition-opacity hover:opacity-80"
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 border border-su-black bg-su-white px-1.5 py-0.5 font-mono text-xs font-semibold uppercase leading-none text-su-black transition-opacity hover:opacity-80"
            >
              <ImagePlus className="h-3 w-3" />
              Add Image
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  )
}
