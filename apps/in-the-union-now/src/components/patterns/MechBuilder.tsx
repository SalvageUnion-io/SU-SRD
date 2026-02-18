import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { getChassisAbilities, getAssetUrl } from 'salvageunion-reference'
import {
  DisplayCard,
  StatDisplay,
  Text,
  ValueDisplay,
  SectionSeparator,
  ReferenceEntityChassisAbilitiesContent,
  getReferenceEntitySpacing,
  deleteControl,
} from 'suref-react'
import { Eye, EyeOff, Save, Trash2, Copy, Crosshair, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip'
import { ReferenceEntitySelectionModal } from './ReferenceEntitySelectionModal'
import type { BuilderSchemaName } from './ReferenceEntitySelectionModal'
import { PatternSelectionModal } from './PatternSelectionModal'
import { EmptySlotCard } from './EmptySlotCard'
import type { BuilderState, ResolvedItem } from '../../lib/builderUtils'
import {
  resolvePatternItems,
  computeCapacity,
  computeSalvageValue,
  applyPatternItems,
  referencePatternToItems,
  STARTING_MECH_BUDGET,
  nextSortOrder,
  builderToCreateInput,
} from '../../lib/builderUtils'
import type { CreatePatternInput, SelectedPattern } from '../../types/common'
import type { MechSourcePattern } from '../../lib/mechUtils'
import type { SaveStatus } from '../../hooks/useSaveStatus'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'
import { SheetFooter } from '../shared/SheetFooter'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { TAG_BUTTON, TAG_BUTTON_SM } from '../shared/tagButtonClasses'
import { findChassisById } from '../../lib/entityHelpers'

type MechBuilderProps = {
  initialState?: BuilderState
  // Legacy explicit-save mode (creation flow)
  onSave?: (input: CreatePatternInput) => void
  onCancel?: () => void
  isSaving?: boolean
  // Autosave mode
  onChange?: (state: BuilderState) => void
  saveStatus?: SaveStatus
  // Shared
  onDelete?: () => void
  onCopy?: () => void
  onSaveToPatterns?: () => void
  isDeleting?: boolean
  isCopying?: boolean
  isSavingToPatterns?: boolean
  readOnly?: boolean
  compact?: boolean
  hideFooterToggles?: boolean
  hideFooter?: boolean
  // Source pattern linking
  sourcePattern?: MechSourcePattern | null
  isDeviated?: boolean
  onViewPattern?: () => void
  onPatternApplied?: (selection: SelectedPattern) => void
  userId?: string
  /** Content rendered inside the card body above chassis abilities (e.g. pilot listing) */
  pilotContent?: React.ReactNode
  /** Whether to make the DisplayCard header sticky (default: true) */
  stickyHeader?: boolean
}

const emptyState: BuilderState = {
  name: '',
  chassisRef: null,
  description: '',
  visible: true,
  customImageUrl: null,
  items: [],
}

type ModalTarget = BuilderSchemaName | null

export function MechBuilder({
  initialState,
  onSave,
  onCancel,
  onChange,
  saveStatus,
  onDelete,
  onCopy,
  onSaveToPatterns,
  isSaving,
  isDeleting,
  isCopying,
  isSavingToPatterns,
  readOnly,
  compact,
  hideFooterToggles,
  hideFooter,
  sourcePattern,
  isDeviated,
  onViewPattern,
  onPatternApplied,
  userId,
  pilotContent,
  stickyHeader = true,
}: MechBuilderProps) {
  const [state, setState] = useState<BuilderState>(initialState ?? emptyState)
  const [modalTarget, setModalTarget] = useState<ModalTarget>(null)
  const [showPatternModal, setShowPatternModal] = useState(false)
  const [startingMechMode, setStartingMechMode] = useState(false)
  const isFirstStateChange = useRef(true)

  // Fire onChange on every state change after initial mount (autosave mode)
  useEffect(() => {
    if (isFirstStateChange.current) {
      isFirstStateChange.current = false
      return
    }
    onChange?.(state)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const chassis = useMemo(
    () => (state.chassisRef ? findChassisById(state.chassisRef) : undefined),
    [state.chassisRef]
  )

  const resolvedItems = useMemo(() => resolvePatternItems(state.items), [state.items])

  const capacity = useMemo(
    () => computeCapacity(chassis ?? null, resolvedItems),
    [chassis, resolvedItems]
  )

  const salvageValue = useMemo(
    () => computeSalvageValue(chassis ?? null, resolvedItems),
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
    if (input && capacity.isValid && onSave) {
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

  function handlePatternSelect(selection: SelectedPattern) {
    if (selection.source === 'reference') {
      setState((s) => ({
        ...applyPatternItems(
          s,
          referencePatternToItems(selection.pattern.systems, selection.pattern.modules)
        ),
        name: selection.pattern.name,
      }))
    } else {
      setState((s) => ({
        ...applyPatternItems(s, selection.pattern.pattern_items),
        name: selection.pattern.name,
      }))
    }
    onPatternApplied?.(selection)
  }

  return (
    <>
      <DisplayCard
        stickyHeader={stickyHeader}
        headerBg="bg-su-green"
        bodyPadding="p-0"
        mode={compact ? 'compact' : undefined}
        image={{
          url: chassis ? getAssetUrl(chassis) : undefined,
          alt: chassis?.name,
          editable: readOnly
            ? undefined
            : {
                customUrl: state.customImageUrl,
                onSetCustom: setCustomImage,
              },
        }}
        headerContent={
          chassis ? (
            <>
              {/* LEFT: TL + pattern name + chassis value */}
              <div className={`flex min-w-0 items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
                <StatDisplay label="TL" value={chassis.techLevel} inverse compact={compact} />
                <div className={`flex min-w-0 flex-col ${compact ? 'gap-0.5' : 'gap-0.5'} py-1`}>
                  {readOnly ? (
                    <Text
                      variant="pseudoheader"
                      as="span"
                      className={compact ? 'text-base' : 'text-[1.75rem]'}
                      style={compact ? { lineHeight: 1 } : undefined}
                    >
                      {state.name ? `\u201C${state.name}\u201D` : ''}
                    </Text>
                  ) : (
                    <PatternNameInput value={state.name} onChange={setName} compact={compact} />
                  )}
                  <div className={`flex flex-wrap items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
                    {salvageValue.isLegalStartingMech && (
                      <span
                        className={`inline-flex shrink-0 whitespace-nowrap border border-su-black bg-su-rust px-1 font-mono font-bold uppercase tracking-tight text-white ${compact ? 'text-xs font-normal' : 'text-base font-semibold'}`}
                        style={{ lineHeight: 1 }}
                      >
                        Legal Starting Mech
                      </span>
                    )}
                    <ValueDisplay label={`${chassis.name} Chassis`} compact={compact} />
                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModalTarget('chassis')}
                          className={compact ? TAG_BUTTON_SM : TAG_BUTTON}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPatternModal(true)}
                          className={compact ? TAG_BUTTON_SM : TAG_BUTTON}
                        >
                          Apply Pattern
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* RIGHT: Stats */}
              <div className="flex shrink-0 items-center gap-0.5">
                <StatDisplay
                  label={compact ? 'SP' : 'Structure'}
                  value={chassis.structurePoints}
                  bottomLabel={compact ? '' : 'Points'}
                  compact={compact}
                />
                <StatDisplay
                  label={compact ? 'EP' : 'Energy'}
                  value={chassis.energyPoints}
                  bottomLabel={compact ? '' : 'Points'}
                  compact={compact}
                />
                <StatDisplay
                  label="Heat"
                  value={chassis.heatCapacity}
                  bottomLabel={compact ? 'Cap' : 'Capacity'}
                  compact={compact}
                />
                <StatDisplay
                  label={compact ? 'Sys' : 'System'}
                  bottomLabel={compact ? 'Slts' : 'Slots'}
                  value={capacity.systemSlotsUsed}
                  outOfMax={capacity.systemSlotsTotal}
                  isOverMax={capacity.isOverSystemCapacity}
                  compact={compact}
                />
                <StatDisplay
                  label={compact ? 'Mod' : 'Module'}
                  bottomLabel={compact ? 'Slts' : 'Slots'}
                  value={capacity.moduleSlotsUsed}
                  outOfMax={capacity.moduleSlotsTotal}
                  isOverMax={capacity.isOverModuleCapacity}
                  compact={compact}
                />
                <StatDisplay
                  label={compact ? 'Crgo' : 'Cargo'}
                  value={chassis.cargoCapacity ?? 0}
                  bottomLabel={compact ? 'Cap' : 'Capacity'}
                  compact={compact}
                />
                <StatDisplay
                  label={compact ? 'SV' : 'Salvage'}
                  value={salvageValue.totalTL1Cost}
                  outOfMax={startingMechMode ? STARTING_MECH_BUDGET : undefined}
                  isOverMax={startingMechMode ? !salvageValue.isLegalStartingMech : undefined}
                  bottomLabel="TL1"
                  compact={compact}
                />
              </div>
            </>
          ) : (
            <div className="flex w-full items-center gap-2 px-2 py-2">
              <Text
                as="span"
                variant="pseudoheader"
                className={`${compact ? 'text-base' : 'text-[1.75rem]'} text-su-white`}
                style={compact ? { lineHeight: 1 } : undefined}
              >
                {readOnly ? 'NO CHASSIS' : 'SELECT A CHASSIS'}
              </Text>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setModalTarget('chassis')}
                  className={compact ? TAG_BUTTON_SM : TAG_BUTTON}
                >
                  Select
                </button>
              )}
            </div>
          )
        }
        footerContent={
          readOnly || hideFooter ? undefined : (
            <SheetFooter
              saveStatusText={saveStatus?.statusText}
              leftContent={
                !hideFooterToggles ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleVisible}
                      className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-su-white ${state.visible ? 'text-su-white' : 'text-su-white/70'}`}
                      title={state.visible ? 'Pattern is visible' : 'Pattern is hidden'}
                    >
                      {state.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <span>{state.visible ? 'Visible' : 'Hidden'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartingMechMode((v) => !v)}
                      className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-su-white ${startingMechMode ? 'text-su-white' : 'text-su-white/70'}`}
                      title={startingMechMode ? 'Starting mech mode on' : 'Starting mech mode off'}
                    >
                      <Crosshair className="h-4 w-4" />
                      <span>Starting Mech</span>
                    </button>
                  </>
                ) : undefined
              }
              rightContent={
                <>
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={isDeleting}
                      className={actionButtonClasses('rust')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  ) : onCancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={onCancel}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  {onCopy && (
                    <button
                      type="button"
                      onClick={onCopy}
                      disabled={isCopying}
                      className={actionButtonClasses('green')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {isCopying ? 'Copying...' : 'Copy'}
                    </button>
                  )}
                  {sourcePattern && onViewPattern ? (
                    <TooltipProvider>
                      <div className="flex items-center gap-1.5">
                        {isDeviated && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center text-su-orange">
                                <AlertTriangle className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Loadout has changed since this pattern was applied
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          onClick={onViewPattern}
                          className={actionButtonClasses('green')}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Pattern
                        </button>
                      </div>
                    </TooltipProvider>
                  ) : onSaveToPatterns ? (
                    <button
                      type="button"
                      onClick={onSaveToPatterns}
                      disabled={isSavingToPatterns}
                      className={actionButtonClasses('green')}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSavingToPatterns ? 'Saving...' : 'Save to My Patterns'}
                    </button>
                  ) : null}
                  {onSave && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!canSave || isSaving}
                      className={actionButtonClasses('orange')}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </>
              }
            />
          )
        }
      >
        <div className={compact ? 'px-2 pt-2 pb-2' : 'px-4 pt-3 pb-4'}>
          {/* Pilot listing */}
          {pilotContent && (
            <div className="-mt-2 mb-4">
              <SectionSeparator label="Pilot" compact={compact} />
              <div className={compact ? 'mt-1.5' : 'mt-2'}>{pilotContent}</div>
            </div>
          )}

          {/* Chassis Abilities */}
          {chassis && chassisAbilities && chassisAbilities.length > 0 && (
            <div className={pilotContent ? 'mb-4' : '-mt-4 mb-4 overflow-hidden'}>
              <ReferenceEntityChassisAbilitiesContent
                chassisName={chassis.name}
                spacing={getReferenceEntitySpacing(!!compact)}
                compact={!!compact}
                chassisAbilities={chassisAbilities}
              />
            </div>
          )}

          <ItemSlotSection
            label="Systems"
            items={systemItems}
            slotsUsed={capacity.systemSlotsUsed}
            slotsTotal={capacity.systemSlotsTotal}
            slotType="systems"
            readOnly={readOnly}
            hasChassis={!!chassis}
            onRemove={removeItem}
            onAdd={setModalTarget}
            compact={compact}
            className="mb-4"
          />

          <ItemSlotSection
            label="Modules"
            items={moduleItems}
            slotsUsed={capacity.moduleSlotsUsed}
            slotsTotal={capacity.moduleSlotsTotal}
            slotType="modules"
            readOnly={readOnly}
            hasChassis={!!chassis}
            onRemove={removeItem}
            onAdd={setModalTarget}
            compact={compact}
            className="mb-2"
          />

          {/* Clear float */}
          <div className="clear-both" />
        </div>
      </DisplayCard>

      {/* Entity Selection Modal */}
      {!readOnly && modalTarget && (
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
          onSelect={handleModalSelect}
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
      {!readOnly && state.chassisRef && (
        <PatternSelectionModal
          open={showPatternModal}
          onOpenChange={setShowPatternModal}
          chassisRef={state.chassisRef}
          onSelect={handlePatternSelect}
          userId={userId}
        />
      )}
    </>
  )
}

function ItemSlotSection({
  label,
  items,
  slotsUsed,
  slotsTotal,
  slotType,
  readOnly,
  hasChassis,
  onRemove,
  onAdd,
  compact,
  className,
}: {
  label: string
  items: ResolvedItem[]
  slotsUsed: number
  slotsTotal: number
  slotType: 'systems' | 'modules'
  readOnly?: boolean
  hasChassis: boolean
  onRemove: (sortOrder: number) => void
  onAdd: (target: BuilderSchemaName) => void
  compact?: boolean
  className?: string
}) {
  const addLabel = slotType === 'systems' ? 'Add System' : 'Add Module'

  return (
    <section className={className}>
      <SectionSeparator label={`${label} (${slotsUsed}/${slotsTotal})`} compact={compact} />
      <div className={compact ? 'mt-1.5 space-y-1.5' : 'mt-2 space-y-2'}>
        {items.map((item) => (
          <ReferenceEntityListingItem
            key={item.sort_order}
            entity={item.entity}
            controls={readOnly ? undefined : [deleteControl(() => onRemove(item.sort_order))]}
          />
        ))}
        {!readOnly && hasChassis && slotsUsed < slotsTotal && (
          <EmptySlotCard label={addLabel} onClick={() => onAdd(slotType)} />
        )}
      </div>
    </section>
  )
}

function PatternNameInput({
  value,
  onChange,
  compact,
}: {
  value: string
  onChange: (value: string) => void
  compact?: boolean
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
  const fontClass = compact ? 'text-base' : 'text-[1.75rem]'

  return (
    <span className="relative inline-flex items-baseline">
      {/* Hidden measuring span — mirrors input font to get content width */}
      <span
        ref={measureRef}
        aria-hidden
        className={`pointer-events-none invisible absolute whitespace-pre font-mono ${fontClass} font-bold uppercase leading-none tracking-tight`}
      >
        {value || placeholder}
      </span>
      <Text
        variant="pseudoheader"
        as="span"
        className={`inline-flex items-center ${fontClass}`}
        style={compact ? { lineHeight: 1 } : undefined}
      >
        {hasValue && <span className="select-none">&ldquo;</span>}
        <input
          ref={inputRef}
          type="text"
          size={1}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`border-none bg-transparent p-0 font-mono ${fontClass} font-bold uppercase leading-none tracking-tight text-su-white outline-none placeholder:normal-case placeholder:text-su-white/50`}
          style={{ width: inputWidth || undefined }}
        />
        {hasValue && <span className="select-none">&rdquo;</span>}
      </Text>
    </span>
  )
}
